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
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CmsText } from "@/components/cms/CmsText";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";

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
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "mioshySexPage",
    page: "mioshy-sex",
  });
  const sectionName = isHe
    ? settings?.section_name_he
    : settings?.section_name_en;
  const tagline = isHe
    ? settings?.section_tagline_he
    : settings?.section_tagline_en;
  const title = `Mioshy - ${sectionName ?? t("defaultSectionName")}`;
  const description = tagline ?? t("defaultHeroTagline");
  const base = siteUrl();
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/mioshy-sex`,
      languages: {
        en: `${base}/en/mioshy-sex`,
        he: `${base}/he/mioshy-sex`,
        "x-default": `${base}/en/mioshy-sex`,
      },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}/mioshy-sex`,
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

  // Auth gate - logged-in visitors skip the marketing wrap and land
  // straight in the catalogue (categories + tags + cards). Anonymous
  // visitors still get the full Manifesto / Proof / FAQ / Closer story
  // because they're being introduced to the product for the first time.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthed = !!user;

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
          <CmsText
            cmsKey="mioshySexPage.comingSoonTitle"
            as="h1"
            className="text-3xl font-bold"
          />
          <CmsText
            cmsKey="mioshySexPage.comingSoonBody"
            as="p"
            className="mt-4 text-white/75"
          />
          <Link
            href="/"
            className="mt-8 inline-block rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm hover:bg-white/20"
          >
            ← <CmsText cmsKey="mioshySexPage.backHome" />
          </Link>
        </main>
      </div>
    );
  }

  // CMS-managed fallbacks for the section header / tagline. Read once
  // here on the server so each branch below can plug them into the
  // existing settings-or-default cascade.
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "mioshySexPage",
    page: "mioshy-sex",
  });
  const defaultSectionName = t("defaultSectionName");
  const defaultAuthedTagline = t("defaultAuthedTagline");
  const defaultHeroTagline = t("defaultHeroTagline");

  // Pricing data - still resolved because BetweenUsStorefront and the buy-x
  // bundle chips read from it. The standalone pricing SECTION has been
  // removed at the user's request: commerce happens on the per-game pages.
  const pricing = resolveAdultsPricing(settings, locale);

  // ─── Logged-in catalog-only view ──────────────────────────────────────
  // Per Itzik 2026-05-02: members shouldn't see the same intro story
  // every time they come back. Drop them straight into the storefront
  // grid with a section title. Marketing intro stays for anonymous
  // visitors below.
  if (isAuthed) {
    const sectionName =
      (isHe ? settings.section_name_he : settings.section_name_en) ||
      defaultSectionName;
    const sectionTagline =
      (isHe ? settings.section_tagline_he : settings.section_tagline_en) ||
      defaultAuthedTagline;
    const heroForGrid = {
      title: sectionName,
      tagline: sectionTagline,
      singlePrice: pricing.single.displayPrice,
      subPrice: `${pricing.monthly.displayPrice}${pricing.monthly.periodLabel}`,
      singleEnabled: pricing.single.enabled,
      subEnabled: pricing.monthly.enabled,
      buyXGetX: pricing.bundleTiers,
    };
    return (
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="relative isolate min-h-[100dvh] overflow-hidden bg-[#0a0410] text-white"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-full bg-[linear-gradient(180deg,#0a0410_0%,#13061a_25%,#1a071f_50%,#15051a_75%,#0a0410_100%)]"
        />
        <AdultsAmbience />
        <main className="relative">
          {/* Compact authed-user header - replaces the full marketing hero. */}
          <section className="px-4 pt-12 pb-4">
            <div className="mx-auto max-w-6xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-fuchsia-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-100">
                <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />
                <CmsText cmsKey="mioshySexPage.privateChamber" />
              </div>
              <h1 className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
                {sectionName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                {sectionTagline}
              </p>
            </div>
          </section>
          <BetweenUsStorefront
            locale={locale}
            hero={heroForGrid}
            cards={cards}
            categories={categories}
            tags={tags}
            hideHero
          />
        </main>
      </div>
    );
  }

  const hero = {
    title:
      (isHe
        ? settings.section_name_he
        : settings.section_name_en || settings.section_name_he) ||
      defaultSectionName,
    tagline:
      (isHe
        ? settings.section_tagline_he
        : settings.section_tagline_en || settings.section_tagline_he) ||
      defaultHeroTagline,
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
            LIGHT BAND - marketing sections (Manifesto, Proof, Catalogue
            intro). These were redesigned for cream + dark text and read
            best on a light surface.
        ════════════════════════════════════════════════════════════ */}
        <div className="relative bg-[#FAF6F7] text-slate-900">
          {/* 2. MANIFESTO - what these games actually are */}
          <AdultsManifestoSection isHe={isHe} />

          {/* 3. PROOF - 80% / 50% stat cards */}
          <AdultsProofSection isHe={isHe} />
        </div>

        {/* ════════════════════════════════════════════════════════════
            DARK BAND - the catalogue intro NOW LIVES INSIDE this dark
            wrapper alongside the storefront grid (Itzik 2026-05-07).
            The previous cream-wrapped intro felt disconnected from the
            products below; pulling it onto the same dark surface makes
            the heading read as the title OF the grid, not as a
            transition section.
        ════════════════════════════════════════════════════════════ */}
        <div id="catalogue" className="relative">
          <AdultsCatalogueIntro isHe={isHe} />
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
            LIGHT BAND - FAQ (designed in light editorial style).
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
