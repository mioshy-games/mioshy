"use server";

/**
 * Server actions for the test-user whitelist (admin-only).
 *
 * The whitelist itself lives on `profiles.is_test_user`. These actions
 * wrap the write so the admin UI never needs the service-role client
 * directly, and so every flip is stamped with `test_user_marked_at` +
 * `test_user_marked_by`.
 *
 * Auth: every action gates on `requireAdmin()` (NOT `requireExpert` —
 * coaches must not be able to grant themselves free product). On
 * failure the action returns a structured error; the client surfaces
 * it via a toast.
 *
 * Added 2026-06-01.
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { makeLogger } from "@/lib/observability/log";
import { sendTestUserInvite } from "@/lib/email/test-user-invite";

const log = makeLogger("admin.test_users");

// 2026-06-01 — `object` as the default satisfies both the eslint
// `no-empty-object-type` rule and the structural intersection: `{ ok:
// true } & object` collapses to `{ ok: true }`, which is what callers
// without extra fields want.
type Ok<T extends object = object> = { ok: true } & T;
type Err = { ok: false; error: string };

/**
 * Toggle a user's `is_test_user` flag. Looks up the target by email so
 * the admin doesn't need to know the auth uid. Idempotent — calling
 * twice with the same email leaves the flag in its current state and
 * just refreshes the audit fields.
 */
/**
 * Add (or remove) an email from the test-user whitelist.
 *
 * Two code paths:
 *   • Profile exists → flip `profiles.is_test_user` directly.
 *   • Profile does not exist → insert into `test_user_invitations`
 *     (pending). `signupAction` auto-claims the invitation on signup
 *     and flips the flag on the newly-created profile.
 *
 * In both cases (when `enabled=true`), we fire a transactional invite
 * email. When `enabled=false` (admin revoking), we do NOT send any
 * email — the silent revoke is the desired UX.
 */
export async function setTestUserByEmail(args: {
  email: string;
  enabled: boolean;
  note?: string;
  locale?: "he" | "en";
}): Promise<
  | Ok<{
      mode: "registered" | "pending" | "revoked";
      userId: string | null;
      displayName: string | null;
    }>
  | Err
> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  const adminId = session.user.id;

  const email = (args.email ?? "").trim().toLowerCase();
  if (!email) {
    log.warn("set_by_email.rejected", { reason: "empty_email" });
    return { ok: false, error: "missing_email" };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    log.error("set_by_email.no_service_role", {});
    return { ok: false, error: "service_unavailable" };
  }

  const { data: profile, error: lookupErr } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .ilike("email", email)
    .maybeSingle();
  if (lookupErr) {
    log.error("set_by_email.lookup_failed", { email, reason: lookupErr.message });
    return { ok: false, error: "lookup_failed" };
  }

  const noteTrimmed =
    typeof args.note === "string" ? args.note.trim() || null : null;

  // ── Branch A: profile exists ────────────────────────────────────────
  if (profile) {
    const userId = (profile as { id: string }).id;
    const displayName = (profile as { full_name: string | null }).full_name;

    const updatePayload: Record<string, unknown> = {
      is_test_user: args.enabled,
      test_user_marked_at: new Date().toISOString(),
      test_user_marked_by: adminId,
    };
    if (typeof args.note === "string") {
      updatePayload.test_user_note = noteTrimmed;
    }

    const { error: updErr } = await admin
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);
    if (updErr) {
      log.error("set_by_email.update_failed", {
        email,
        user_id: userId,
        reason: updErr.message,
      });
      return { ok: false, error: updErr.message };
    }

    log.info("set_by_email.done", {
      email,
      user_id: userId,
      enabled: args.enabled,
      by_admin: adminId,
    });

    if (args.enabled) {
      // Fire-and-forget — the action returns to the UI immediately.
      // Email failures get logged inside the helper.
      await sendTestUserInvite({
        to: email,
        name: displayName,
        mode: "registered",
        note: noteTrimmed,
        locale: args.locale ?? "he",
      });
    }

    revalidatePath("/dashboard/test-users");
    return {
      ok: true,
      mode: args.enabled ? "registered" : "revoked",
      userId,
      displayName,
    };
  }

  // ── Branch B: no profile yet ────────────────────────────────────────
  // Store the email as a pending invitation. When the holder signs up,
  // signupAction will claim it and stamp is_test_user on their profile.
  if (!args.enabled) {
    // Admin revoking an email we don't have a profile for — just drop
    // the pending row if it exists.
    await admin.from("test_user_invitations").delete().eq("email", email);
    log.info("set_by_email.pending_revoked", { email, by_admin: adminId });
    revalidatePath("/dashboard/test-users");
    return { ok: true, mode: "revoked", userId: null, displayName: null };
  }

  const { error: inviteErr } = await admin
    .from("test_user_invitations")
    .upsert(
      {
        email,
        note: noteTrimmed,
        invited_by: adminId,
        invited_at: new Date().toISOString(),
        claimed_at: null,
        claimed_user_id: null,
      },
      { onConflict: "email" },
    );
  if (inviteErr) {
    log.error("set_by_email.invite_insert_failed", {
      email,
      reason: inviteErr.message,
    });
    return { ok: false, error: inviteErr.message };
  }

  log.info("set_by_email.invited_pending", { email, by_admin: adminId });

  await sendTestUserInvite({
    to: email,
    name: null,
    mode: "pending",
    note: noteTrimmed,
    locale: args.locale ?? "he",
  });

  revalidatePath("/dashboard/test-users");
  return {
    ok: true,
    mode: "pending",
    userId: null,
    displayName: null,
  };
}

/** Same as setTestUserByEmail but takes the userId directly — used by
 *  the per-couple admin toggle on /dashboard/my-clients/[coupleId]. */
export async function setTestUserById(args: {
  userId: string;
  enabled: boolean;
  note?: string;
}): Promise<Ok | Err> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { ok: false, error: "unauthorized" };
  }
  const adminId = session.user.id;

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "service_unavailable" };

  const updatePayload: Record<string, unknown> = {
    is_test_user: args.enabled,
    test_user_marked_at: new Date().toISOString(),
    test_user_marked_by: adminId,
  };
  if (typeof args.note === "string") {
    updatePayload.test_user_note = args.note.trim() || null;
  }

  const { error } = await admin
    .from("profiles")
    .update(updatePayload)
    .eq("id", args.userId);
  if (error) {
    log.error("set_by_id.update_failed", {
      user_id: args.userId,
      reason: error.message,
    });
    return { ok: false, error: error.message };
  }

  log.info("set_by_id.done", {
    user_id: args.userId,
    enabled: args.enabled,
    by_admin: adminId,
  });

  revalidatePath("/dashboard/test-users");
  revalidatePath(`/dashboard/my-clients`);
  return { ok: true };
}
