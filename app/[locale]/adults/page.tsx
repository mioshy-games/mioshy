import type { Metadata } from "next";
import { Link } from "@/navigation";
import {
  getBetweenUsSettings,
  listActiveGameCards,
  listCategories,
  listTags,
} from "@/lib/between-us/queries";
import { BetweenUsStorefront } from "@/components/between-us/BetweenUsStorefront";
import { AdultsMarketingHero } from "@/components/adults/AdultsMarketingHero";
import { AdultsAmbience } from "@/components/adults/AdultsAmbience";
import {
  AdultsManifestoSection,
  AdultsProofSection,
  AdultsFaqSection,
  AdultsClosingCta,
  AdultsCatalogueIntro,
} from "@/components/adults/AdultsMarketingSections";
import { resolveAdultsPricing } from "@/lib/adults/pricing";

export const dynamic = "force-dynamic";

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
  const settings = await getBetweenUsSettings().catch(() => null);
  const isHe = locale === "he";
  const sectionName = isHe
    ? settings?.section_name_he
    : settings?.section_name_en;
  const tagline = isHe
    ? settings?.section_tagline_he
    : settings?.section_tagline_en;
  const title = `Mioshy - ${sectionName ?? (isHe ? "למבוגרים בלבד" : "Adults Only")}`;
  const description =
    tagline ??
    (isHe
      ? "המוצר הדגל של מיאושי. לילה אחד של חדשנות, הפתעה, וחוויה אחרת לגמרי."
      : "Mioshy's flagship. One night of novelty, surprise - and a wholly different experience.");
  const base = siteUrl();
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/adults`,
      languages: {
        en: `${base}/en/adults`,
        he: `${base}/he/adults`,
        "x-default": `${base}/en/adults`,
      },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}/adults`,
      title,
      description,
      siteName: "Mioshy",
    },
  };
}

export default async function AdultsLandingPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  const isHe = locale === "he";

  const [settings, cards, categories, tags] = await Promise.all([
    getBetweenUsSettings().catch(() => null),
    listActiveGameCards(),
    listCategories(true),
    listTags(true),
  ]);

  if (!settings) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-violet-950 via-fuchsia-950 to-rose-950 text-white">
        <main className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="text-3xl font-bold">
            {isHe ? "בקרוב" : "Coming soon"}
          </h1>
          <p className="mt-4 text-white/75">
            {isHe
              ? "אנחנו מכינים משהו מיוחד עבור זוגות. חזרו בקרוב."
              : "We're preparing something special for couples. Check back soon."}
          </p>
          <Link
            href="/"
            className="mt-8 inline-block rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm hover:bg-white/20"
          >
            ← {isHe ? "חזרה לדף הבית" : "Back home"}
          </Link>
        </main>
      </div>
    );
  }

  // Pricing data - still resolved because BetweenUsStorefront and the buy-x
  // bundle chips read from it. The standalone pricing SECTION has been
  // removed at the user's request: commerce happens on the per-game pages.
  const pricing = resolveAdultsPricing(settings, locale);

  const hero = {
    title:
      (isHe
        ? settings.section_name_he
        : settings.section_name_en || settings.section_name_he) ||
      (isHe ? "למבוגרים בלבד" : "Adults Only"),
    tagline:
      (isHe
        ? settings.section_tagline_he
        : settings.section_tagline_en || settings.section_tagline_he) ||
      (isHe
        ? "המוצר הדגל של מיאושי. לילה אחד של חדשנות, הפתעה, וחוויה אחרת לגמרי."
        : "Mioshy's flagship. One night of novelty, surprise - and a wholly different experience."),
    singlePrice: pricing.single.displayPrice,
    subPrice: `${pricing.monthly.displayPrice}${pricing.monthly.periodLabel}`,
    singleEnabled: pricing.single.enabled,
    subEnabled: pricing.monthly.enabled,
    buyXGetX: pricing.bundleTiers,
  };

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      // `isolate` (CSS isolation: isolate) is REQUIRED so the negative
      // z-index AdultsAmbience layer paints inside this wrapper's
      // stacking context - otherwise its bg-[#0a0410] above paints
      // OVER the fog blobs and you see flat black.
      className="relative isolate min-h-[100dvh] overflow-hidden bg-[#0a0410] text-white"
    >
      {/* ── PAGE BASE - deep midnight, with a subtle vertical gradient so
            it's never literally black. The colour + motion is layered on
            top by <AdultsAmbience />. ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-full bg-[linear-gradient(180deg,#0a0410_0%,#13061a_25%,#1a071f_50%,#15051a_75%,#0a0410_100%)]"
      />

      {/* ── PAGE-WIDE AMBIENCE - drifting fog + floating particles + grain.
            Sits behind ALL section content so the entire page feels like
            one continuous after-dark room. ── */}
      <AdultsAmbience />

      <main className="relative">
        {/* ════════════════════════════════════════════════════════════
            1. HERO - centred drama + atmospheric edge cards
        ════════════════════════════════════════════════════════════ */}
        <AdultsMarketingHero isHe={isHe} hero={hero} ctaHref="#catalogue" />

        {/* ════════════════════════════════════════════════════════════
            LIGHT BAND — marketing sections (Manifesto, Proof, Catalogue
            intro). These were redesigned for cream + dark text and read
            best on a light surface.
        ════════════════════════════════════════════════════════════ */}
        <div className="relative bg-[#FAF6F7] text-slate-900">
          {/* 2. MANIFESTO - what these games actually are */}
          <AdultsManifestoSection isHe={isHe} />

          {/* 3. PROOF - 80% / 50% stat cards */}
          <AdultsProofSection isHe={isHe} />

          {/* 4. CATALOGUE INTRO - hands off to the live grid */}
          <AdultsCatalogueIntro isHe={isHe} />
        </div>

        {/* ════════════════════════════════════════════════════════════
            DARK BAND — categories / tags / cards UI is built explicitly
            for white-on-dark contrast (text-white/75, bg-white/5,
            border-white/15). On a light wrapper those classes vanish.
            We keep the storefront on the page's dark [#0a0410] surface.
        ════════════════════════════════════════════════════════════ */}
        <div id="catalogue" className="relative">
          <BetweenUsStorefront
            locale={locale}
            hero={hero}
            cards={cards}
            categories={categories}
            tags={tags}
            hideHero
          />
        </div>

        {/* ════════════════════════════════════════════════════════════
            LIGHT BAND — FAQ (designed in light editorial style).
        ════════════════════════════════════════════════════════════ */}
        <div className="relative bg-[#FAF6F7] text-slate-900">
          <AdultsFaqSection isHe={isHe} />
        </div>

        {/* ════════════════════════════════════════════════════════════
            6. CLOSING - final dramatic dark statement + CTA
        ════════════════════════════════════════════════════════════ */}
        <AdultsClosingCta isHe={isHe} />
      </main>
    </div>
  );
}
