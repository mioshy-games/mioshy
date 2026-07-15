import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { blacklistContact } from "@/lib/email/brevo-segments-sync";

// ============================================================
// One place that performs a marketing unsubscribe (Itzik 2026-07-16).
// Called from the tokenized unsubscribe page (click + confirm) and the RFC 8058
// List-Unsubscribe one-click endpoint. The DB is the source of truth; the Brevo
// suppression is best-effort (never blocks the opt-out from being recorded).
// ============================================================

export interface UnsubscribeResult {
  ok: boolean;
  /** Recipient email (resolved for the Brevo suppression), when available. */
  email: string | null;
}

/**
 * Flip marketing + WhatsApp consent OFF for a user and suppress them in Brevo.
 * Idempotent — running it twice is harmless.
 */
export async function performUnsubscribe(
  userId: string,
): Promise<UnsubscribeResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, email: null };
  const now = new Date().toISOString();

  // Resolve the email (auth.users) — needed only for the Brevo suppression.
  let email: string | null = null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    email = data?.user?.email ?? null;
  } catch {
    /* email stays null → the DB opt-out below still records */
  }

  // 1) DB consent OFF — the source of truth. Marketing + WhatsApp both off, with
  //    audit timestamps + source so the opt-out is provable.
  const { error } = await admin
    .from("profiles")
    .update({
      marketing_consent: false,
      marketing_consent_at: now,
      marketing_consent_source: "email_unsubscribe",
      whatsapp_opt_in: false,
      whatsapp_opt_out_at: now,
    })
    .eq("id", userId);
  if (error) {
    console.error("[unsubscribe] profile update failed", error.message);
    return { ok: false, email };
  }

  // 2) Brevo suppression — best-effort; the DB flip above already stops our own
  //    sends via the consent gate.
  if (email) {
    try {
      await blacklistContact(email);
    } catch (e) {
      console.error("[unsubscribe] Brevo blacklist failed (non-fatal)", e);
    }
  }

  return { ok: true, email };
}
