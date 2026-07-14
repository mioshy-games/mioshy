"use server";

/**
 * Assessment (אבחון) passwordless OTP actions — the OTP equivalent of
 * assessment-inline-signup.ts. Claims the anon assessment_sessions for the
 * device+assessment, emits the `assessment_registered` marker, and fires
 * CompleteRegistration (content_name "assessment"). Consent columns are now
 * written too (the unified OTP signup collects them). Driven by
 * AssessmentInlineAuthStep via the embedded OtpFlow.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { fireCompleteRegistrationCapi } from "@/lib/analytics/meta-capi";
import { sendEmailOtp, verifyEmailOtp, finalizeOtpSession, isFirstRegistration, type SendOtpResult } from "@/lib/auth/otp-core";

type Result = { success: true } | { success: false; error: string };

async function claimSessions(admin: ReturnType<typeof createAdminSupabaseClient>, userId: string, deviceId: string, assessmentId: string) {
  const { error } = await admin.from("assessment_sessions").update({ user_id: userId, device_id: null, last_activity_at: new Date().toISOString() })
    .eq("device_id", deviceId).eq("assessment_id", assessmentId).is("user_id", null);
  if (error) console.warn("[otp assessment] session claim failed (non-fatal)", error.message);
}

export async function sendAssessmentSignupOtp(args: { email: string; fullName: string; termsAccepted: boolean }): Promise<SendOtpResult> {
  if (!args.fullName.trim()) return { ok: false, error: "יש למלא שם מלא." };
  if (!args.termsAccepted) return { ok: false, error: "יש לאשר את תנאי השימוש ומדיניות הפרטיות." };
  return sendEmailOtp({ email: args.email, mode: "signup", fullName: args.fullName });
}

export async function verifyAssessmentSignupOtp(args: {
  email: string;
  token: string;
  fullName: string;
  marketingConsent: boolean;
  termsAccepted: boolean;
  deviceId: string;
  assessmentId: string;
  language?: string;
}): Promise<Result> {
  if (!args.termsAccepted) return { success: false, error: "יש לאשר את תנאי השימוש." };
  const v = await verifyEmailOtp({ email: args.email, token: args.token });
  if (!v.ok) return { success: false, error: v.error };
  try {
    const admin = createAdminSupabaseClient();
    const nowIso = new Date().toISOString();
    const isFirst = await isFirstRegistration(v.userId);
    // Session-claim applies to new AND existing users.
    await claimSessions(admin, v.userId, args.deviceId, args.assessmentId);
    await finalizeOtpSession(v.userId);
    // Marketing consent: STICKY-POSITIVE (mirrors full_name). Checked → record
    // true for a RETURNING account too (never overwrite true→false; consent only
    // goes false via explicit unsubscribe). A new account is seeded below.
    if (args.marketingConsent && !isFirst) {
      await admin.from("profiles").update(
        { marketing_consent: true, marketing_consent_at: nowIso, marketing_consent_source: "assessment_otp" },
      ).eq("id", v.userId);
    }
    // Identity (name) + consent seed + registered marker + CompleteRegistration —
    // NEW account only; never overwrite an existing profile's full_name.
    if (isFirst) {
      await admin.from("profiles").upsert({
        id: v.userId,
        full_name: args.fullName.trim(),
        marketing_consent: args.marketingConsent,
        marketing_consent_at: args.marketingConsent ? nowIso : null,
        marketing_consent_source: args.marketingConsent ? "assessment_otp" : null,
        terms_accepted: true,
        terms_accepted_at: nowIso,
        preferred_language: args.language === "en" ? "en" : "he",
      }, { onConflict: "id" });
      await admin.from("analytics_events").insert({
        event: "assessment_registered", session_id: null, device_id: args.deviceId,
        user_id: v.userId, locale: args.language ?? null, properties: { assessment_id: args.assessmentId },
      });
      await fireCompleteRegistrationCapi({ userId: v.userId, email: v.email, contentName: "assessment" });
    }
    return { success: true };
  } catch (err) {
    console.error("[otp assessment] finalize failed", err);
    return { success: false, error: err instanceof Error ? `שגיאה: ${err.message}` : "שגיאה בהרשמה." };
  }
}

export async function sendAssessmentLoginOtp(args: { email: string }): Promise<SendOtpResult> {
  return sendEmailOtp({ email: args.email, mode: "login" });
}

export async function verifyAssessmentLoginOtp(args: { email: string; token: string; deviceId: string; assessmentId: string }): Promise<Result> {
  const v = await verifyEmailOtp({ email: args.email, token: args.token });
  if (!v.ok) return { success: false, error: v.error };
  try {
    const admin = createAdminSupabaseClient();
    await claimSessions(admin, v.userId, args.deviceId, args.assessmentId);
    await finalizeOtpSession(v.userId);
    return { success: true };
  } catch (err) {
    console.error("[otp assessment] login finalize failed", err);
    return { success: false, error: "ההתחברות נכשלה. נסו שוב." };
  }
}
