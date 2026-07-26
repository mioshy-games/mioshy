import { getTranslations } from "next-intl/server";
import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJourneySubscribePricing } from "@/lib/billing/journey-subscribe-pricing";
import { AnalysisSummary } from "@/components/journey/AnalysisSummary";
import { journeyProductJsonLd, safeJsonLd } from "@/lib/seo/jsonLd";
import type { Locale } from "@/lib/journey/types";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(
    /\/+$/,
    "",
  );
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { locale } = params;
  const base = siteUrl();
  const t = await getTranslations({ locale, namespace: "pricing" });
  // 2026-05-22 — pricing.title now contains the full social-share-ready
  // headline ("מחירים · גישה מלאה לכל מיאושי..."); no longer prefixed
  // with "Mioshy — " in code.
  const title = t("title");
  const description = t("subtitle");
  let ogImageAlt = title;
  try { ogImageAlt = t("ogImageAlt"); } catch { /* fallback to title */ }

  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/pricing`,
      languages: {
        en: `${base}/en/pricing`,
        he: `${base}/he/pricing`,
        "x-default": `${base}/he/pricing`,
      },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}/pricing`,
      title,
      description,
      siteName: "Mioshy",
      locale: locale === "he" ? "he_IL" : "en_US",
      alternateLocale: locale === "he" ? ["en_US"] : ["he_IL"],
      images: [
        { url: "/opengraph-image.jpg", width: 1200, height: 630, alt: ogImageAlt },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        { url: "/twitter-image.jpg", width: 1200, height: 630, alt: ogImageAlt },
      ],
    },
  };
}

/**
 * /pricing — the Journey package-selection surface (Itzik 2026-07-16).
 * ─────────────────────────────────────────────────────────────
 * Renders the SAME package selector used on /journey/subscribe — the
 * AnalysisSummary component in mode="subscribe" (plan picker + coaching
 * checkbox + order summary + checkout CTA) — but, unlike /journey/subscribe,
 * this page is PUBLIC and INDEXABLE:
 *   • No auth redirect: anonymous visitors see the selector too.
 *   • Pricing comes from getJourneySubscribePricing(user?.id ?? null) — the
 *     same primitives the checkout uses, so displayed price == Cardcom charge.
 *     Anonymous → userless pricing (regular / campaign promo). A logged-in
 *     visitor gets their personal-window pricing.
 *   • The CTA handles auth at click time: AnalysisSummary's startCheckout
 *     redirects an anonymous user to /auth/signup?next=/pricing and back
 *     (built in), rather than gating the whole page.
 *   • SEO metadata (canonical/OG/twitter) + the sr-only h1 are preserved.
 */
export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Live promo pricing must never be frozen at build time — a statically
  // rendered /pricing could show an expired promo (displayed ≠ charged). Force
  // per-request rendering.
  noStore();
  const { locale } = await params;
  const isHe = locale === "he";

  // Public page: read the user if present, but NEVER redirect anonymous away.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Userless when anonymous; personal pricing when logged in. Same source as
  // the checkout → display == charge.
  const pricing = await getJourneySubscribePricing(user?.id ?? null);

  // Post-signup continuation: restore the plan the user picked before signup and
  // auto-continue to checkout (see AnalysisSummary auto-checkout effect).
  const sp = await searchParams;
  const initialCadence = typeof sp.cadence === "string" ? sp.cadence : undefined;
  const initialCoaching = sp.coaching === "1";
  const autoCheckout = sp.pay === "1";

  // Product/AggregateOffer schema — price range comes straight from the same
  // `pricing` the selector renders (display == charge), never a hardcoded
  // number. `t` is the pricing namespace; subtitle is already-approved copy.
  const t = await getTranslations({ locale, namespace: "pricing" });
  const productJsonLd = journeyProductJsonLd(pricing, {
    url: `${siteUrl()}/${locale}/pricing`,
    name: isHe ? "מיאושי — מסע הזוגיות" : "Mioshy — Couples Journey",
    description: t("subtitle"),
  });

  return (
    <>
      {productJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              ...productJsonLd,
            }),
          }}
        />
      )}
      {/* a11y + SEO: the page's h1 (sr-only — the selector renders its own
          subscribe-mode heading, not an h1). */}
      <h1 className="sr-only">{isHe ? "התמחור של מיאושי" : "Mioshy pricing"}</h1>
      <AnalysisSummary
        mode="subscribe"
        analysis={null}
        locale={locale as Locale}
        journeySubscribed={pricing.journeySubscribed}
        journeyCadences={pricing.journeyCadences}
        activePromo={pricing.activePromo}
        offerExpiresAt={pricing.offerExpiresAt}
        promoMode={pricing.promoMode}
        personalWindowDisplay="clock"
        initialCadence={initialCadence}
        initialCoaching={initialCoaching}
        autoCheckout={autoCheckout}
        authenticated={!!user}
      />
    </>
  );
}
