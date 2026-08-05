import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SurveyFlow } from "@/components/survey/SurveyFlow";
import { SurveyPageViewPixel } from "@/components/analytics/SurveyPageViewPixel";
import { getPollUserId } from "@/lib/poll/anon";
import { getOtpConsentCopy } from "@/lib/auth/otp-consent";
import { buildAlternates } from "@/lib/seo/alternates";
import { breadcrumbJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";

export const dynamic = "force-dynamic";

const TITLE = "סקר הזוגיות של ישראל · מיאושי";
const DESCRIPTION =
  "ענו על שאלות הסקר וראו מיד מה זוגות אחרים בישראל ענו. חינם ואנונימי, בקצב שלכם.";

export function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Metadata {
  const locale = params.locale === "en" ? "en" : "he";
  return {
    title: TITLE,
    description: DESCRIPTION,
    // Was emitting neither, like /relationship-survey.
    alternates: buildAlternates(locale, "/survey"),
  };
}

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            ...breadcrumbJsonLd(locale, [
              { name: "סקר הזוגיות של ישראל", path: "/survey" },
            ]),
          }),
        }}
      />
      {/* Server-rendered heading + intro.
          ────────────────────────────────────────────────────────────────────
          The whole page below is <SurveyFlow>, a client component that renders
          nothing until it has fetched a question — so the delivered HTML was 39
          words with no <h1> at all, i.e. an empty document to a crawler that
          does not execute JS.
          It is `sr-only` rather than visible because the flow is deliberately a
          single card with one question on it: pushing that card down the page
          is exactly the friction the survey rebuild removed. Same pattern and
          same reasoning as the sr-only h1 already on /pricing.
          This makes the page legible to a crawler; it does not make it a rich
          document. Real body copy is a content task, not a markup one. */}
      <div className="sr-only">
        <h1>סקר הזוגיות של ישראל</h1>
        <p>
          שאלות קצרות על הזוגיות בישראל, ומיד אחרי כל תשובה רואים מה זוגות אחרים
          ענו. הסקר חינמי ואנונימי, עונים בקצב שלכם ועוצרים מתי שרוצים — ואפשר
          לענות ולראות תוצאות בלי הרשמה.
        </p>
      </div>
      <SurveyFlow back={{ href: `/${locale}` }} consent={consent} locale={locale} />
    </>
  );
}
