import "server-only";

import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

export type OtpConsentCopy = {
  termsPrefix: string;
  termsLink: string;
  termsAnd: string;
  privacyLink: string;
  termsSuffix: string;
  marketingConsent: string;
};

/**
 * The ONE consent copy for every OTP surface (decision: unify on the journey
 * inline-auth text, CMS-editable). Resolved server-side (cms_texts row → JSON
 * fallback) and passed as props to the client OtpFlow, so no CmsTextProvider is
 * needed on /auth / survey / assessment. Edit live at /admin/content
 * (page "journey", keys journeyAssessment.inlineAuth.*).
 */
export async function getOtpConsentCopy(locale: "he" | "en"): Promise<OtpConsentCopy> {
  const t = await getCmsTranslations({ locale, namespace: "journeyAssessment.inlineAuth", page: "journey" });
  return {
    termsPrefix: t("termsPrefix"),
    termsLink: t("termsLink"),
    termsAnd: t("termsAnd"),
    privacyLink: t("privacyLink"),
    termsSuffix: t("termsSuffix"),
    marketingConsent: t("marketingConsent"),
  };
}
