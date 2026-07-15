"use server";

import { getOtpConsentCopy, type OtpConsentCopy } from "@/lib/auth/otp-consent";

/**
 * Client-callable wrapper for the unified OTP consent copy — used by client-only
 * auth surfaces (RegistrationModal, SubscriptionModal) that render OtpFlow but
 * can't be handed server-resolved props. The page-embedded surfaces still pass
 * `consent` as a prop; this is only for the in-modal cases.
 */
export async function fetchOtpConsentCopy(locale: string): Promise<OtpConsentCopy> {
  return getOtpConsentCopy(locale === "en" ? "en" : "he");
}
