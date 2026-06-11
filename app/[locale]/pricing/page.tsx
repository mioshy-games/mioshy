import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import "@/components/marketing/v2/styles.css";
import { JourneyStages } from "@/components/marketing/v2/JourneyStages";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { loadCmsTextsForPage } from "@/lib/cms/server";

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
        "x-default": `${base}/en/pricing`,
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
 * /pricing — three-plan mood-swiper surface (Itzik 2026-05-07).
 * ─────────────────────────────────────────────────────────────
 * Replaces the previous single-Journey-plan layout. The mood swiper
 * (JourneyStages component, also used on the homepage) presents all
 * three Mioshy products as mood-based choices:
 *
 *    💬  משחקי זוגות אונליין    9 ₪ / week
 *    🔥  הסקס של מיאושי         97 ₪ / game
 *    ✨  ליווי עם מיאושי        57 ₪ / week
 *
 * Each card links to its product page, where the actual purchase flow
 * lives. /pricing is now a navigation hub that surfaces the catalog
 * choice at a single glance — not a paywall in itself. This matches
 * Itzik's instruction: the homepage swiper IS the pricing presentation,
 * so /pricing should reuse it verbatim.
 *
 * The page uses the .home-v2 wrapper so the JourneyStages scoped
 * styles apply (it expects to live inside the v2 design tokens).
 */
export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isHe = locale === "he";

  // Itzik 2026-06-02: load the homepage CMS rows so JourneyStages
  // (which uses `homeV2.journeyStages.*` keys) renders the SAME live
  // CMS values as on /. Without this provider the component falls back
  // to messages/he.json — which is why /pricing was showing stale copy
  // even after admin edits in /admin/content. Single source of truth:
  // edit a key once in CMS, both / and /pricing update together.
  const cmsRows = await loadCmsTextsForPage("homepage");

  return (
    <main
      dir={isHe ? "rtl" : "ltr"}
      lang={locale}
      className="home-v2 relative min-h-[100dvh] bg-white text-[#170E14]"
    >
      <CmsTextProvider rows={cmsRows}>
        <JourneyStages />
      </CmsTextProvider>
    </main>
  );
}
