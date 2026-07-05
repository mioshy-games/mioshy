import type { Metadata } from "next";
import { Link } from "@/navigation";
import {
  getBetweenUsSettings,
  listActiveGameCards,
  listCategories,
  listTags,
} from "@/lib/between-us/queries";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { safeJsonLd } from "@/lib/seo/jsonLd";
// CmsText drives the rich-text + color-override rendering path. The
// component reads `cms_texts.is_rich` + `cms_texts.color_override` per
// row — but only when wrapped in <CmsTextProvider rows={...}>. Without
// the provider, useCmsText falls back to next-intl JSON only and
// admin edits never appear. We load rows server-side via
// `loadCmsTextsForPage` and hand them to the provider below.
import { CmsText } from "@/components/cms/CmsText";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
// Shared hero blob field — three drifting gradient circles that
// "dance" together near the upper-mid axis. Used by this page AND
// the per-product /mioshy-sex/[slug] pages so the after-dark
// atmosphere is continuous across the surface.
import { SexHeroBlobs } from "@/components/adults/SexHeroBlobs";
import { FAQ } from "@/components/marketing/v2/FAQ";
import { isComingSoon, comingSoonFirst } from "@/lib/games/coming-soon";
import { ComingSoonCountdown } from "@/components/games/ComingSoonCountdown";

/**
 * /mioshy-sex — flagship adult-games surface (built 2026-05-20).
 *
 * Originally staged at /sex-game during the rebuild, this page took
 * over /mioshy-sex on 2026-05-20 — the previous /mioshy-sex (with
 * AdultsAmbience, AdultsMarketingHero, BetweenUsStorefront, and the
 * AdultsMarketingSections suite) was retired because of the recurring
 * 30-second freeze symptoms on long sessions. The old /sex-game route
 * now server-redirects here for any inbound links that pointed at the
 * staging URL.
 *
 * Architecture
 * ────────────
 * Pure server component. Zero client islands. Every CMS string resolves
 * on the server via `getCmsTranslations()`. Filtering is URL-driven —
 * clicking a chip navigates to `/mioshy-sex?cat=…` and the server re-renders
 * the filtered grid. No client JS for the filter logic.
 *
 * The ONLY animation on the page is the three drifting blur blobs in the
 * hero — transform-only keyframes on positioned divs, compositor-cheap.
 * Everything else is static paint.
 *
 * Layout
 * ──────
 * Mobile-first stacked composition with a `lg:` two-column hero flip:
 *   • Hero (lg:grid-cols-12) — text on one side, card fan on the other.
 *   • Manifesto — cream band, dark editorial copy.
 *   • Proof — two big stat cards.
 *   • Filter chips + catalogue grid (1/2/3 columns responsive).
 *   • FAQ — native <details> accordion (no JS).
 *   • Closing CTA.
 *
 * The hero "twist" lives in the composition: a tilted card-fan of three
 * real catalogue covers + a wax-seal SVG sigil + a vertical editorial
 * spine label + a gradient-italic headline word. Nothing rotates or
 * pulses — the drama is structural.
 */

export const dynamic = "force-dynamic";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(
    /\/+$/,
    "",
  );
}

/**
 * Metadata mirrors the legacy /mioshy-sex generateMetadata exactly
 * so SEO/social shares carry the same identity as the page being
 * replaced. Source-page parity per Itzik 2026-05-20. Section name +
 * tagline cascade: settings row (admin-editable) → CMS default key →
 * messages JSON fallback.
 */
export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { locale } = params;
  const isHe = locale === "he";
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "mioshySexPage",
    page: "mioshy-sex",
  });
  // SEO title/description: fixed, keyword-first copy (Itzik 2026-07-05).
  // Decoupled from the admin section_name/tagline (which still drive the
  // on-page heading below) so the <title> stays keyword-stable and the
  // description is never blanked. The previous `tagline ?? default` let an
  // empty-string tagline override win, so the page shipped with NO meta
  // description at all.
  const title = isHe
    ? "משחקים לזוגות למבוגרים · הסקס של מיאושי"
    : "Adult couples games · Mioshy's intimate line";
  const description = isHe
    ? "משחקים אינטימיים לזוגות שרוצים להעז יותר: ערכות דיגיטליות לחדר השינה, ברכישה חד פעמית, לשני בני הזוג. גישה מיידית ודיסקרטית."
    : "Intimate games for couples who want to dare more: digital bedroom kits, a one-time purchase, for both partners. Instant, discreet access.";
  // og:image:alt — localized; safe fallback to title if missing.
  let ogImageAlt = title;
  try { ogImageAlt = t("ogImageAlt"); } catch { /* fallback to title */ }
  const base = siteUrl();
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/mioshy-sex`,
      languages: {
        en: `${base}/en/mioshy-sex`,
        he: `${base}/he/mioshy-sex`,
        "x-default": `${base}/he/mioshy-sex`,
      },
    },
    openGraph: {
      type: "website",
      url: `${base}/${locale}/mioshy-sex`,
      title,
      description,
      siteName: "Mioshy",
      locale: isHe ? "he_IL" : "en_US",
      alternateLocale: isHe ? ["en_US"] : ["he_IL"],
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

export default async function MioshySexLandingPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { cat?: string; tag?: string };
}) {
  const { locale } = params;
  const isHe = locale === "he";

  const [settings, cards, categories, tags] = await Promise.all([
    getBetweenUsSettings().catch(() => null),
    listActiveGameCards(),
    listCategories(true),
    listTags(true),
  ]);

  // Single CMS resolver call. `t()` is still used for raw-string
  // slots (FAQ existence probes, prop values that need a real string,
  // section_name + tagline cascades from settings). Visible body
  // text below goes through <CmsText> children of the provider.
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "mioshySexPage",
    page: "mioshy-sex",
  });

  // Load cms_texts rows for the mioshy-sex page → handed to
  // <CmsTextProvider> below so every nested <CmsText> can read its
  // row by key and apply is_rich / color_override / typography
  // overrides set in the admin editor.
  const cmsRows = await loadCmsTextsForPage("mioshy-sex");

  // section_name from settings was previously surfaced as the middle
  // line of the hero headline; removed 2026-05-20 per Itzik — the
  // admin had set "בינינו" by accident and the word reads as
  // meaningless on a flagship surface. The headline now uses only
  // heroHeadline1 + heroHeadline2 from CMS, and section_name lives
  // only in metadata generation above.
  const tagline =
    (isHe ? settings?.section_tagline_he : settings?.section_tagline_en) ||
    t("defaultHeroTagline");

  // ── Settings-based rich-text safety net (2026-05-20) ──────────────
  // Per Itzik 2026-05-20: the tagline pulled from
  // `experience_settings.section_tagline_he/_en` (admin-editable in
  // the settings panel, NOT in cms_texts) carried <strong>/<br/>
  // markup that rendered as literal text on the public page. Those
  // settings values don't flow through CmsText/CmsTextProvider, so
  // the rich-text pipeline never sees them. This local helper
  // applies the same allow-list detection + normalisation the CMS
  // path uses, returning a `dangerouslySetInnerHTML`-ready string
  // and a flag the JSX renderer uses to choose its branch.
  const RICH_TAGS_RE = /<\/?(?:em|strong|mark|br|p|ul|li|s)\b/i;
  const BROKEN_BR_RE = /<br\s*\/?\s*><\/br\s*>/gi;
  const taglineIsRich = RICH_TAGS_RE.test(tagline);
  const taglineHtml = taglineIsRich
    ? // Repair legacy `<br></br>` artefact + lift `\n` to `<br />`
      // when no block-level structure exists, matching the
      // `normalizeRichText` rules from lib/cms/render.ts.
      tagline
        .replace(BROKEN_BR_RE, "<br />")
        .replace(/\n/g, "<br />")
    : tagline;

  // ── Filter resolution ───────────────────────────────────────────────
  // URL-driven: `?cat=<id>` and `?tag=<id>` are honoured. Selected state
  // is computed once on the server and threaded through chip rendering
  // + the grid filter. Empty selectedCat/selectedTag means "all".
  const selectedCat = searchParams.cat || null;
  const selectedTag = searchParams.tag || null;

  const filteredCards = cards.filter(({ category_ids, tag_ids }) => {
    if (selectedCat && !category_ids.includes(selectedCat)) return false;
    if (selectedTag && !tag_ids.includes(selectedTag)) return false;
    return true;
  });

  // First three cards from the UNFILTERED list power the hero fan —
  // visitors should always see the same opening composition regardless
  // of which filter they're browsing. The catalogue below them is what
  // filters change.
  const fanCards = cards.slice(0, 3);

  const catLookup = new Map(categories.map((c) => [c.id, c]));
  const tagLookup = new Map(tags.map((tg) => [tg.id, tg]));

  // ── Used-only filter rows ──────────────────────────────────────────
  // The CMS can carry categories/tags that don't (yet) belong to any
  // active game card. Showing them as chips would dead-end the
  // visitor — clicking lands on an empty grid. Per Itzik 2026-05-20
  // we compute the set of IDs actually referenced by `cards` and
  // render only those chips. New active games + admin re-tagging
  // bring chips back automatically (no code change needed).
  const usedCatIds = new Set<string>();
  const usedTagIds = new Set<string>();
  for (const c of cards) {
    for (const id of c.category_ids) usedCatIds.add(id);
    for (const id of c.tag_ids) usedTagIds.add(id);
  }
  const usedCategories = categories.filter((c) => usedCatIds.has(c.id));
  const usedTags = tags.filter((tg) => usedTagIds.has(tg.id));

  // Helper to build chip URLs that toggle the chip rather than stack
  // params. Clicking the active chip clears the filter; clicking a new
  // one replaces it. Tags + categories are independent, so changing one
  // preserves the other.
  function chipHref(kind: "cat" | "tag", id: string | null): string {
    const params = new URLSearchParams();
    const cat = kind === "cat" ? (selectedCat === id ? null : id) : selectedCat;
    const tag = kind === "tag" ? (selectedTag === id ? null : id) : selectedTag;
    if (cat) params.set("cat", cat);
    if (tag) params.set("tag", tag);
    const qs = params.toString();
    // Hash-anchor to #catalogue so the page doesn't jump back to the
    // hero when a filter changes.
    return `/mioshy-sex${qs ? `?${qs}` : ""}#catalogue`;
  }

  // 2026-05-20 — `spineLabel` removed along with the vertical
  // editorial spine in the hero margin (Itzik trimmed it).

  // Catalogue structured data — brings the flagship listing to parity with
  // /games (Breadcrumb + CollectionPage + ItemList). The FAQPage is emitted
  // separately by the <FAQ> component further down the page.
  const base = siteUrl();
  const catalogueJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: isHe ? "בית" : "Home", item: `${base}/${locale}` },
          {
            "@type": "ListItem",
            position: 2,
            name: isHe ? "משחקים לזוגות למבוגרים" : "Adult couples games",
            item: `${base}/${locale}/mioshy-sex`,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        name: isHe ? "משחקים לזוגות למבוגרים" : "Adult couples games",
        url: `${base}/${locale}/mioshy-sex`,
      },
      {
        "@type": "ItemList",
        itemListElement: cards.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${base}/${locale}/mioshy-sex/${c.game.slug}`,
          name: isHe ? c.game.title_he : c.game.title_en || c.game.title_he,
        })),
      },
    ],
  };

  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative isolate min-h-[100dvh] overflow-hidden bg-[#070111] text-white"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(catalogueJsonLd) }}
      />
      {/* ── Static dark base wash behind the hero blobs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-30 h-[140dvh] bg-[linear-gradient(180deg,#070111_0%,#0e0220_24%,#170428_48%,#0e0220_76%,#070111_100%)]"
      />

      {/* ── HERO BLOBS — three converging gradient circles + grain.
            Extracted to <SexHeroBlobs> so the same field is shared
            with /mioshy-sex/[slug] pages and any future surface
            that needs the after-dark atmosphere. Anchored to the
            upper-mid axis so the three "dance" together near the
            hero instead of sitting in corners. */}
      <SexHeroBlobs isHe={isHe} />

      <CmsTextProvider rows={cmsRows}>
      <main className="relative">
        {/* ════════════════════════════════════════════════════════════
              HERO — two-column on lg+, stacked on smaller screens.
              The card fan sits on its own side rather than stacked
              under the headline, which makes desktop feel composed
              rather than "mobile blown up".
        ════════════════════════════════════════════════════════════ */}
        <section className="relative px-5 pb-16 sm:pb-20 lg:px-10 lg:pb-28">
          {/* Breadcrumb — sits at the top of the hero section with
              only `pt-4` of its own, matching /journey's pattern
              byte-for-byte (per Itzik 2026-05-20: "same height as
              Journey"). Section's top padding has been removed —
              the hero content block below carries its own top
              spacing via the spine + heading mt utilities. */}
          {/* Breadcrumb max-width matches the hero grid below
              (max-w-7xl) so both sit on the same right-edge line.
              No own px — the parent section provides px-5 / lg:px-10
              and the breadcrumb just inherits, removing the gap
              between breadcrumb edge and headline edge. */}
          <nav
            aria-label="breadcrumb"
            className="relative z-20 mx-auto hidden max-w-7xl items-center gap-2 pt-4 text-[14px] text-white/45 sm:flex"
          >
            {/* Explicit text-[14px] on each segment per Itzik 2026-05-20.
                The CMS row could carry a font_size override that would
                otherwise win over the nav's inherited text-[14px]; we
                lock the size at the leaf to guarantee 14px. */}
            <Link
              href="/"
              className="text-[14px] transition hover:text-white/75"
            >
              <CmsText cmsKey="mioshySexPage.heroBreadcrumbHome" />
            </Link>
            <span aria-hidden className="text-[14px] text-white/30">
              /
            </span>
            <CmsText
              cmsKey="mioshySexPage.heroBreadcrumbSection"
              as="span"
              className="text-[14px] text-white/65"
            />
          </nav>
          {/* Vertical editorial spine removed 2026-05-20 per Itzik —
              the "EST 2026 · MIOSHY · 18+" rotated label in the
              margin was a flagship-page flourish that wasn't pulling
              its weight visually. The breadcrumb above + the kicker
              line beside the headline already carry the brand /
              age-gate identity. */}

          {/* 2026-06-09 — lg gap widened 16→24 per Itzik so the hero text
              keeps clear space from the card fan. */}
          <div className="relative mx-auto mt-8 grid max-w-7xl items-center gap-12 sm:mt-12 lg:mt-20 lg:grid-cols-12 lg:gap-24">
            {/* TEXT COLUMN ──────────────────────────────────────────────
                lg:col-span-7. On mobile this is the only column visible,
                centred. On desktop it sits start-aligned with the card
                fan to its side. */}
            {/* 2026-06-09 — desktop text column capped at 560px per Itzik
                (was ~706px) so it stays clear of the card fan. */}
            <div className="text-center lg:col-span-7 lg:max-w-[560px] lg:text-start">
              {/* Kicker — single line, age-gate only. Per Itzik
                  2026-05-20 the `heroFlagshipLabel` ("רב מכר") row
                  was dropped from the page entirely; the kicker now
                  carries just the age-gate badge ("למבוגרים בלבד ·
                  18+") in a uniform 14px wash. */}
              <CmsText
                cmsKey="mioshySexPage.heroAgeGate"
                as="p"
                className="text-[14px] font-medium tracking-[0.18em] text-white/70"
              />

              {/* HEADLINE — single editorial line. heroHeadline2 was
                  removed 2026-05-20 per Itzik; the hero now carries
                  just heroHeadline1. Sizing inherited from globals.css
                  (`h1 { font-size: clamp(2.25rem, 4vw + 1rem, 4.5rem);
                  line-height: 1.08 }`). Only tracking/weight/family/
                  colour are overridden — never the responsive size. */}
              <CmsText
                cmsKey="mioshySexPage.heroHeadline1"
                as="h1"
                className="mt-6 tracking-tight text-white"
                style={{
                  fontFamily: "'Frank Ruhl Libre', serif",
                  fontWeight: 700,
                }}
              />

              {/* Hairline-with-diamond divider removed 2026-05-20 per
                  Itzik. Headline → tagline now reads with the natural
                  whitespace gap from the tagline's own margin-top. */}

              {/* Tagline — matched 2026-05-20 to the hero paragraph
                  treatment on the couples-games homepage. The value
                  comes from experience_settings (admin-editable in
                  the settings panel), so it doesn't flow through
                  CmsText. We branch here on whether the admin's
                  saved string contains allow-listed rich tags: rich
                  goes through dangerouslySetInnerHTML so <strong>,
                  <br>, <em>, <mark> render properly; plain goes
                  through React's normal text-node path. */}
              {taglineIsRich ? (
                <p
                  className="cms-rich mx-auto mt-6 max-w-xl text-pretty text-[22px] leading-[1.55] text-white lg:mx-0"
                  dangerouslySetInnerHTML={{ __html: taglineHtml }}
                />
              ) : (
                <p className="mx-auto mt-6 max-w-xl text-pretty text-[22px] leading-[1.55] text-white lg:mx-0">
                  {tagline}
                </p>
              )}

              <div className="mt-7 flex justify-center lg:justify-start">
                <Link
                  href="#catalogue"
                  className="relative inline-flex min-h-[58px] items-center justify-center overflow-hidden rounded-full px-10 text-[18px] font-semibold tracking-wide text-white shadow-2xl shadow-rose-600/40"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "linear-gradient(110deg,#F43F5E 0%,#EC4899 45%,#A855F7 100%)",
                    }}
                  />
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <CmsText cmsKey="mioshySexPage.heroCtaPrimary" />
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className={isHe ? "rotate-180" : ""}
                    >
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              </div>

              {/* Reassurance — pulled from the legacy CMS row that the
                  /mioshy-sex page already used, so the copy stays
                  consistent across surfaces and admins only manage one
                  source of truth. Per Itzik 2026-05-20: "3 רמות" was
                  wrong (these games don't have levels) and "מסירה
                  דיגיטלית מיידית" didn't sound human. The
                  `heroReassurance` row reads as a person wrote it. */}
              <CmsText
                cmsKey="mioshySexPage.heroReassurance"
                as="p"
                className="mt-5 text-[12px] font-medium uppercase tracking-[0.22em] text-white/55"
              />
            </div>

            {/* CARD FAN COLUMN ──────────────────────────────────────────
                lg:col-span-5. Spread wider (±100px on mobile, ±130px on
                lg) so the side cards' artwork is clearly visible — only
                the inner edge of each side card tucks under the centre. */}
            {fanCards.length > 0 ? (
              <div className="relative flex justify-center lg:col-span-5 lg:translate-x-[14%]">
                {/* Container grew with the cards (+10% per Itzik
                    2026-05-20) so the wider side-card offsets fit
                    without clipping. The outer wrapper above is
                    translated +14% on lg to nudge the fan right. */}
                <div className="relative h-[310px] w-full max-w-[620px] sm:h-[365px] sm:max-w-[730px] lg:h-[465px] lg:max-w-[860px]">
                  {fanCards.map((card, idx) => {
                    const total = fanCards.length;
                    // Spread + offset proportional to the new card
                    // size: ±175 / ±175 / ±175 keeps the geometric
                    // relationship with the bumped cards.
                    let rotate = 0;
                    let offsetX = 0;
                    let offsetY = 0;
                    let z = 10;
                    if (total === 3) {
                      if (idx === 0) {
                        rotate = -10;
                        offsetX = -175;
                        offsetY = 18;
                        z = 5;
                      } else if (idx === 2) {
                        rotate = 10;
                        offsetX = 175;
                        offsetY = 18;
                        z = 5;
                      } else {
                        z = 15;
                      }
                    } else if (total === 2) {
                      rotate = idx === 0 ? -7 : 7;
                      offsetX = idx === 0 ? -110 : 110;
                    }
                    const cardTitle = isHe
                      ? card.game.title_he
                      : card.game.title_en || card.game.title_he;
                    return (
                      <Link
                        key={card.game.id}
                        href={`/mioshy-sex/${card.game.slug}`}
                        aria-label={cardTitle}
                        // Card sizes bumped +10% per Itzik 2026-05-20:
                        // 195→215, 225→250, 280→310 px wide; heights
                        // scaled proportionally so each cover is even
                        // more poster-presence on the flagship hero.
                        className="absolute top-1/2 left-1/2 block h-[286px] w-[215px] sm:h-[340px] sm:w-[250px] lg:h-[440px] lg:w-[310px]"
                        style={{
                          transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${rotate}deg)`,
                          zIndex: z,
                        }}
                      >
                        <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/15 shadow-[0_22px_56px_-12px_rgba(80,4,40,0.65)]">
                          {card.game.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={card.game.cover_image_url}
                              alt={card.game.alt_text || (isHe ? card.game.title_he : card.game.title_en || card.game.title_he)}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-3xl text-white/40">
                              ♡
                            </div>
                          )}
                          <div
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/88 via-black/45 to-transparent"
                          />
                          {/* Title — `text-start` so it pins to the
                              right edge in RTL Hebrew (the natural
                              reading-start direction). On the right-
                              hand card that's the OUTER edge, fully
                              visible; on the left-hand card it's the
                              inner edge but the wider offsets above
                              keep enough air below the centre card
                              that all three titles read. Font size +
                              padding bumped for poster legibility. */}
                          <div className="absolute inset-x-0 bottom-0 p-4 text-start">
                            <div
                              className="line-clamp-2 text-[15px] font-bold leading-tight text-white sm:text-[17px] lg:text-[20px]"
                              style={{
                                fontFamily: "'Frank Ruhl Libre', serif",
                              }}
                            >
                              {cardTitle}
                            </div>
                          </div>
                          {/* Centre-card "Bestseller" ribbon removed
                              2026-05-20 per Itzik — was driven by
                              `heroFlagshipLabel` which has been pulled
                              from the page entirely. Z-index + rotation
                              already mark the middle card as the focal
                              point of the fan. */}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
              MANIFESTO — cream band, dark editorial copy.
              "What this really is". The light surface gives the eye a
              rest from the dark hero and re-anchors the page in
              editorial reading mode.
        ════════════════════════════════════════════════════════════ */}
        <section className="relative bg-[#FAF6F2] text-slate-900">
          {/* Manifesto layout per Itzik 2026-05-20: kicker + h2 are
              now CENTRED to match the Proof section's centered
              headline row beneath, so the two cream-band sections
              read as one rhythmic block. The body paragraphs stay
              start-aligned (running text centered is hard to read
              for paragraphs longer than a sentence) inside a
              centered max-w-2xl column, which keeps reading comfort
              while visually anchoring the column to the centre line. */}
          <div className="mx-auto max-w-3xl px-5 py-20 lg:py-24">
            <div className="text-center">
              {/* Kicker — plain inline-flex with dot + text, no pill. */}
              <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.22em] text-[#8B2638] sm:text-[11px] sm:tracking-[0.32em]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B83C4D] shadow-[0_0_8px_rgba(184,60,77,0.3)]" />
                <CmsText cmsKey="mioshySexPage.manifestoKicker" />
              </span>
              {/* h2 sizing inherited from globals.css. */}
              <h2
                className="mt-5 section-h2 text-balance font-semibold tracking-tight text-slate-900"
                style={{
                  fontFamily: "'Frank Ruhl Libre', serif",
                  fontWeight: 600,
                }}
              >
                <CmsText cmsKey="mioshySexPage.manifestoHeadlinePrefix" />{" "}
                <CmsText
                  cmsKey="mioshySexPage.manifestoHeadlineEmphasis"
                  as="span"
                  className="italic"
                  style={{
                    backgroundImage:
                      "linear-gradient(110deg,#B91C3C 0%,#BE185D 50%,#7E22CE 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                />
              </h2>
            </div>
            {/* Body text — fully centred per Itzik 2026-05-20 to
                match the kicker + h2 above and the Proof section
                below. Three rich-text rows; CmsText handles is_rich
                + color_override per row. */}
            <div className="mx-auto mt-8 max-w-2xl space-y-5 text-center text-[18px] leading-[1.7] text-slate-700 sm:text-[19px]">
              <CmsText cmsKey="mioshySexPage.manifestoBody1" as="p" />
              {/* 2026-06-09 — manifestoBody2 removed per Itzik (manifesto condensed). */}
              <CmsText
                cmsKey="mioshySexPage.manifestoBody3"
                as="p"
                className="font-semibold text-slate-900"
              />
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
              PROOF section removed 2026-05-20 per Itzik. The 80%/50%
              stat band has been pulled from the page entirely. Its
              CMS rows (proofKicker, proofHeadlinePrefix,
              proofHeadlineEmphasis, proofStat1Caption,
              proofStat2Caption) are still in cms_texts / messages
              JSON in case we resurface this section later, but
              nothing on the page reads them. The Manifesto cream
              band above now flows straight into the Catalogue dark
              band below.
        ════════════════════════════════════════════════════════════ */}

        {/* ════════════════════════════════════════════════════════════
              CATALOGUE — filter chips + game grid.
              Filters are URL-driven via searchParams. Active chip has
              a filled treatment; clicking it again clears the filter.
        ════════════════════════════════════════════════════════════ */}
        <section
          id="catalogue"
          className="relative bg-[#070111] px-5 pt-20 pb-24 lg:pt-24"
        >
          <div className="mx-auto max-w-6xl">
            {/* Catalogue intro — right-aligned (text-start in RTL =
                right edge) per Itzik 2026-05-20. h2 sizing comes from
                globals.css. */}
            <div className="mb-10 text-start">
              <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.22em] text-rose-200 sm:text-[11px] sm:tracking-[0.32em]">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-300 shadow-[0_0_8px_rgba(244,114,182,0.4)]" />
                <CmsText cmsKey="mioshySexPage.catalogueKicker" />
              </span>
              <h2
                className="mt-4 section-h2 tracking-tight text-white"
                style={{
                  fontFamily: "'Frank Ruhl Libre', serif",
                  fontWeight: 600,
                }}
              >
                <CmsText cmsKey="mioshySexPage.catalogueHeadlinePrefix" />{" "}
                <CmsText
                  cmsKey="mioshySexPage.catalogueHeadlineEmphasis"
                  as="span"
                  className="italic"
                  style={{
                    backgroundImage:
                      "linear-gradient(110deg,#F43F5E 0%,#EC4899 50%,#A855F7 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                />
              </h2>
              <p className="mt-3 max-w-xl text-[14px] text-white/55">
                {cards.length} {isHe ? "משחקים" : "games"}
              </p>
            </div>

            {/* FILTER BAR ──────────────────────────────────────────────
                Two rows: categories (with colour dots) and tags. Per
                Itzik 2026-05-20 we render only chips whose ID is
                referenced by at least one active game card — so the
                visitor never sees a chip that leads to an empty grid.
                The set is computed from `cards` above (usedCategories
                / usedTags). */}
            {usedCategories.length > 0 || usedTags.length > 0 ? (
              <div className="mb-10 space-y-4">
                {usedCategories.length > 0 ? (
                  <ChipRow
                    label={isHe ? "לפי קטגוריה" : "By category"}
                    allHref={chipHref("cat", null)}
                    allActive={!selectedCat}
                    items={usedCategories.map((c) => ({
                      id: c.id,
                      name: isHe ? c.name_he : c.name_en || c.name_he,
                      colour: c.color_hex || null,
                      href: chipHref("cat", c.id),
                      active: selectedCat === c.id,
                    }))}
                    allLabel={isHe ? "הכל" : "All"}
                  />
                ) : null}
                {usedTags.length > 0 ? (
                  <ChipRow
                    label={isHe ? "לפי תגית" : "By tag"}
                    allHref={chipHref("tag", null)}
                    allActive={!selectedTag}
                    items={usedTags.map((tg) => ({
                      id: tg.id,
                      name: `#${isHe ? tg.name_he : tg.name_en || tg.name_he}`,
                      colour: null,
                      href: chipHref("tag", tg.id),
                      active: selectedTag === tg.id,
                    }))}
                    allLabel={isHe ? "הכל" : "All"}
                  />
                ) : null}
                {selectedCat || selectedTag ? (
                  <div className="text-center text-[12.5px] text-white/55">
                    {filteredCards.length}{" "}
                    {isHe ? "תוצאות מסוננות" : "filtered results"}{" "}
                    <Link
                      href="/mioshy-sex#catalogue"
                      className="ms-2 inline-flex items-center gap-1 font-semibold text-rose-200 underline-offset-4 hover:underline"
                    >
                      {isHe ? "נקה סינון" : "Clear"}
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* GRID */}
            {filteredCards.length === 0 ? (
              <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/70">
                {selectedCat || selectedTag
                  ? isHe
                    ? "אין משחקים שתואמים את הסינון. נסו אפשרות אחרת."
                    : "No games match this filter. Try a different option."
                  : t("comingSoonBody")}
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {comingSoonFirst(filteredCards, (c) => c.game.opens_at).map(({ game, category_ids, tag_ids }) => {
                  const cardTitle = isHe
                    ? game.title_he
                    : game.title_en || game.title_he;
                  const cardDesc = isHe
                    ? game.short_desc_he
                    : game.short_desc_en || game.short_desc_he;
                  const cardCats = category_ids
                    .map((id) => catLookup.get(id))
                    .filter(Boolean)
                    .slice(0, 2);
                  const cardTags = tag_ids
                    .map((id) => tagLookup.get(id))
                    .filter(Boolean)
                    .slice(0, 3);
                  // D — coming-soon: card shows name/image/description, but the
                  // whole card (entry + the purchase flow it leads to) is
                  // disabled, with a live countdown until it opens.
                  const soon = isComingSoon(game.opens_at);

                  const cardMedia = (
                        <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-fuchsia-500/20 to-violet-500/15">
                          {game.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={game.cover_image_url}
                              alt={game.alt_text || cardTitle}
                              className={`h-full w-full object-cover ${soon ? "opacity-60" : ""}`}
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-5xl text-white/30">
                              ♡
                            </div>
                          )}
                          <div
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent"
                          />
                          {soon ? (
                            <>
                              <div className="absolute inset-0 bg-black/40" aria-hidden />
                              <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                                <ComingSoonCountdown opensAt={game.opens_at!} isHe={isHe} />
                              </div>
                            </>
                          ) : null}
                          <div
                            className="absolute top-3 z-10 flex flex-wrap gap-1.5"
                            style={{ [isHe ? "right" : "left"]: "0.75rem" }}
                          >
                            {soon ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-100 ring-1 ring-white/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
                                {isHe ? "בקרוב" : "SOON"}
                              </span>
                            ) : null}
                            {game.is_new ? (
                              <span className="rounded-full bg-gradient-to-r from-rose-500 to-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                                {isHe ? "חדש" : "NEW"}
                              </span>
                            ) : null}
                            {game.is_popular ? (
                              <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                                {isHe ? "פופולרי" : "POPULAR"}
                              </span>
                            ) : null}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-4">
                            <h3
                              className="line-clamp-2 text-[28px] font-bold leading-tight text-white"
                              style={{
                                fontFamily: "'Frank Ruhl Libre', serif",
                              }}
                            >
                              {cardTitle}
                            </h3>
                            {cardCats.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {cardCats.map((c) => (
                                  <span
                                    key={c!.id}
                                    className="inline-flex items-center gap-1 text-[14px] font-medium uppercase tracking-wider text-white/75"
                                  >
                                    {c!.color_hex ? (
                                      <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ background: c!.color_hex }}
                                      />
                                    ) : null}
                                    {isHe
                                      ? c!.name_he
                                      : c!.name_en || c!.name_he}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                  );

                  const cardBody = (
                        <div className="flex flex-1 flex-col gap-4 p-5">
                          {/* Card description — bumped to 18px per
                              Itzik 2026-05-20 (running text standard:
                              18–20px). The previous 14px read as
                              small-print on a flagship card. */}
                          {cardDesc ? (
                            <p className="line-clamp-3 text-[18px] leading-[1.6] text-white/80">
                              {cardDesc}
                            </p>
                          ) : null}
                          {/* 2026-06-09 — metric level chips (intimacy /
                              communication / heat) removed per Itzik. */}
                          {cardTags.length > 0 ? (
                            <div className="mt-auto flex flex-wrap gap-1.5">
                              {cardTags.map((tg) => (
                                <span
                                  key={tg!.id}
                                  className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[14px] text-white/65 ring-1 ring-white/10"
                                >
                                  #
                                  {isHe
                                    ? tg!.name_he
                                    : tg!.name_en || tg!.name_he}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {/* Price + CTA row — labels hardcoded HE/EN
                              rather than added as new CMS rows; they're
                              UI scaffolding, not editorial copy.
                              2026-05-21 Itzik — price NUMBER bumped 50%
                              (18→27px) while keeping the currency sign
                              at 18px so the symbol doesn't dominate
                              the card. Split into two spans so each
                              side can size independently. */}
                          {soon ? (
                            // Purchase disabled until the game opens.
                            <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                              <span className="text-[14px] font-semibold uppercase tracking-wider text-white/45">
                                {isHe ? "ייפתח בקרוב" : "Opening soon"}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-2 flex items-end justify-between gap-3 border-t border-white/10 pt-3">
                              <div>
                                <div className="text-[14px] font-medium uppercase tracking-wider text-white/45">
                                  {isHe ? "מחיר" : "Price"}
                                </div>
                                <div className="mt-0.5 leading-none">
                                  {game.price_ils ? (
                                    <div className="flex items-baseline gap-2">
                                      <span className="font-bold text-white">
                                        <span className="text-[27px] align-baseline">
                                          {isHe
                                            ? game.price_ils
                                            : (game.price_usd ?? game.price_ils)}
                                        </span>
                                        <span className="text-[18px] align-baseline">
                                          {" "}
                                          {isHe ? "₪" : "$"}
                                        </span>
                                      </span>
                                      {/* 2026-06-09 — fixed marketing anchor
                                          price (157), struck through, per Itzik. */}
                                      <span className="text-[16px] font-medium text-white/40 line-through">
                                        157 {isHe ? "₪" : "$"}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[18px] font-bold text-white">—</span>
                                  )}
                                </div>
                              </div>
                              <div className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-rose-200">
                                {t("cardDetailsCta")}
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden
                                  className={isHe ? "rotate-180" : ""}
                                >
                                  <path d="M5 12h14M13 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                  );

                  return (
                    <li key={game.id}>
                      {soon ? (
                        // Disabled: a <div>, not a <Link> — no entry/purchase
                        // until it opens.
                        <div
                          aria-disabled="true"
                          className="group relative flex h-full cursor-default flex-col overflow-hidden rounded-3xl border border-rose-300/30 bg-white/[0.025]"
                        >
                          {cardMedia}
                          {cardBody}
                        </div>
                      ) : (
                        <Link
                          href={`/mioshy-sex/${game.slug}`}
                          className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]"
                        >
                          {cardMedia}
                          {cardBody}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════
              FAQ — light editorial band, native <details> accordion.
              Zero JS. Opens/closes via the browser's built-in behaviour.
              All 8 Q&A from CMS.
        ════════════════════════════════════════════════════════════ */}
        {/* 2026-06-09 — FAQ swapped to the shared two-column <FAQ>
            component (same as homepage / games / journey) per Itzik.
            Content: mioshySexPage.faq.item{N}Q/A + header keys.
            Wrapped in .home-v2 so the shared `.faq` styling applies. */}
        <div className="home-v2">
          <FAQ
            cmsKeyPrefix="mioshySexPage.faq"
            cmsPage="mioshy-sex"
            numbers={[1, 2, 3, 4, 5, 6, 7, 8]}
            anchorId="faq-sex"
          />
        </div>

        {/* ════════════════════════════════════════════════════════════
              CLOSING CTA section removed 2026-05-20 per Itzik. The
              kicker / headline / reassurance / CTA-button block has
              been pulled from the page. Its CMS rows
              (closingKicker, closingHeadlinePrefix,
              closingHeadlineEmphasis, closingReassurance) remain in
              cms_texts / messages JSON in case the section is
              resurrected later, but nothing reads them. The FAQ
              cream band above now ends the page directly.
        ════════════════════════════════════════════════════════════ */}
      </main>
      </CmsTextProvider>
    </div>
  );
}

/**
 * ChipRow — a row of horizontally-scrollable filter chips. Renders an
 * "All" chip first (clears the axis) plus one chip per item. Active
 * chip gets a gradient fill; inactive chips are hairline outlines.
 * Server-rendered <a> tags — clicking navigates to the same page with
 * different `?cat=` / `?tag=` params, no client JS.
 */
function ChipRow({
  label,
  allHref,
  allActive,
  allLabel,
  items,
}: {
  label: string;
  allHref: string;
  allActive: boolean;
  allLabel: string;
  items: {
    id: string;
    name: string;
    colour: string | null;
    href: string;
    active: boolean;
  }[];
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
        {label}
      </div>
      <div className="-mx-1 flex flex-wrap gap-2 sm:gap-2.5">
        <ChipButton href={allHref} active={allActive}>
          {allLabel}
        </ChipButton>
        {items.map((it) => (
          <ChipButton key={it.id} href={it.href} active={it.active}>
            {it.colour ? (
              <span
                aria-hidden
                className="me-1.5 inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: it.colour }}
              />
            ) : null}
            {it.name}
          </ChipButton>
        ))}
      </div>
    </div>
  );
}

function ChipButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  // Chip font bumped to 14px (from 12.5px) per Itzik 2026-05-20 —
  // filter chips read as functional UI but still need the comfortable
  // legibility of the flagship's 14–20px running-text band. Padding
  // nudged up from py-1.5 → py-2 / px-3.5 → px-4 to keep the chip
  // proportions visually balanced against the larger glyph.
  return (
    <Link
      href={href}
      className={
        active
          ? "inline-flex items-center rounded-full px-4 py-2 text-[14px] font-semibold text-white shadow-md shadow-rose-600/30"
          : "inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-[14px] font-medium text-white/80 hover:border-white/30 hover:bg-white/[0.08]"
      }
      style={
        active
          ? {
              backgroundImage:
                "linear-gradient(110deg,#F43F5E 0%,#EC4899 50%,#A855F7 100%)",
            }
          : undefined
      }
    >
      {children}
    </Link>
  );
}

// StatCard helper removed 2026-05-20 along with the Proof section it
// served. If a future iteration brings the stat band back, recover
// the component from git history (or rebuild — it was 30 lines).

/**
 * LevelChip — fraction-style level indicator that mirrors the legacy
 * card design Itzik showed in the screenshot ("5/5 ♡"). Renders the
 * numeric ratio + a small icon. Pure inline SVG as the icon source —
 * placeholders for now. Itzik offered to send dedicated SVGs; once
 * those land they replace the inline paths here.
 *
 * Variants:
 *   • intimacy      — heart
 *   • communication — speech bubble
 *   • heat          — flame
 */
// 2026-06-09 — no longer rendered (metric chips removed). Kept on disk
// per convention; underscore-prefixed so eslint no-unused-vars ignores it.
function _LevelChip({
  label,
  level,
  variant,
}: {
  label: string;
  level: number;
  variant: "intimacy" | "communication" | "heat";
}) {
  const filled = Math.max(0, Math.min(5, level));
  // Per-variant accent colour. The chip itself is a hairline pill on
  // a translucent backdrop so it matches the catalogue dark surface.
  const accent =
    variant === "intimacy"
      ? "text-rose-300"
      : variant === "communication"
        ? "text-sky-300"
        : "text-orange-300";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[12.5px] font-medium text-white/85"
      title={label}
    >
      <span className="tabular-nums">
        <span className={`font-bold ${accent}`}>{filled}</span>
        <span className="text-white/40">/5</span>
      </span>
      <span aria-hidden className={accent}>
        {variant === "intimacy" ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          >
            <path d="M12 21s-7-4.5-9.5-9C0.5 8 3 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3 3.5 0 6 4 4 8-2.5 4.5-9.5 9-9.5 9z" />
          </svg>
        ) : variant === "communication" ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          >
            <path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4-1 3 1 4 1 1 0-2 1-4 1-6zm-3 14a3 3 0 0 0 6 0 5 5 0 0 1-3 4 5 5 0 0 1-3-4z" />
          </svg>
        )}
      </span>
    </span>
  );
}

// WaxSealSigil component removed 2026-05-20 per Itzik — the ornate
// brand crest above the headline was dropped in favour of a single
// 14px kicker line ("רב מכר — למבוגרים בלבד · 18+"). If a sigil
// returns later, the previous implementation can be recovered from
// git history; no need to keep dead code on disk.
