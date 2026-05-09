/**
 * /[locale]/journey/assessment/intro
 *
 * Layer-1 pre-assessment screen. Sets expectations + asks for a small
 * joint commitment + states the privacy contract.
 *
 * Three blocks:
 *   1. "10 minutes a week × 4 weeks" — duration card
 *   2. "Each of you answers separately. We don't share answers between you." — privacy
 *   3. Pact commitment — "I'm in" button that POSTs the action
 *
 * After the user commits, redirects to /journey/assessment which
 * begins the questionnaire.
 *
 * If the user already has a pact, this page redirects straight through
 * to the assessment — no re-asking.
 */

import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getCurrentUserPact } from "@/lib/journey/pacts";
import { JourneyAssessmentIntro } from "@/components/journey/JourneyAssessmentIntro";

export const dynamic = "force-dynamic";

export default async function AssessmentIntroPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const isHe = locale === "he";

  // Already committed? Skip straight to the assessment.
  const existingPact = await getCurrentUserPact();
  if (existingPact) {
    redirect(`/${locale}/journey/assessment`);
  }

  return <JourneyAssessmentIntro isHe={isHe} locale={locale} />;
}
