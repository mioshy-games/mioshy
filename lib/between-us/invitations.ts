// ============================================================
// Couple-invitation helpers
// ============================================================
// Backs the email-based partner invite flow:
//   buyer → enters partner email → server creates invitation +
//   calls Brevo → partner opens link → signs up/in → accepts.
// ============================================================
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type InvitationStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";

export interface CoupleInvitationRow {
  id: string;
  couple_id: string;
  inviter_user_id: string;
  invitee_email: string;
  invitee_name_hint: string | null;
  token: string;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  last_sent_at: string;
  send_count: number;
}

/**
 * Normalises an email for storage and lookup.
 * Lowercased; no further munging (we do not strip +aliases).
 */
export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * True if the given row is still actionable by the invitee.
 */
export function isInvitationRedeemable(row: CoupleInvitationRow): boolean {
  if (row.status !== "pending") return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

/**
 * Generate a URL-safe token via the DB helper (uses pgcrypto's
 * gen_random_bytes so it's cryptographically strong).
 */
async function mintToken(): Promise<string> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("generate_invitation_token");
  if (error || !data || typeof data !== "string") {
    throw new Error(error?.message ?? "Could not generate invite token");
  }
  return data;
}

/**
 * Create a pending invitation for a couple. If an active pending
 * invite already exists for this couple, we update it (rotate token +
 * extend expiry + bump send_count) rather than creating a duplicate.
 *
 * Returns the invitation row. Caller is responsible for sending
 * the email with the returned token.
 */
export async function createOrRefreshInvitation(params: {
  coupleId: string;
  inviterUserId: string;
  email: string;
  nameHint?: string | null;
}): Promise<CoupleInvitationRow> {
  const admin = createAdminSupabaseClient();
  const email = normaliseEmail(params.email);

  // Any existing pending invite for this couple?
  const { data: existing } = await admin
    .from("couple_invitations")
    .select("*")
    .eq("couple_id", params.coupleId)
    .eq("status", "pending")
    .maybeSingle();

  const newToken = await mintToken();
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  if (existing) {
    const { data: updated, error: updErr } = await admin
      .from("couple_invitations")
      .update({
        invitee_email: email,
        invitee_name_hint: params.nameHint ?? null,
        token: newToken,
        expires_at: expiresAt,
        last_sent_at: new Date().toISOString(),
        send_count: (existing.send_count as number) + 1,
        inviter_user_id: params.inviterUserId,
      })
      .eq("id", existing.id as string)
      .select("*")
      .single();
    if (updErr || !updated) {
      throw new Error(updErr?.message ?? "Could not refresh invitation");
    }
    return updated as CoupleInvitationRow;
  }

  // Enforce couple-full invariant at app level too (DB has index but
  // we want a nicer error message than a unique-index violation).
  const { count: acceptedCount } = await admin
    .from("couple_invitations")
    .select("id", { count: "exact", head: true })
    .eq("couple_id", params.coupleId)
    .eq("status", "accepted");
  if ((acceptedCount ?? 0) > 0) {
    throw new Error("Couple already has an accepted partner");
  }

  const { data: inserted, error: insErr } = await admin
    .from("couple_invitations")
    .insert({
      couple_id: params.coupleId,
      inviter_user_id: params.inviterUserId,
      invitee_email: email,
      invitee_name_hint: params.nameHint ?? null,
      token: newToken,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (insErr || !inserted) {
    throw new Error(insErr?.message ?? "Could not create invitation");
  }
  return inserted as CoupleInvitationRow;
}

/**
 * Public lookup by token — anyone with the token can see the invite's
 * basic display info (couple display name, inviter name hint, email,
 * expires_at, status). Used on the /invite/[token] landing page.
 *
 * Returns null if token not found.
 */
export async function getInvitationByToken(
  token: string,
): Promise<CoupleInvitationRow | null> {
  if (!token) return null;
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("couple_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CoupleInvitationRow) ?? null;
}

/**
 * Additional display details the landing page wants: the inviter's
 * full name + the couple's display name.
 */
export async function getInvitationDisplay(token: string): Promise<
  | {
      invitation: CoupleInvitationRow;
      inviter_full_name: string | null;
      couple_display_name: string | null;
    }
  | null
> {
  const invitation = await getInvitationByToken(token);
  if (!invitation) return null;
  const admin = createAdminSupabaseClient();

  const [{ data: couple }, { data: profile }] = await Promise.all([
    admin
      .from("couples")
      .select("display_name")
      .eq("id", invitation.couple_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name")
      .eq("id", invitation.inviter_user_id)
      .maybeSingle(),
  ]);

  return {
    invitation,
    inviter_full_name: (profile?.full_name as string | null) ?? null,
    couple_display_name: (couple?.display_name as string | null) ?? null,
  };
}

/**
 * Accept the invitation — called after the user is signed in.
 * Wraps the SECURITY DEFINER RPC which atomically inserts into
 * couple_members and marks the invitation accepted.
 */
export async function acceptInvitationForCurrentUser(
  token: string,
): Promise<{ ok: true; couple_id: string } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  const { data, error } = await supabase.rpc("accept_couple_invitation", {
    p_token: token,
  });
  if (error || !data) {
    const msg = error?.message ?? "";
    const friendly = msg.includes("not found")
      ? "invitation_not_found"
      : msg.includes("already in a couple")
        ? "already_in_couple"
        : msg.includes("expired")
          ? "invitation_expired"
          : msg.includes("status")
            ? "invitation_not_pending"
            : msg || "accept_failed";
    return { ok: false, error: friendly };
  }

  return { ok: true, couple_id: data as string };
}

/**
 * Inviter (or admin) revokes a pending invitation.
 */
export async function revokeInvitation(
  invitationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  // Use service-role so the row mutation isn't blocked by RLS when we
  // also want to bump revoked_by_user_id etc.
  const admin = createAdminSupabaseClient();

  const { data: row } = await admin
    .from("couple_invitations")
    .select("id, inviter_user_id, status")
    .eq("id", invitationId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (row.status !== "pending") {
    return { ok: false, error: "not_pending" };
  }
  // Only the original inviter can revoke. Admin check done elsewhere.
  if (row.inviter_user_id !== user.id) {
    return { ok: false, error: "forbidden" };
  }

  const { error } = await admin
    .from("couple_invitations")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: user.id,
    })
    .eq("id", invitationId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * List all invitations for a couple (for the account page and admin view).
 */
export async function listInvitationsForCouple(
  coupleId: string,
): Promise<CoupleInvitationRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("couple_invitations")
    .select("*")
    .eq("couple_id", coupleId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CoupleInvitationRow[] | null) ?? [];
}

/**
 * Get the (at most one) currently-pending invitation for a couple, or
 * null when there isn't one. Unique partial index on couple_id where
 * status='pending' guarantees at most one row.
 */
export async function getPendingInvitationForCouple(
  coupleId: string,
): Promise<CoupleInvitationRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("couple_invitations")
    .select("*")
    .eq("couple_id", coupleId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CoupleInvitationRow | null) ?? null;
}

/**
 * Small summary shape used by UI components that show invitation state
 * (InvitePartnerByEmail, account page, my library card).
 */
export interface InvitationUiSummary {
  id: string;
  email: string;
  status: InvitationStatus;
  expires_at: string;
  last_sent_at: string;
  send_count: number;
}

export function toInvitationUiSummary(
  row: CoupleInvitationRow | null,
): InvitationUiSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.invitee_email,
    status: row.status,
    expires_at: row.expires_at,
    last_sent_at: row.last_sent_at,
    send_count: row.send_count,
  };
}
