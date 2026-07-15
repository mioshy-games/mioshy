"use server";

/**
 * Journey (מסע) passwordless OTP actions — the OTP equivalent of
 * journey-inline-signup.ts. Auth is Email OTP; all the journey post-auth work
 * (profile + WhatsApp/consent, deterministic anon-journey claiming, marker,
 * CompleteRegistration content_name "journey") runs through the shared
 * finalizeJourneySignup helper. Phone is deferred (collected in the OTP phone
 * step). The single marketing checkbox consents to BOTH email + WhatsApp.
 */

import { sendEmailOtp, verifyEmailOtp, finalizeOtpSession, hasMobileOnFile, type SendOtpResult } from "@/lib/auth/otp-core";
import { finalizeJourneySignup } from "@/lib/journey/finalize-journey-signup";

export type JourneyOtpResult = { success: true; journey: unknown; phoneOnFile?: boolean } | { success: false; error: string };

function validDevice(deviceId: string): boolean {
  return !!deviceId && deviceId.length >= 8;
}

export async function sendJourneySignupOtp(args: { email: string; fullName: string; termsAccepted: boolean }): Promise<SendOtpResult> {
  if (!args.fullName.trim()) return { ok: false, error: "יש למלא שם מלא." };
  if (!args.termsAccepted) return { ok: false, error: "יש לאשר את תנאי השימוש ומדיניות הפרטיות." };
  return sendEmailOtp({ email: args.email, mode: "signup", fullName: args.fullName });
}

export async function verifyJourneySignupOtp(args: {
  email: string;
  token: string;
  fullName: string;
  marketingConsent: boolean;
  termsAccepted: boolean;
  deviceId: string;
  language?: "he" | "en";
}): Promise<JourneyOtpResult> {
  if (!args.termsAccepted) return { success: false, error: "יש לאשר את תנאי השימוש." };
  if (!validDevice(args.deviceId)) return { success: false, error: "חסר מזהה מכשיר — רעננו ונסו שוב." };
  const v = await verifyEmailOtp({ email: args.email, token: args.token });
  if (!v.ok) return { success: false, error: v.error };
  try {
    await finalizeOtpSession(v.userId);
    const { journey } = await finalizeJourneySignup({
      userId: v.userId, email: v.email, deviceId: args.deviceId, fullName: args.fullName,
      phone: null, marketingConsent: args.marketingConsent, whatsappOptIn: args.marketingConsent,
      termsAccepted: true, language: args.language === "en" ? "en" : "he", isSignup: true, isNewUser: v.isNewUser,
    });
    return { success: true, journey, phoneOnFile: await hasMobileOnFile(v.userId) };
  } catch (err) {
    console.error("[otp journey] finalize failed", err);
    return { success: false, error: err instanceof Error ? `שגיאה: ${err.message}` : "שגיאה בהרשמה." };
  }
}

export async function sendJourneyLoginOtp(args: { email: string }): Promise<SendOtpResult> {
  return sendEmailOtp({ email: args.email, mode: "login" });
}

export async function verifyJourneyLoginOtp(args: { email: string; token: string; deviceId: string; language?: "he" | "en" }): Promise<JourneyOtpResult> {
  if (!validDevice(args.deviceId)) return { success: false, error: "חסר מזהה מכשיר — רעננו ונסו שוב." };
  const v = await verifyEmailOtp({ email: args.email, token: args.token });
  if (!v.ok) return { success: false, error: v.error };
  try {
    await finalizeOtpSession(v.userId);
    const { journey } = await finalizeJourneySignup({
      userId: v.userId, email: v.email, deviceId: args.deviceId, fullName: "",
      phone: null, marketingConsent: false, whatsappOptIn: false, termsAccepted: true,
      language: args.language === "en" ? "en" : "he", isSignup: false, isNewUser: false,
    });
    return { success: true, journey };
  } catch (err) {
    console.error("[otp journey] login finalize failed", err);
    return { success: false, error: "ההתחברות נכשלה. נסו שוב." };
  }
}
