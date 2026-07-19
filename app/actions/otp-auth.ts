"use server";

/**
 * Passwordless Email-OTP actions for the /auth pages (signup, login, and the
 * post-signup phone step). Replaces the password `signupAction`/`loginAction`.
 *
 * Mirrors the old signup profile write EXACTLY (full_name, consent, language,
 * test-user auto-claim, Brevo tag, CompleteRegistration) but:
 *   - no password anywhere,
 *   - phone is NOT collected here — a separate `saveSignupPhone` step (mockup
 *     screen 3) writes mobile+phone later, skippable,
 *   - user creation + sign-in are done by Supabase OTP (see lib/auth/otp-core).
 */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fireCompleteRegistrationCapi } from "@/lib/analytics/meta-capi";
import { sendEmailOtp, verifyEmailOtp, finalizeOtpSession, isFirstRegistration, hasMobileOnFile, syncConsentedContactToBrevo, type SendOtpResult } from "@/lib/auth/otp-core";

type ActionResult<T = unknown> = ({ success: true } & T) | { success: false; error: string };

// ── Signup: send code ─────────────────────────────────────────────────────────

export async function sendAuthSignupOtp(args: {
  email: string;
  fullName: string;
  termsAccepted: boolean;
}): Promise<SendOtpResult> {
  if (!args.fullName.trim()) return { ok: false, error: "יש למלא שם מלא." };
  if (!args.termsAccepted) return { ok: false, error: "יש לאשר את תנאי השימוש ומדיניות הפרטיות." };
  return sendEmailOtp({ email: args.email, mode: "signup", fullName: args.fullName });
}

// ── Signup: verify code → create session + profile + analytics ────────────────

export async function verifyAuthSignupOtp(args: {
  email: string;
  token: string;
  fullName: string;
  marketingConsent: boolean;
  termsAccepted: boolean;
  preferredLanguage?: string;
}): Promise<ActionResult<{ userId: string; phoneOnFile: boolean; isFirst: boolean }>> {
  if (!args.termsAccepted) return { success: false, error: "יש לאשר את תנאי השימוש ומדיניות הפרטיות." };

  const verified = await verifyEmailOtp({ email: args.email, token: args.token });
  if (!verified.ok) return { success: false, error: verified.error };
  const { userId, email } = verified;

  try {
    // Custom single-device session (Supabase session already set by verifyOtp).
    await finalizeOtpSession(userId);

    const admin = createAdminSupabaseClient();
    const nowIso = new Date().toISOString();
    const lang = args.preferredLanguage === "en" ? "en" : "he";
    const isFirst = await isFirstRegistration(userId);

    // ── Marketing consent: STICKY-POSITIVE (mirrors the full_name rule). A
    // checked box always records consent=true (new OR returning account —
    // consenting once is enough and persists). An unchecked box NEVER writes
    // false: we must not overwrite an existing true, and consent only becomes
    // false via an explicit unsubscribe elsewhere. For a brand-new account the
    // identity upsert below seeds the default (unchecked → false), which is the
    // initial state, not an overwrite — so the sticky write here only needs to
    // cover a RETURNING account flipping false→true.
    if (args.marketingConsent && !isFirst) {
      await admin.from("profiles").update(
        { marketing_consent: true, marketing_consent_at: nowIso, marketing_consent_source: "signup_otp" },
      ).eq("id", userId);
      // Consent must reach Brevo (the sending platform) or it's meaningless.
      await syncConsentedContactToBrevo(admin, userId, email, lang);
    }

    // Everything below writes IDENTITY (name/terms/language) or fires new-signup
    // analytics — do it ONLY for a genuinely NEW account. An existing user who
    // typed their email in the signup form is just logged in; we must NOT
    // overwrite their profiles.full_name or re-fire CompleteRegistration.
    if (isFirst) {
      const fullName = args.fullName.trim();

      // Profile: name + consent seed + language. Phone is added later (screen 3).
      await admin.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName,
          marketing_consent: args.marketingConsent,
          marketing_consent_at: args.marketingConsent ? nowIso : null,
          marketing_consent_source: args.marketingConsent ? "signup_otp" : null,
          terms_accepted: true,
          terms_accepted_at: nowIso,
          preferred_language: lang,
        },
        { onConflict: "id" },
      );

      // Test-user invitation auto-claim (mirrors signupAction; non-fatal).
      try {
        const { data: invite } = await admin
          .from("test_user_invitations")
          .select("email, note, invited_by")
          .eq("email", email.toLowerCase())
          .is("claimed_at", null)
          .maybeSingle();
        if (invite) {
          const inv = invite as { email: string; note: string | null; invited_by: string | null };
          await admin.from("profiles").update({
            is_test_user: true,
            test_user_note: inv.note,
            test_user_marked_at: nowIso,
            test_user_marked_by: inv.invited_by,
          }).eq("id", userId);
          await admin.from("test_user_invitations").update({ claimed_at: nowIso, claimed_user_id: userId }).eq("email", inv.email);
        }
      } catch (claimErr) {
        console.warn("[otp signup] test-user claim failed (non-fatal)", claimErr);
      }

      // Brevo — consent-gated, non-fatal (Israeli Communications Act §30A).
      if (args.marketingConsent) await syncConsentedContactToBrevo(admin, userId, email, lang);

      // CompleteRegistration — new account only. Phone not yet known → omitted.
      await fireCompleteRegistrationCapi({ userId, email });
    }

    // Skip the phone step entirely if we already have a number (repeat signup
    // into an existing account that has a mobile) — never re-ask.
    const phoneOnFile = await hasMobileOnFile(userId);
    // `isFirst` surfaces to the client so OtpFlow can fire the GTM `sign_up`
    // conversion for a GENUINELY new account only — a returning user who typed
    // their email in the signup form is just logged in (isFirst=false) and must
    // not be counted as a sign-up.
    return { success: true, userId, phoneOnFile, isFirst };
  } catch (err) {
    console.error("[otp signup] finalize failed", err);
    return { success: false, error: err instanceof Error ? `שגיאה: ${err.message}` : "שגיאה בהרשמה." };
  }
}

// ── Signup: phone step (screen 3) — optional/skippable ────────────────────────

export async function saveSignupPhone(args: { phone: string }): Promise<ActionResult> {
  const phone = args.phone.trim();
  if (!phone) return { success: false, error: "יש למלא מספר נייד." };
  try {
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { success: false, error: "לא מחוברים." };
    const admin = createAdminSupabaseClient();
    // Write BOTH columns — the profile-completeness gate reads `mobile`, legacy
    // readers use `phone` (see phone-gate audit).
    await admin.from("profiles").update({ phone, mobile: phone }).eq("id", auth.user.id);
    return { success: true };
  } catch (err) {
    console.error("[otp signup] saveSignupPhone failed", err);
    return { success: false, error: "לא הצלחנו לשמור. נסו שוב." };
  }
}

// ── Login: send code ──────────────────────────────────────────────────────────

export async function sendAuthLoginOtp(args: { email: string }): Promise<SendOtpResult> {
  return sendEmailOtp({ email: args.email, mode: "login" });
}

// ── Login: verify code → session (no consent, no CompleteRegistration) ────────

export async function verifyAuthLoginOtp(args: {
  email: string;
  token: string;
}): Promise<ActionResult<{ isAdmin: boolean }>> {
  const verified = await verifyEmailOtp({ email: args.email, token: args.token });
  if (!verified.ok) return { success: false, error: verified.error };

  try {
    await finalizeOtpSession(verified.userId);
    const admin = createAdminSupabaseClient();
    const { data: prof } = await admin.from("profiles").select("role").eq("id", verified.userId).maybeSingle();
    const isAdmin = (prof as { role?: string } | null)?.role === "admin";
    return { success: true, isAdmin };
  } catch (err) {
    console.error("[otp login] finalize failed", err);
    return { success: false, error: "ההתחברות נכשלה. נסו שוב." };
  }
}
