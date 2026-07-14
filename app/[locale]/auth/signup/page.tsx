import { AuthBackground } from "@/components/auth/AuthBackground";
import { OtpFlow } from "@/components/auth/OtpFlow";
import { getOtpConsentCopy } from "@/lib/auth/otp-consent";

export const dynamic = "force-dynamic";

/**
 * Signup — passwordless Email OTP (name + email + consent → 6-digit code →
 * phone step, skippable). `next` pass-through preserved; `code` (partner
 * pair-code auto-redeem) is a follow-up on top of the core OTP flow.
 */
export default async function SignupPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string; code?: string };
}) {
  const locale = params.locale === "en" ? "en" : "he";
  const consent = await getOtpConsentCopy(locale);
  return (
    <AuthBackground>
      <OtpFlow initialMode="signup" locale={locale} next={searchParams.next} consent={consent} theme="dark" />
    </AuthBackground>
  );
}
