import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isComingSoon } from "@/lib/games/coming-soon";
import { Link } from "@/navigation";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import {
  ArrowRight,
  CheckCircle2,
  Heart,
  Sparkles,
  Target,
} from "@/components/icons/Icons";
import {
  getGameBySlug,
  getGameCategoryIds,
  getGameTagIds,
  listActiveGameCards,
  listCategories,
  listTags,
  getBetweenUsSettings,
} from "@/lib/between-us/queries";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { AdultsHeroBuy } from "@/components/adults/AdultsHeroBuy";
// 2026-05-20 — AdultsAmbience + AmbienceDebugProbe imports removed
// because of the periodic 30s freeze on this route. The new shared
// SexHeroBlobs field carries the after-dark atmosphere — three
// transform-only compositor layers — so the slug page now matches
// /mioshy-sex visually without re-introducing the freeze risk.
import { SexHeroBlobs } from "@/components/adults/SexHeroBlobs";
import { resolveAdultsPricing } from "@/lib/adults/pricing";
import { CmsText } from "@/components/cms/CmsText";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { MaybeRichText } from "@/components/cms/MaybeRichText";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { loadCmsTextsForPage } from "@/lib/cms/server";

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
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const { locale, slug } = params;
  const game = await getGameBySlug(slug).catch(() => null);
  if (!game) return { title: "Mioshy" };
  const isHe = locale === "he";
  const title =
    (isHe ? game.meta_title_he : game.meta_title_en) ||
    (isHe ? game.title_he : game.title_en || game.title_he);
  const description =
    (isHe ? game.meta_description_he : game.meta_description_en) ||
    (isHe ? game.short_desc_he : game.short_desc_en || game.short_desc_he);
  const base = siteUrl();
  return {
    title: `Mioshy - ${title}`,
    description,
    alternates: {
      canonical: `${base}/${locale}/mioshy-sex/${slug}`,
      languages: {
        en: `${base}/en/mioshy-sex/${slug}`,
        he: `${base}/he/mioshy-sex/${slug}`,
        "x-default": `${base}/en/mioshy-sex/${slug}`,
      },
    },
    openGraph: {
      type: "article",
      url: `${base}/${locale}/mioshy-sex/${slug}`,
      title,
      description,
      siteName: "Mioshy",
      images: game.cover_image_url ? [{ url: game.cover_image_url }] : undefined,
    },
  };
}

export default async function BetweenUsGameDetailPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const { locale, slug } = params;
  const isHe = locale === "he";

  const game = await getGameBySlug(slug);
  if (!game) notFound();
  // D — a scheduled (coming-soon) game isn't accessible/purchasable until it
  // opens. Direct-URL visitors bounce back to the catalogue (computed live).
  if (isComingSoon(game.opens_at)) redirect(`/${locale}/mioshy-sex`);

  // CMS-managed copy for this route — used for JSON-LD offer/breadcrumb
  // names (sent to search engines, must be raw strings) and as fallback
  // template values for the genre category line below.
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "mioshySexSlug",
    page: "mioshy-sex",
  });

  // Load cms_texts rows for the mioshy-sex page so every <CmsText>
  // below picks up admin-edited values (is_rich, color_override,
  // font sizing). Without the provider wrap further down, every
  // CmsText falls through to next-intl JSON and admin edits in CRM
  // never reach the public page.
  const cmsRows = await loadCmsTextsForPage("mioshy-sex");

  const [settings, ctx, journeyEntitlements, catIds, tagIds, allCats, allTags, allGameCards] =
    await Promise.all([
      getBetweenUsSettings().catch(() => null),
      getCurrentCoupleContext(),
      // 2026-05-22 — Journey subscribers get free access to every Adults
      // game (no per-game purchase). We pull the entitlement snapshot
      // here so the hero CTA can short-circuit straight to "Open game"
      // for them, even when this couple never bought THIS specific game.
      import("@/lib/entitlements/getUserEntitlements").then((m) =>
        m.getUserEntitlements().catch(() => null),
      ),
      // Note: per-game content (`listGameContent(game.id)`) used to be
      // fetched here for the now-removed preview card section. Don't
      // re-add this fetch on the public page - that data belongs only on
      // the gated /play surface.
      getGameCategoryIds(game.id),
      getGameTagIds(game.id),
      listCategories(true),
      listTags(true),
      // Pulled here to compute the bottom-of-page "Next game" CTA.
      // Cards arrive sorted by sort_weight DESC, created_at DESC - same
      // canonical order users see in the catalogue grid.
      listActiveGameCards().catch(() => []),
    ]);

  // Per-game purchase entitlement: the couple bought THIS specific game.
  const ownedThisGame =
    !!ctx && ctx.couple_id !== null && ctx.entitled_game_ids.has(game.id);
  // 2026-05-22 — Journey subscribers get the same "open game" treatment
  // even without a per-game purchase. The /play route still has its own
  // entitlement gate which ALSO accepts journey, so the CTA here doesn't
  // promise something the gated page would refuse.
  const journeyGrantsAccess = journeyEntitlements?.journey === true;
  const entitled = ownedThisGame || journeyGrantsAccess;

  // Couple-share is now a pure copy-and-paste flow built around the
  // visible pair_code. We deliberately removed the email-invite query
  // - the buyer never gives us the partner's contact details, they
  // just copy the prepared invite text and send it via whatever
  // channel they prefer. See AdultsHeroBuy for the full spec.

  const title = isHe ? game.title_he : game.title_en || game.title_he;
  const shortDesc = isHe
    ? game.short_desc_he
    : game.short_desc_en || game.short_desc_he;
  // NOTE: `full_desc` is the actual purchased product. It must NEVER appear
  // on this public marketing page - it belongs on /mioshy-sex/[slug]/play behind
  // the entitlement gate. We intentionally do not destructure it here.
  const benefits = isHe ? game.benefits_he : game.benefits_en ?? game.benefits_he;
  const targets = isHe
    ? game.target_audience_he
    : game.target_audience_en ?? game.target_audience_he;

  // Universal value-prop bullets appended to every Adults game's
  // "What you'll get" / "This game is for you if…" lists. These are
  // brand-level promises (not game-specific copy), so they read from
  // CMS via universalBenefit[12] / universalTarget[12] keys.
  const universalBenefits = [
    t("universalBenefit1"),
    t("universalBenefit2"),
  ];
  const universalTargets = [
    t("universalTarget1"),
    t("universalTarget2"),
  ];

  const allBenefits = [...(benefits ?? []), ...universalBenefits];
  const allTargets = [...(targets ?? []), ...universalTargets];

  // Resolve the tier pricing for this game. If settings are unavailable we
  // fall back to an all-disabled pricing shape so the panel quietly hides
  // its CTAs rather than exploding.
  const pricing = settings
    ? resolveAdultsPricing(settings, locale, game)
    : null;

  const catLookup = new Map(allCats.map((c) => [c.id, c]));
  const tagLookup = new Map(allTags.map((t) => [t.id, t]));
  const gameCats = catIds
    .map((id) => catLookup.get(id))
    .filter(Boolean) as typeof allCats;
  const gameTags = tagIds
    .map((id) => tagLookup.get(id))
    .filter(Boolean) as typeof allTags;

  // ── "Next game" computation ────────────────────────────────────────
  // Loops across EVERY active Adults game (no category filter), so
  // visitors discovering via this CTA always cycle through the full
  // catalogue rather than a category-narrowed subset. A category-only
  // loop was the previous behavior but it dropped any game that didn't
  // share the current game's category - leaving the user bouncing
  // between the same 2-3 titles forever even when more existed in the
  // catalogue. Per design feedback (2026-05-05) the loop now spans
  // the whole catalogue.
  // Algorithm:
  //   1. Use the canonical listActiveGameCards order
  //      (sort_weight DESC, created_at DESC) - same order as the
  //      catalogue grid, so users move "forward" in the same direction
  //      they'd browse manually.
  //   2. Find current game's index, hop one forward, wrap to start.
  let nextGame: typeof game | null = null;
  if (allGameCards.length > 1) {
    const currentIdx = allGameCards.findIndex(
      (c) => c.game.id === game.id,
    );
    if (currentIdx !== -1) {
      const nextIdx = (currentIdx + 1) % allGameCards.length;
      nextGame = allGameCards[nextIdx]!.game;
    } else {
      // Current game isn't in its own filtered list (edge case if
      // is_active flipped between fetches) - pick the first available.
      nextGame = allGameCards[0]!.game;
    }
  }
  const nextGameTitle = nextGame
    ? isHe
      ? nextGame.title_he
      : nextGame.title_en || nextGame.title_he
    : null;

  // ── Structured data - Product + BreadcrumbList ─────────────────────────
  // Without this, /mioshy-sex/[slug] is the only public route on the site
  // missing JSON-LD. Product schema lets Google show rich shopping snippets
  // (price, availability, breadcrumbs) on result pages, which is high-value
  // for a flagship commerce surface like this. Schema is conservative -
  // we omit any field we don't have ground-truth for (no review aggregates,
  // no GTIN - those would be misleading).
  const base = siteUrl();
  // pricing.currency lives on the root; each tier has priceIls + priceUsd
  // in whole-currency-unit units (not minor units). Pick the matching one.
  const productCurrency = pricing?.currency ?? "ILS";
  const tierAmount = (tier: { priceIls: number; priceUsd: number }) =>
    productCurrency === "ILS" ? tier.priceIls : tier.priceUsd;
  const offers: { "@type": "Offer"; name: string; price: string; priceCurrency: string; availability: string; url: string }[] = [];
  if (pricing?.single?.enabled) {
    offers.push({
      "@type": "Offer",
      name: t("pricing.oneTime"),
      price: tierAmount(pricing.single).toFixed(2),
      priceCurrency: productCurrency,
      availability: "https://schema.org/InStock",
      url: `${base}/${locale}/mioshy-sex/${slug}`,
    });
  }
  if (pricing?.monthly?.enabled) {
    offers.push({
      "@type": "Offer",
      name: t("pricing.monthly"),
      price: tierAmount(pricing.monthly).toFixed(2),
      priceCurrency: productCurrency,
      availability: "https://schema.org/InStock",
      url: `${base}/${locale}/mioshy-sex/${slug}`,
    });
  }
  if (pricing?.annual?.enabled) {
    offers.push({
      "@type": "Offer",
      name: t("pricing.annual"),
      price: tierAmount(pricing.annual).toFixed(2),
      priceCurrency: productCurrency,
      availability: "https://schema.org/InStock",
      url: `${base}/${locale}/mioshy-sex/${slug}`,
    });
  }
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: t("breadcrumbHome"),
            item: `${base}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: t("breadcrumbAdults"),
            item: `${base}/${locale}/mioshy-sex`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: `${base}/${locale}/mioshy-sex/${slug}`,
          },
        ],
      },
      {
        "@type": "Product",
        name: title,
        description: shortDesc,
        url: `${base}/${locale}/mioshy-sex/${slug}`,
        ...(game.cover_image_url ? { image: game.cover_image_url } : {}),
        brand: { "@type": "Brand", name: "Mioshy" },
        category: gameCats
          .map((c) => (isHe ? c.name_he : c.name_en || c.name_he))
          .filter(Boolean)
          .join(", ") || t("defaultGenre"),
        inLanguage: isHe ? "he" : "en",
        ...(offers.length > 0
          ? offers.length === 1
            ? { offers: offers[0] }
            : {
                offers: {
                  "@type": "AggregateOffer",
                  offerCount: offers.length,
                  priceCurrency: productCurrency,
                  lowPrice: Math.min(
                    ...offers.map((o) => parseFloat(o.price)),
                  ).toFixed(2),
                  highPrice: Math.max(
                    ...offers.map((o) => parseFloat(o.price)),
                  ).toFixed(2),
                  offers,
                },
              }
          : {}),
      },
    ],
  };
  // ──────────────────────────────────────────────────────────────────────

  return (
    <CmsTextProvider rows={cmsRows}>
    <div
      dir={isHe ? "rtl" : "ltr"}
      // `isolate` (CSS isolation: isolate) is CRITICAL here.
      // Without it, `position: relative` alone does NOT create a stacking
      // context, so the `-z-10` AdultsAmbience layer paints behind THIS
      // element's `bg-[#0a0410]` solid background - i.e. invisible.
      // Adding `isolate` makes the wrapper its own stacking context, so
      // `-z-10` paints between the wrapper's bg and the in-flow content.
      className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden bg-[#0a0410] text-white"
    >
      {/* Deep midnight base + ambient color washes - same vocabulary as the
          /adults marketing surface so the detail page feels like part of the
          same after-dark room rather than a flat indigo plate. The fog
          blobs inside AdultsAmbience use mix-blend-screen, so overlapping
          blobs synthesize new colours where they meet (rose + fuchsia →
          magenta etc). For that to paint correctly, we DON'T set
          `isolation: isolate` anywhere between the blobs and the base wash. */}
      {/* Static dark base — fallback wash so the wrapper is never
          empty even if the SexHeroBlobs animation pauses
          (prefers-reduced-motion). */}
      <div
        aria-hidden
        data-testid="adults-bg-base"
        className="pointer-events-none absolute inset-x-0 top-0 -z-30 h-full bg-[linear-gradient(180deg,#070111_0%,#0e0220_24%,#170428_48%,#0e0220_76%,#070111_100%)]"
      />
      {/* Shared hero blob field — the same three "dancing" gradient
          circles that paint the /mioshy-sex catalogue hero. Adopted
          here per Itzik 2026-05-20 so the catalogue → detail page
          transition keeps the same after-dark atmosphere; the
          previous static double-radial wash was a stopgap put in
          while we hunted the 30s-freeze bug. Three transform-only
          compositor layers — light enough to run safely on this
          route again. */}
      <SexHeroBlobs isHe={isHe} />

      {/* Product structured data - Google rich-result eligibility. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      {/* Outer rail width AND padding match the SiteHeader exactly
          (max-w-7xl, mx-auto, px-4) so the page, header and footer
          all sit on the same vertical grid lines - same right edge in
          RTL on every screen. Content blocks below still cap themselves
          (max-w-3xl on the benefits column, etc.) for reading comfort. */}
      {/* `flex-1` so `<main>` fills the wrapper's remaining flex
          space. Combined with `flex min-h-[100dvh] flex-col` on the
          wrapper above, this guarantees the dark `bg-[#0a0410]`
          extends ALL THE WAY DOWN to where the SiteFooter starts —
          verified zero-gap on 2026-05-20 (gapWrapperToFooter=0). */}
      <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        {/* Back link removed per UX redesign - moved to the BOTTOM of the
            page and reframed as a "Next game" carousel CTA so the visitor
            keeps discovering products instead of being asked to go back
            to a list right after landing on the page. See the
            `nextGame` block at the end of <main>. */}

        {/* If the visitor already owns this game (e.g. they landed here
            from search instead of /my/adults), surface a one-click jump to
            the gated play surface so they don't get stuck on the marketing
            page they don't need anymore. */}
        {entitled ? (
          <Link
            href={`/mioshy-sex/${slug}/play`}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 backdrop-blur transition hover:bg-emerald-400/15"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <CmsText cmsKey="mioshySexSlug.youOwnThis" />
          </Link>
        ) : null}

        {/* Hero - focused two-column layout.
            Per design spec: each column capped at 550px wide. Cover side
            also fixes its height at 420px (landscape). On screens <md the
            two columns stack vertically; on md+ they sit side-by-side and
            justify-center keeps the pair anchored to the page's centre
            instead of stretching to the full max-w-7xl rail. */}
        {/* Hero section — 2026-05-20: switched from
            `justify-center` + per-column `max-w-[550px]` to a
            spread layout that fills the page's max-w-7xl rail. The
            two columns now sit at the far left + far right of the
            container, matching the alignment of the sections below
            ("מה תקבלו", gallery, etc.) which extend to the rail
            edges. Each column flexes between a sensible min and the
            full available half-width. */}
        <section className="mt-6 flex flex-col items-stretch gap-8 md:flex-row md:items-start md:justify-between md:gap-10">
          {/* Left column — `flex-1` so it takes its half of the row. */}
          <div className="flex w-full flex-col md:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* "New" badge removed 2026-05-20 per Itzik. The
                  is_new flag on the game row remains in the DB but
                  is no longer surfaced on the slug page. The
                  `is_popular` badge below is still rendered. */}
              {game.is_popular ? (
                <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
                  <CmsText cmsKey="mioshySexSlug.tagPopular" />
                </span>
              ) : null}
              {gameCats.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs text-white/85"
                >
                  {c.color_hex ? (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: c.color_hex }}
                    />
                  ) : null}
                  {isHe ? c.name_he : c.name_en || c.name_he}
                </span>
              ))}
            </div>
            {/* Game name uses Frank Ruhl Libre directly (not the
                `font-heading` token) because in RTL `--font-heading`
                resolves to IBM Plex Sans Hebrew - sans-serif. We want
                serif in BOTH locales for a unified editorial feel that
                matches every other heading on the site (personas h3,
                why h3, /adults flagship h1, etc.). Frank Ruhl Libre
                supports Hebrew + Latin, so one declaration covers both. */}
            <MaybeRichText
              value={title}
              as="h1"
              className="mt-4 text-[42px] leading-[1.08] tracking-tight sm:text-5xl sm:leading-tight"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 700 }}
            />

            {shortDesc ? (
              <MaybeRichText
                value={shortDesc}
                as="p"
                className="mt-4 text-[1.5rem] font-medium leading-[1.45] text-white/85 sm:text-white/80 sm:font-normal"
              />
            ) : null}

            {/* Mobile-only cover artwork - placed AFTER the short description
                rather than before it. Reasoning: the natural reading flow on
                mobile is title → context (desc) → visual. Putting the image
                first pushed the description below the fold; putting it after
                the description keeps the reader in flow and lets the visual
                land as a confirmation of what they just read. Desktop has its
                own cover in the right column (the `hidden md:block` sibling
                further below) so this mobile copy is hidden there.
                Aspect bumped from 4/3 → 16/10 to drop ~17% of the height -
                the image still has presence but doesn't push price/CTA off-
                screen on common phone heights. */}
            <div className="relative mt-5 aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/30 to-violet-500/20 shadow-2xl md:hidden">
              {game.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={game.cover_image_url}
                  alt={game.alt_text || title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-white/40">
                  <Heart className="h-16 w-16" />
                </div>
              )}
            </div>

            {/* PRIMARY COMMERCE - big price + buy CTA, directly under the
                lede where the visitor's eye naturally lands after reading
                the short description. Replaces the old right-sidebar
                pricing panel + "Sign in required" lock card.
                Auto-resumes a logged-out purchase via ?continuePurchase=1
                after the visitor returns from the auth flow. */}
            {pricing ? (
              // Mobile-only reorder: pricing/CTA pushed to the bottom of the
              // left column via `order-1` so the meta block (levels + tags)
              // gets to build perceived value BEFORE the price reveal. On
              // desktop the price still sits directly under shortDesc - the
              // wider layout makes early price disclosure non-disruptive.
              <div className="order-1 md:order-none">
                <AdultsHeroBuy
                  locale={locale}
                  gameId={game.id}
                  gameSlug={game.slug}
                  gameTitle={title}
                  pricing={pricing}
                  loggedIn={!!ctx}
                  ctx={
                    ctx
                      ? {
                          user_id: ctx.user_id,
                          couple_id: ctx.couple_id,
                          role: ctx.role,
                          // Pair code surfaced inline in the entitled-state
                          // PairCodeBlock so the buyer can copy a ready-made
                          // invite (greeting + URL + code) to their clipboard.
                          pair_code: ctx.pair_code,
                          partner_count: ctx.partner_count,
                          entitled,
                        }
                      : null
                  }
                />
              </div>
            ) : null}

            {/* 2026-06-09 — level pills (intimacy / communication / heat)
                removed per Itzik. */}

            {gameTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2 sm:gap-1.5">
                {gameTags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full bg-white/5 px-2.5 py-0.5 text-[16px] text-white/80 ring-1 ring-white/10 sm:px-2 sm:py-0.5 sm:text-xs sm:text-white/70"
                  >
                    #{isHe ? t.name_he : t.name_en || t.name_he}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Cover - DESKTOP-ONLY (capped at 550px wide × 420px tall, landscape).
              The mobile version of this artwork lives inline in the left
              column, immediately under <h1>, where it does its
              visual-reinforcement job before scroll. `hidden md:block`
              suppresses this duplicate on phones so we don't render the
              same cover twice. */}
          <div className="relative hidden aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/30 to-violet-500/20 shadow-2xl md:block md:aspect-auto md:h-[420px] md:flex-1">
            {game.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={game.cover_image_url}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white/40">
                <Heart className="h-16 w-16" />
              </div>
            )}
          </div>
        </section>

        {/* Below-the-fold details: benefits + target audience.
            full_desc DELIBERATELY OMITTED - that's purchased product and
            lives on /mioshy-sex/[slug]/play behind the entitlement gate.

            Layout: same start-aligned column as the hero copy (NOT
            mx-auto centred), so the title row + bullet rows share the
            same right-edge alignment in RTL. `mt-8` instead of `mt-12`
            pulls the section visually closer to the hero. */}
        <section className="mt-8">
          <div className="max-w-3xl space-y-8 text-start">
            {allBenefits.length > 0 ? (
              <div>
                {/* Section heading 24px (above the 20px floor). Body
                    bullets bumped to 18px on every size - these are
                    high-importance value bullets and the user explicitly
                    flagged the previous 16px as too small. */}
                <CmsText
                  cmsKey="mioshySexSlug.whatYoullGet"
                  as="h2"
                  className="text-2xl font-semibold text-white/95"
                />
                <ul className="mt-4 space-y-3">
                  {allBenefits.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[18px] leading-relaxed text-white/85"
                    >
                      <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-300" />
                      <MaybeRichText value={b} />

                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {allTargets.length > 0 ? (
              <div>
                <CmsText
                  cmsKey="mioshySexSlug.gameIsForYouIf"
                  as="h2"
                  className="text-2xl font-semibold text-white/95"
                />
                <ul className="mt-4 space-y-3">
                  {allTargets.map((t, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[18px] leading-relaxed text-white/85"
                    >
                      <Target className="mt-1 h-4 w-4 flex-shrink-0 text-fuchsia-200" />
                      <MaybeRichText value={t} />

                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* Gallery */}
        {game.gallery && game.gallery.length > 0 ? (
          <section className="mt-14">
            <CmsText
              cmsKey="mioshySexSlug.gallery"
              as="h2"
              className="text-xl font-semibold text-white/95"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {game.gallery.map((src, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${title} - ${i + 1}`}
                    className="h-48 w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* The "Game content" preview-card section was REMOVED.
            Reasons:
              1. Per-game content rows often inherit from a generic seed
                 template, so the cards shown here didn't necessarily match
                 the actual purchased product - confusing for buyers.
              2. The full purchased content (including any preview cards)
                 belongs exclusively on the gated /mioshy-sex/[slug]/play
                 surface; leaking even "preview" cards onto the public
                 marketing page muddles that boundary.
            The public page now shows only image, short_desc, levels,
            categories/tags, benefits, target audience, gallery, and the
            commerce panel. Any actual game cards live behind the
            entitlement gate. */}

        {/* ── BOTTOM "Next game" CTA ──
            Replaces the old top-of-page "Back to all games" link with
            a discovery-positive next-step. Loops through games in the
            current game's category so users keep moving through the
            catalogue without ever returning to a flat list view. */}
        {nextGame ? (
          <section className="mt-16 border-t border-white/10 pt-10">
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div>
                <CmsText
                  cmsKey="mioshySexSlug.nextGame"
                  as="p"
                  className="text-[12px] font-semibold uppercase tracking-[0.22em] text-rose-200/75"
                />
                <MaybeRichText
                  value={nextGameTitle}
                  as="h3"
                  className="mt-2 text-[26px] leading-[1.15] tracking-tight text-white sm:text-[30px]"
                  style={{
                    fontFamily: "'Frank Ruhl Libre', serif",
                    fontWeight: 700,
                  }}
                />
              </div>
              {/* Per Itzik 2026-05-07: this is a SECONDARY CTA (the
                  primary purchase action lives in the hero). Outline-
                  only treatment so it doesn't compete with the buy
                  button. */}
              <Link
                href={`/mioshy-sex/${nextGame.slug}`}
                className="group inline-flex items-center justify-center gap-2 self-start rounded-full border border-white/30 bg-transparent px-7 py-3 text-[16px] font-semibold text-white/85 transition hover:border-white/60 hover:bg-white/[0.04] hover:text-white sm:self-auto"
              >
                <span><CmsText cmsKey="mioshySexSlug.keepExploring" /></span>
                <ArrowRight
                  className={`h-5 w-5 transition group-hover:translate-x-1 ${
                    isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                  }`}
                />
              </Link>
            </div>
          </section>
        ) : null}
      </main>
    </div>
    </CmsTextProvider>
  );
}

// 2026-06-09 — no longer rendered (level pills removed). Underscore-
// prefixed so eslint no-unused-vars ignores it; kept on disk.
function _LevelPill({
  icon,
  label,
  level,
}: {
  icon: React.ReactNode;
  label: string;
  level: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[16px] sm:px-3 sm:py-1.5 sm:text-xs">
      {icon}
      <span className="text-white/85 sm:text-white/80">{label}</span>
      <span className="font-semibold text-white">{level}/5</span>
    </div>
  );
}

