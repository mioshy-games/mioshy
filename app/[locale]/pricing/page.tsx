import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import "@/components/marketing/v2/styles.css";
import { JourneyStages } from "@/components/marketing/v2/JourneyStages";

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
  const title = `Mioshy — ${t("title")}`;
  const description = t("subtitle");

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

  return (
    <main
      dir={isHe ? "rtl" : "ltr"}
      lang={locale}
      className="home-v2 relative min-h-[100dvh] bg-white text-[#170E14]"
    >
      <JourneyStages />
    </main>
  );
}
