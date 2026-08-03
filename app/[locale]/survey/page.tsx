import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SurveyFlow } from "@/components/survey/SurveyFlow";
import { SurveyPageViewPixel } from "@/components/analytics/SurveyPageViewPixel";
import { getPollUserId } from "@/lib/poll/anon";
import { getOtpConsentCopy } from "@/lib/auth/otp-consent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "סקר הזוגיות של ישראל · מיאושי",
  description: "כל יום שאלה אחת על הזוגיות, ורואים מיד מה זוגות אחרים בישראל ענו.",
};

export default async function SurveyPage({ params }: { params: { locale: string } }) {
  // A signed-in user experiences the survey INSIDE the dashboard — never the
  // public marketing page. Redirect every entry point (public header, services
  // strip, direct link) to /my/survey. Anonymous visitors get the public flow.
  const userId = await getPollUserId();
  // Don't bounce a user who just authenticated INLINE and is still on the OTP
  // phone step (screen 3). The verify action's cookie set triggers a soft refresh
  // that would otherwise redirect them to /my/survey and skip the phone step.
  // OtpFlow clears this cookie once the phone step is done → the redirect resumes.
  const phonePending = cookies().get("otp_phone_pending")?.value === "1";
  if (userId && !phonePending) redirect(`/${params.locale}/my/survey`);

  const locale = params.locale === "en" ? "en" : "he";
  const consent = await getOtpConsentCopy(locale);

  // Anon marketing flow: header stays, footer hidden (see Chrome), floating
  // back → the marketing homepage. Join form = passwordless OTP.
  return (
    <>
      <SurveyPageViewPixel locale={locale} />
      <SurveyFlow back={{ href: `/${locale}` }} consent={consent} locale={locale} />
    </>
  );
}
