"use client";

import { motion } from "framer-motion";
import { OtpFlow } from "@/components/auth/OtpFlow";
import type { OtpConsentCopy } from "@/lib/auth/otp-consent";
import type { Locale } from "@/lib/assessments/types";
import {
  sendAssessmentSignupOtp,
  verifyAssessmentSignupOtp,
  sendAssessmentLoginOtp,
  verifyAssessmentLoginOtp,
} from "@/app/actions/otp-assessment";
import { saveSignupPhone } from "@/app/actions/otp-auth";

interface Props {
  locale: Locale;
  deviceId: string;
  assessmentId: string;
  consent: OtpConsentCopy;
  onAuthenticated: () => void;
}

/**
 * Post-assessment registration — passwordless Email OTP via the shared OtpFlow
 * with the assessment action set (claims the anon assessment_sessions for this
 * device+assessment, emits the registered marker, CompleteRegistration
 * content_name "assessment"). The results-ready header + trust badges stay.
 */
export function AssessmentInlineAuthStep({ locale, deviceId, assessmentId, consent, onAuthenticated }: Props) {
  const isHe = locale === "he";
  const t = (he: string, en: string) => (isHe ? he : en);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      dir={isHe ? "rtl" : "ltr"}
      className="flex w-full max-w-2xl flex-col items-center gap-6"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-2xl font-bold text-white md:text-3xl">
          {t("סיימתם! התוצאות מוכנות 🎉", "Done! Your results are ready 🎉")}
        </h2>
        <p className="max-w-md text-sm text-white/60">
          {t("השאירו פרטים כדי לראות את האבחון האישי שלכם ולקבל את ההמלצות.", "Leave your details to see your personal results and recommendations.")}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {[t("חינמי לחלוטין", "Completely free"), t("התוצאות נשמרות עבורכם", "Your results are saved")].map((b) => (
          <span key={b} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/60">{b}</span>
        ))}
      </div>

      <OtpFlow
        initialMode="signup"
        locale={locale}
        consent={consent}
        api={{
          sendSignup: sendAssessmentSignupOtp,
          verifySignup: (a) => verifyAssessmentSignupOtp({ ...a, deviceId, assessmentId, language: locale }),
          sendLogin: sendAssessmentLoginOtp,
          verifyLogin: (a) => verifyAssessmentLoginOtp({ ...a, deviceId, assessmentId }),
          savePhone: saveSignupPhone,
        }}
        onAuthenticated={onAuthenticated}
      />
    </motion.div>
  );
}
