import { setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJourneySubscribePricing } from "@/lib/billing/journey-subscribe-pricing";
import { AnalysisSummary } from "@/components/journey/AnalysisSummary";
import type { Locale } from "@/lib/journey/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "מיאושי — בחירת מנוי",
  robots: { index: false, follow: false },
};

/**
 * /journey/subscribe — post-login subscription-selection page.
 *
 * Stage 1 (docs/journey-pricing-page-spec.md): the results_ready "7 ימי ניסיון"
 * CTA target. Requires login (→ /auth?next=… and back). Reuses AnalysisSummary
 * in mode="subscribe" (hero + score graphs + the SAME pricing/trial-checkout
 * block the assessment paywall uses — so displayed price == Cardcom charge).
 *
 * Pricing is computed server-side via getJourneySubscribePricing (the same
 * primitives the checkout uses). Scores are fetched server-side for the header;
 * when the user has no assessment, the header renders without graphs (subscribe
 * mode tolerates analysis=null).
 *
 * Stage 2 (upgrade/downgrade of an existing sub) is intentionally NOT here.
 */
export default async function JourneySubscribePage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/${locale}/auth?next=${encodeURIComponent(`/${locale}/journey/subscribe`)}`,
    );
  }

  const pricing = await getJourneySubscribePricing(user.id);
  // The subscribe hero no longer shows the score graph (Itzik 2026-07-08), and
  // subscribe mode hides every other score surface — so no assessment data is
  // needed here. Pass analysis=null (no scores fetch).

  return (
    <AnalysisSummary
      mode="subscribe"
      analysis={null}
      locale={locale as Locale}
      journeySubscribed={pricing.journeySubscribed}
      journeyCadences={pricing.journeyCadences}
      activePromo={pricing.activePromo}
      offerExpiresAt={pricing.offerExpiresAt}
      promoMode={pricing.promoMode}
    />
  );
}
