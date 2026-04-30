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
  // Deliberately lenient - Brevo will do the hard check.
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
  console.log("[couple-invite:CREATE] start", {
    email: params.email,
    locale: params.locale,
    nameHint: params.nameHint,
    gameTitle: params.gameTitle,
  });

  const gate = await requireCompleteProfile();
  if (!gate.ok) {
    console.warn("[couple-invite:CREATE] profile gate failed", { error: gate.error });
    return { ok: false, error: gate.error };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[couple-invite:CREATE] no auth user");
    return { ok: false, error: "login_required" };
  }
  console.log("[couple-invite:CREATE] inviter resolved", {
    user_id: user.id,
    user_email: user.email,
  });

  const email = normaliseEmail(params.email ?? "");
  if (!isValidEmail(email)) {
    console.warn("[couple-invite:CREATE] invalid email", { email });
    return { ok: false, error: "invalid_email" };
  }
  if (email === (user.email ?? "").toLowerCase()) {
    console.warn("[couple-invite:CREATE] self-invite blocked");
    return { ok: false, error: "cant_invite_self" };
  }

  // Ensure the caller is the owner of an existing couple, or create one.
  const { data: coupleIdResp, error: rpcErr } = await supabase.rpc(
    "create_couple_for_current_user",
    { p_display_name: null },
  );
  if (rpcErr || !coupleIdResp) {
    console.error("[couple-invite:CREATE] couple ensure failed", {
      error: rpcErr?.message,
    });
    return {
      ok: false,
      error: rpcErr?.message ?? "could_not_establish_couple",
    };
  }
  const coupleId = coupleIdResp as string;
  console.log("[couple-invite:CREATE] couple ensured", { couple_id: coupleId });

  // Must be owner to send invitations
  const { data: membership } = await supabase
    .from("couple_members")
    .select("role")
    .eq("couple_id", coupleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership?.role !== "owner") {
    console.warn("[couple-invite:CREATE] caller is not owner", {
      couple_id: coupleId,
      role: membership?.role ?? null,
    });
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
    console.warn("[couple-invite:CREATE] couple already full", {
      couple_id: coupleId,
      accepted_count: acceptedCount,
    });
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
    console.log("[couple-invite:CREATE] invitation row created/refreshed", {
      invitation_id: invitation.id,
      token_length: invitation.token.length,
      expires_at: invitation.expires_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invitation_failed";
    console.error("[couple-invite:CREATE] DB insert failed", { error: msg });
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
  console.log("[couple-invite:CREATE] dispatching email", {
    to: email,
    invite_url: inviteUrl,
    locale,
    inviter_name: inviterProfile?.full_name ?? null,
  });

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

  console.log("[couple-invite:CREATE] email dispatch result", {
    ok: send.ok,
    error: !send.ok ? "see brevo logs" : undefined,
  });

  revalidatePath("/[locale]/account", "page");
  revalidatePath("/[locale]/my", "page");
  revalidatePath("/[locale]/between-us/[slug]", "page");

  console.log("[couple-invite:CREATE] DONE", {
    invitation_id: invitation.id,
    email_dispatched: send.ok === true,
    couple_id: coupleId,
  });

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
  console.log("[couple-invite:ACCEPT] start", {
    has_token: !!token,
    token_length: token?.length,
  });

  if (!token || typeof token !== "string") {
    console.warn("[couple-invite:ACCEPT] missing token");
    return { ok: false, error: "missing_token" };
  }

  // Identify caller for the audit trail. acceptInvitationForCurrentUser()
  // re-checks auth internally; we log here too so a single grep for
  // "[couple-invite:ACCEPT]" tells us who tried to accept.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  console.log("[couple-invite:ACCEPT] caller identity", {
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
  });

  const res = await acceptInvitationForCurrentUser(token);
  if (!res.ok) {
    console.warn("[couple-invite:ACCEPT] failed", { error: res.error });
    return { ok: false, error: res.error };
  }

  console.log("[couple-invite:ACCEPT] success", {
    couple_id: res.couple_id,
    user_id: user?.id ?? null,
  });

  revalidatePath("/[locale]/my", "page");
  revalidatePath("/[locale]/account", "page");
  return { ok: true, couple_id: res.couple_id };
}

export async function revokePendingInvitation(
  invitationId: string,
): Promise<Ok<object> | Err> {
  console.log("[couple-invite:REVOKE] start", { invitation_id: invitationId });
  if (!invitationId) {
    console.warn("[couple-invite:REVOKE] missing id");
    return { ok: false, error: "missing_id" };
  }
  const res = await revokeInvitation(invitationId);
  if (!res.ok) {
    console.warn("[couple-invite:REVOKE] failed", { error: res.error });
    return { ok: false, error: res.error };
  }
  console.log("[couple-invite:REVOKE] success", { invitation_id: invitationId });
  revalidatePath("/[locale]/account", "page");
  return { ok: true };
}
