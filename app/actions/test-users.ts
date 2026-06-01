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
export async function setTestUserByEmail(args: {
  email: string;
  enabled: boolean;
  note?: string;
}): Promise<Ok<{ userId: string; displayName: string | null }> | Err> {
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
  if (!profile) {
    log.warn("set_by_email.not_found", { email });
    return { ok: false, error: "user_not_found" };
  }
  const userId = (profile as { id: string }).id;
  const displayName = (profile as { full_name: string | null }).full_name;

  const updatePayload: Record<string, unknown> = {
    is_test_user: args.enabled,
    test_user_marked_at: new Date().toISOString(),
    test_user_marked_by: adminId,
  };
  if (typeof args.note === "string") {
    updatePayload.test_user_note = args.note.trim() || null;
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

  revalidatePath("/dashboard/test-users");
  return { ok: true, userId, displayName };
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
