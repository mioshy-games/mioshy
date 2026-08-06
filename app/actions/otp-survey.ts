"use server";

/**
 * Survey (סקר) passwordless OTP actions — the OTP equivalent of poll-signup.ts.
 * Same post-auth work (link the anon's saved votes, subscribe to the daily
 * question, Lead + CompleteRegistration with content_name "relationship_survey")
 * but createUser+password is replaced by Email OTP. Used by PollRegister via
 * the embedded OtpFlow.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { readPollAnonId } from "@/lib/poll/anon";
import { fireCompleteRegistrationCapi, firePollLeadCapi, metaEventId } from "@/lib/analytics/meta-capi";
import { sendEmailOtp, verifyEmailOtp, finalizeOtpSession, isFirstRegistration, hasMobileOnFile, syncConsentedContactToBrevo, type SendOtpResult } from "@/lib/auth/otp-core";
import { fullNameSchema } from "@/lib/validations";

type Result = { success: true; phoneOnFile?: boolean } | { success: false; error: string };

/** Link any votes cast under the anon cookie to this user (idempotent). */
async function linkAnonVotes(admin: ReturnType<typeof createAdminSupabaseClient>, userId: string) {
  const anonId = await readPollAnonId();
  if (anonId) {
    await admin.from("poll_votes").update({ user_id: userId }).eq("anon_id", anonId).is("user_id", null);
  }
}

export async function sendSurveySignupOtp(args: {
  email: string;
  fullName: string;
  termsAccepted: boolean;
}): Promise<SendOtpResult> {
  if (!args.fullName.trim()) return { ok: false, error: "יש למלא שם מלא." };
  if (!args.termsAccepted) return { ok: false, error: "יש לאשר את תנאי השימוש ומדיניות הפרטיות." };
  // §6 — "submit form" Lead (CAPI), deduped with the browser Pixel Lead via the
  // shared event_id (keyed by email). Never blocks the send.
  try {
    await firePollLeadCapi({ email: args.email.trim().toLowerCase(), eventId: metaEventId.lead(args.email.trim().toLowerCase()) });
  } catch { /* never blocks */ }
  return sendEmailOtp({ email: args.email, mode: "signup", fullName: args.fullName });
}

export async function verifySurveySignupOtp(args: {
  email: string;
  token: string;
  fullName: string;
  marketingConsent: boolean;
  termsAccepted: boolean;
}): Promise<Result> {
  if (!args.termsAccepted) return { success: false, error: "יש לאשר את תנאי השימוש." };
  const v = await verifyEmailOtp({ email: args.email, token: args.token });
  if (!v.ok) return { success: false, error: v.error };

  try {
    const admin = createAdminSupabaseClient();
    const nowIso = new Date().toISOString();
    const isFirst = await isFirstRegistration(v.userId);
    // Anon vote-linking + subscribe apply to new AND existing users.
    await linkAnonVotes(admin, v.userId);
    await admin.from("poll_subscriptions").upsert({ user_id: v.userId, subscribed: true, updated_at: nowIso }, { onConflict: "user_id" });
    await finalizeOtpSession(v.userId);
    // Marketing consent: STICKY-POSITIVE (mirrors full_name). Checked → record
    // true for a RETURNING account too (never overwrite true→false; consent only
    // goes false via explicit unsubscribe). A new account is seeded by the
    // identity upsert below.
    if (args.marketingConsent && !isFirst) {
      await admin.from("profiles").update(
        { marketing_consent: true, marketing_consent_at: nowIso, marketing_consent_source: "poll_signup" },
      ).eq("id", v.userId);
    }
    // Identity (name) + consent seed + CompleteRegistration — NEW account only;
    // never overwrite an existing profile's full_name.
    if (isFirst) {
      // SECURITY: sendEmailOtp validated the name at the send step, but this
      // action receives fullName from the client again and is what persists it.
      // Audit 2026-08-05, CRITICAL #5.
      const nameCheck = fullNameSchema.safeParse(args.fullName);
      if (!nameCheck.success) {
        return { success: false, error: nameCheck.error.issues[0]?.message ?? "השם מכיל תווים לא חוקיים" };
      }
      await admin.from("profiles").upsert(
        {
          id: v.userId,
          full_name: nameCheck.data,
          marketing_consent: args.marketingConsent,
          marketing_consent_at: args.marketingConsent ? nowIso : null,
          marketing_consent_source: args.marketingConsent ? "poll_signup" : null,
          terms_accepted: true,
          terms_accepted_at: nowIso,
        },
        { onConflict: "id" },
      );
      await fireCompleteRegistrationCapi({ userId: v.userId, email: v.email, contentName: "relationship_survey" });
    }
    // Consent → Brevo (sending platform), whenever it's true — new or re-consent.
    if (args.marketingConsent) await syncConsentedContactToBrevo(admin, v.userId, v.email, "he");
    return { success: true, phoneOnFile: await hasMobileOnFile(v.userId) };
  } catch (err) {
    console.error("[otp survey] finalize failed", err);
    return { success: false, error: err instanceof Error ? `שגיאה: ${err.message}` : "שגיאה בהרשמה." };
  }
}

export async function sendSurveyLoginOtp(args: { email: string }): Promise<SendOtpResult> {
  return sendEmailOtp({ email: args.email, mode: "login" });
}

export async function verifySurveyLoginOtp(args: { email: string; token: string }): Promise<Result> {
  const v = await verifyEmailOtp({ email: args.email, token: args.token });
  if (!v.ok) return { success: false, error: v.error };
  try {
    const admin = createAdminSupabaseClient();
    await linkAnonVotes(admin, v.userId);
    await finalizeOtpSession(v.userId);
    return { success: true };
  } catch (err) {
    console.error("[otp survey] login finalize failed", err);
    return { success: false, error: "ההתחברות נכשלה. נסו שוב." };
  }
}
