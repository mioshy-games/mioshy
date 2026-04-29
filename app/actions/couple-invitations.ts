"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createOrRefreshInvitation,
  acceptInvitationForCurrentUser,
  revokeInvitation,
  normaliseEmail,
} from "@/lib/between-us/invitations";
import { requireCompleteProfile } from "@/lib/auth/profile-gate";
import { sendBrevoEmail } from "@/lib/email/brevo";
import { renderCoupleInviteEmail } from "@/lib/email/templates/couple-invite";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

function siteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_BASE_URL || "";
  const normalised = raw.replace(/\/+$/, "");
  return normalised || "https://mioshy.com";
}

function isValidEmail(email: string): boolean {
  // Deliberately lenient — Brevo will do the hard check.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Owner sends an email invitation to their partner. Creates (or refreshes)
 * a pending invitation row, then dispatches the email via Brevo.
 *
 * Rules enforced:
 *   - caller must be signed in with a complete profile (name+mobile+password)
 *   - caller must be the couple owner
 *   - couple must not already have an accepted partner
 *   - inviting the caller's own email is rejected
 */
export async function inviteCouplePartnerByEmail(params: {
  email: string;
  locale?: "he" | "en";
  nameHint?: string | null;
  gameTitle?: string | null;
}): Promise<Ok<{ invitation_id: string; email_dispatched: boolean }> | Err> {
  const gate = await requireCompleteProfile();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  const email = normaliseEmail(params.email ?? "");
  if (!isValidEmail(email)) {
    return { ok: false, error: "invalid_email" };
  }
  if (email === (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "cant_invite_self" };
  }

  // Ensure the caller is the owner of an existing couple, or create one.
  const { data: coupleIdResp, error: rpcErr } = await supabase.rpc(
    "create_couple_for_current_user",
    { p_display_name: null },
  );
  if (rpcErr || !coupleIdResp) {
    return {
      ok: false,
      error: rpcErr?.message ?? "could_not_establish_couple",
    };
  }
  const coupleId = coupleIdResp as string;

  // Must be owner to send invitations
  const { data: membership } = await supabase
    .from("couple_members")
    .select("role")
    .eq("couple_id", coupleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership?.role !== "owner") {
    return { ok: false, error: "not_couple_owner" };
  }

  // Couple already full?
  const admin = createAdminSupabaseClient();
  const { count: acceptedCount } = await admin
    .from("couple_invitations")
    .select("id", { count: "exact", head: true })
    .eq("couple_id", coupleId)
    .eq("status", "accepted");
  if ((acceptedCount ?? 0) > 0) {
    return { ok: false, error: "couple_already_full" };
  }

  let invitation;
  try {
    invitation = await createOrRefreshInvitation({
      coupleId,
      inviterUserId: user.id,
      email,
      nameHint: params.nameHint ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invitation_failed";
    return { ok: false, error: msg };
  }

  // Look up inviter's name for the email body
  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const locale = params.locale ?? "he";
  const inviteUrl = `${siteBaseUrl()}/${locale}/invite/${invitation.token}`;

  const { subject, htmlContent, textContent } = renderCoupleInviteEmail({
    locale,
    inviterName:
      (inviterProfile?.full_name as string | null) ??
      (user.email ?? "").split("@")[0],
    inviteeName: params.nameHint ?? null,
    coupleDisplayName: null,
    inviteUrl,
    expiresAt: invitation.expires_at,
    gameTitle: params.gameTitle ?? null,
  });

  const send = await sendBrevoEmail({
    to: [{ email }],
    subject,
    htmlContent,
    textContent,
    tags: ["couple-invite", `locale:${locale}`],
    replyTo: user.email
      ? { email: user.email, name: inviterProfile?.full_name ?? undefined }
      : undefined,
  });

  revalidatePath("/[locale]/account", "page");
  revalidatePath("/[locale]/my", "page");
  revalidatePath("/[locale]/between-us/[slug]", "page");

  return {
    ok: true,
    invitation_id: invitation.id,
    email_dispatched: send.ok === true,
  };
}

/**
 * Wrapper kept for consistency with other server actions. The real work
 * is in lib/between-us/invitations.ts.
 */
export async function acceptCoupleInvitation(
  token: string,
): Promise<Ok<{ couple_id: string }> | Err> {
  if (!token || typeof token !== "string") {
    return { ok: false, error: "missing_token" };
  }
  const res = await acceptInvitationForCurrentUser(token);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/[locale]/my", "page");
  revalidatePath("/[locale]/account", "page");
  return { ok: true, couple_id: res.couple_id };
}

export async function revokePendingInvitation(
  invitationId: string,
): Promise<Ok<object> | Err> {
  if (!invitationId) return { ok: false, error: "missing_id" };
  const res = await revokeInvitation(invitationId);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/[locale]/account", "page");
  return { ok: true };
}
