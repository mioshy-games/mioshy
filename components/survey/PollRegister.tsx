"use client";

import { OtpFlow } from "@/components/auth/OtpFlow";
import type { OtpConsentCopy } from "@/lib/auth/otp-consent";
import { metaLeadEventId } from "@/lib/analytics/meta-event-id";
import {
  sendSurveySignupOtp,
  verifySurveySignupOtp,
  sendSurveyLoginOtp,
  verifySurveyLoginOtp,
} from "@/app/actions/otp-survey";
import { saveSignupPhone } from "@/app/actions/otp-auth";
import { track } from "@/lib/analytics";

/**
 * Join the daily poll (§6) — passwordless Email OTP via the shared OtpFlow with
 * the survey action set (links anon votes, subscribes, Lead + CompleteRegistration
 * content_name "relationship_survey"). Fires the browser-Pixel Lead on "send code"
 * (deduped with the CAPI Lead via the shared event_id). Lands on the dashboard.
 */
export function PollRegister({
  consent,
  locale = "he",
  signupHeading,
  signupSubheading,
}: {
  consent: OtpConsentCopy;
  locale?: string;
  /** Surface-specific title/subtitle for the form (the survey end screen passes
   *  its own); omitted → the shared OtpFlow copy. */
  signupHeading?: string;
  signupSubheading?: string;
}) {
  const fireBrowserLead = async (email: string) => {
    if (typeof window === "undefined") return;
    // Generic click event for the "שלחו לי קוד" (send-code) button → CTA-clicks
    // dashboard. Fires on the signup send-code action (onBeforeSendSignup).
    track("click", { target: "survey_send_code", label: "שלחו לי קוד" });
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    // H7: hashed id, same derivation as the server so Meta still dedupes.
    if (fbq) fbq("track", "Lead", { content_name: "survey_join_form" }, { eventID: await metaLeadEventId(email) });
  };

  return (
    <OtpFlow
      initialMode="signup"
      locale={locale}
      consent={consent}
      signupHeading={signupHeading}
      signupSubheading={signupSubheading}
      api={{
        sendSignup: sendSurveySignupOtp,
        verifySignup: verifySurveySignupOtp,
        sendLogin: sendSurveyLoginOtp,
        verifyLogin: verifySurveyLoginOtp,
        savePhone: saveSignupPhone,
      }}
      onBeforeSendSignup={(email: string) => void fireBrowserLead(email)}
      onAuthenticated={() => { window.location.href = `/${locale}/my/survey`; }}
    />
  );
}
