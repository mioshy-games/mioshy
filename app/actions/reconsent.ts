"use server";

/**
 * Re-consent popup actions (results-summary page, components/journey/ReconsentPrompt).
 *
 * A separate action from signupAction — the existing signup flow is NOT touched.
 * Eligibility + writes mirror the signup consent mechanism (same profiles
 * columns), gated server-side so the client can never bypass them.
 *
 *  - checkReconsentEligibility(): true only for a signed-in user whose
 *    marketing_consent is not true AND who hasn't answered the popup yet
 *    (reconsent_prompt_shown_at is null).
 *  - submitReconsent(accept): "yes" writes full marketing + WhatsApp consent
 *    with source 'reconsent_popup' and runs the same Brevo sync signup does;
 *    "later" only stamps reconsent_prompt_shown_at (no consent change). Both
 *    stamp reconsent_prompt_shown_at so the popup never shows again.
 *
 * The disclosure line is shown right next to the "yes" button in the modal, so
 * clicking it is a valid active opt-in. The audit trail is the *_source + *_at
 * columns (no separate table needed).
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { tagAsRegistered } from "@/lib/email/brevo-segments-sync";
import { isTestUser } from "@/lib/auth/is-test-user";

const CONSENT_SOURCE = "reconsent_popup";

export async function checkReconsentEligibility(): Promise<{ eligible: boolean }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { eligible: false };

  const admin = createAdminSupabaseClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("marketing_consent, reconsent_prompt_shown_at")
    .eq("id", user.id)
    .maybeSingle<{
      marketing_consent: boolean | null;
      reconsent_prompt_shown_at: string | null;
    }>();

  if (!profile) return { eligible: false };
  const eligible =
    profile.marketing_consent !== true && !profile.reconsent_prompt_shown_at;
  return { eligible };
}

export async function submitReconsent(
  accept: boolean,
): Promise<{ success: boolean }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const admin = createAdminSupabaseClient();
  const nowIso = new Date().toISOString();

  // Re-check server-side so a stale/duplicate submit can't re-consent someone
  // who already opted in or already answered.
  const { data: profile } = await admin
    .from("profiles")
    .select("marketing_consent, reconsent_prompt_shown_at, preferred_language")
    .eq("id", user.id)
    .maybeSingle<{
      marketing_consent: boolean | null;
      reconsent_prompt_shown_at: string | null;
      preferred_language: string | null;
    }>();
  if (!profile) return { success: false };

  const grantConsent = accept && profile.marketing_consent !== true;

  if (grantConsent) {
    // Same fields signupAction / journey-inline-signup write, source tagged.
    await admin
      .from("profiles")
      .update({
        marketing_consent: true,
        marketing_consent_at: nowIso,
        marketing_consent_source: CONSENT_SOURCE,
        whatsapp_opt_in: true,
        whatsapp_opt_in_at: nowIso,
        whatsapp_opt_in_source: CONSENT_SOURCE,
        reconsent_prompt_shown_at: nowIso,
      })
      .eq("id", user.id);

    // Same Brevo sync signup runs when consent is given (Communications Act
    // §30A). Fire-and-forget — a Brevo outage must never fail the action.
    // Test accounts (profiles.is_test_user) are excluded from Brevo tagging,
    // matching the other tagAsRegistered sites (re-engagement guard A).
    try {
      const email = user.email ?? "";
      const lang: "he" | "en" = profile.preferred_language === "en" ? "en" : "he";
      if (email && !(await isTestUser(admin, user.id))) {
        const r = await tagAsRegistered(email, user.id, lang);
        if (!r.success) {
          console.warn("[reconsent] tagAsRegistered non-success:", r.error);
        }
      }
    } catch (err) {
      console.error("[reconsent] Brevo sync failed", err);
    }
  } else {
    // "later" (or already-consented) — only suppress future prompts.
    await admin
      .from("profiles")
      .update({ reconsent_prompt_shown_at: nowIso })
      .eq("id", user.id);
  }

  return { success: true };
}
