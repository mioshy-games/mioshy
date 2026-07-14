import { AuthBackground } from "@/components/auth/AuthBackground";
import { OtpFlow } from "@/components/auth/OtpFlow";
import { getOtpConsentCopy } from "@/lib/auth/otp-consent";

export const dynamic = "force-dynamic";

/**
 * Login — passwordless Email OTP (email → 6-digit code → in). `next` is the
 * post-auth destination pass-through (e.g. the /adults purchase flow). `code`
 * (partner pair-code) and the `kicked` banner are preserved for a follow-up;
 * the core OTP login is here.
 */
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { kicked?: string; next?: string; code?: string };
}) {
  const locale = params.locale === "en" ? "en" : "he";
  const consent = await getOtpConsentCopy(locale);
  return (
    <AuthBackground>
      <OtpFlow initialMode="login" locale={locale} next={searchParams.next} consent={consent} />
    </AuthBackground>
  );
}
