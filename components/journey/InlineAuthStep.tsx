"use client";

import { motion } from "framer-motion";
import type { Locale } from "@/lib/journey/types";
import { CmsText } from "@/components/cms/CmsText";
import { OtpFlow } from "@/components/auth/OtpFlow";
import type { OtpConsentCopy } from "@/lib/auth/otp-consent";
import {
  sendJourneySignupOtp,
  verifyJourneySignupOtp,
  sendJourneyLoginOtp,
  verifyJourneyLoginOtp,
} from "@/app/actions/otp-journey";
import { saveSignupPhone } from "@/app/actions/otp-auth";
import { pushToDataLayer } from "@/lib/analytics/gtm";

const SANS = "var(--font-assistant), sans-serif";
const SERIF = "var(--font-frank-ruhl), serif";

interface InlineAuthStepProps {
  locale: Locale;
  deviceId: string;
  consent: OtpConsentCopy;
  onAuthenticated: () => void;
}

/**
 * Inline registration / login after 100% questionnaire completion — passwordless
 * Email OTP via the shared OtpFlow with the journey action set (deterministic
 * anon-journey claiming + WhatsApp/consent + CompleteRegistration "journey").
 * The light-theme heading + trust chips (CMS copy) are preserved; the white
 * form card is replaced by OtpFlow. The single marketing checkbox consents to
 * BOTH email + WhatsApp (unified consent copy).
 */
export function InlineAuthStep({ locale, deviceId, consent, onAuthenticated }: InlineAuthStepProps) {
  const isHe = locale === "he";
  const lang: "he" | "en" = isHe ? "he" : "en";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      dir={isHe ? "rtl" : "ltr"}
      className="w-full max-w-[720px]"
      style={{ fontFamily: SANS }}
    >
      <div className="text-center">
        <CmsText
          cmsKey="journeyAssessment.inlineAuth.headingLight"
          as="h1"
          className="text-[34px] font-black leading-tight text-[#2E2622]"
          style={{ fontFamily: SERIF }}
        />
        <CmsText
          cmsKey="journeyAssessment.inlineAuth.sub"
          as="p"
          className="mx-auto mt-3 max-w-[680px] text-[22px] font-medium leading-normal text-[#161210]"
        />
        <div className="mt-5 flex flex-wrap justify-center gap-5">
          <span className="inline-flex items-center gap-[7px] text-[15px] font-medium text-[#7B6B5E]">
            <ChipIconResults />
            <CmsText cmsKey="journeyAssessment.inlineAuth.chipResults" />
          </span>
          <span className="inline-flex items-center gap-[7px] text-[15px] font-medium text-[#7B6B5E]">
            <ChipIconSecure />
            <CmsText cmsKey="journeyAssessment.inlineAuth.chipSecure" />
          </span>
        </div>
      </div>

      <div className="mx-auto mt-6 flex justify-center">
        <OtpFlow
          initialMode="signup"
          locale={locale}
          consent={consent}
          api={{
            sendSignup: sendJourneySignupOtp,
            verifySignup: (a) => verifyJourneySignupOtp({ ...a, deviceId, language: lang }),
            sendLogin: sendJourneyLoginOtp,
            verifyLogin: (a) => verifyJourneyLoginOtp({ ...a, deviceId, language: lang }),
            savePhone: saveSignupPhone,
          }}
          onAuthenticated={onAuthenticated}
          onNewSignup={() =>
            // GTM primary lead conversion — fires once, only for a GENUINELY NEW
            // lead from the couples-assessment inline signup (OtpFlow gates on
            // the server `isFirst`). A returning user logging in here does NOT
            // fire it, so the Ads bidding optimises for real new leads.
            pushToDataLayer({
              event: "generate_lead",
              lead_source: "couples_assessment",
              currency: "ILS",
            })
          }
        />
      </div>
    </motion.div>
  );
}

function ChipIconResults() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="#7A1F2B" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function ChipIconSecure() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="#7A1F2B" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
