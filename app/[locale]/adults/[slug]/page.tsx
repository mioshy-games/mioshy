import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  Heart,
  MessageCircleHeart,
  Sparkles,
  Target,
} from "lucide-react";
import {
  getGameBySlug,
  getGameCategoryIds,
  getGameTagIds,
  listCategories,
  listTags,
  getBetweenUsSettings,
} from "@/lib/between-us/queries";
import { getCurrentCoupleContext } from "@/lib/between-us/couples";
import { AdultsHeroBuy } from "@/components/adults/AdultsHeroBuy";
// Page-wide animated mood lighting (drifting fog blobs + floating particles)
// - keeps the detail page from looking like a flat dark plate. Reuses the
// /adults marketing-surface ambience component.
import { AdultsAmbience } from "@/components/adults/AdultsAmbience";
// Diagnostic probe: logs from the page level whether the ambience layer
// actually rendered into the DOM, with bounding-box + child counts. Open
// DevTools and grep for [AmbienceDebugProbe:adults-detail] to verify.
import { AmbienceDebugProbe } from "@/components/adults/AmbienceDebugProbe";
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
      canonical: `${base}/${locale}/adults/${slug}`,
      languages: {
        en: `${base}/en/adults/${slug}`,
        he: `${base}/he/adults/${slug}`,
        "x-default": `${base}/en/adults/${slug}`,
      },
    },
    openGraph: {
      type: "article",
      url: `${base}/${locale}/adults/${slug}`,
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

  const [settings, ctx, catIds, tagIds, allCats, allTags] =
    await Promise.all([
      getBetweenUsSettings().catch(() => null),
      getCurrentCoupleContext(),
      // Note: per-game content (`listGameContent(game.id)`) used to be
      // fetched here for the now-removed preview card section. Don't
      // re-add this fetch on the public page - that data belongs only on
      // the gated /play surface.
      getGameCategoryIds(game.id),
      getGameTagIds(game.id),
      listCategories(true),
      listTags(true),
    ]);

  const entitled = !!ctx && ctx.couple_id !== null && ctx.entitled_game_ids.has(game.id);

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
  // on this public marketing page - it belongs on /adults/[slug]/play behind
  // the entitlement gate. We intentionally do not destructure it here.
  const benefits = isHe ? game.benefits_he : game.benefits_en ?? game.benefits_he;
  const targets = isHe
    ? game.target_audience_he
    : game.target_audience_en ?? game.target_audience_he;

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

  // ── Structured data - Product + BreadcrumbList ─────────────────────────
  // Without this, /adults/[slug] is the only public route on the site
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
      name: isHe ? "רכישה חד-פעמית" : "One-time purchase",
      price: tierAmount(pricing.single).toFixed(2),
      priceCurrency: productCurrency,
      availability: "https://schema.org/InStock",
      url: `${base}/${locale}/adults/${slug}`,
    });
  }
  if (pricing?.monthly?.enabled) {
    offers.push({
      "@type": "Offer",
      name: isHe ? "מינוי חודשי זוגי" : "Monthly couple plan",
      price: tierAmount(pricing.monthly).toFixed(2),
      priceCurrency: productCurrency,
      availability: "https://schema.org/InStock",
      url: `${base}/${locale}/adults/${slug}`,
    });
  }
  if (pricing?.annual?.enabled) {
    offers.push({
      "@type": "Offer",
      name: isHe ? "מינוי שנתי זוגי" : "Annual couple plan",
      price: tierAmount(pricing.annual).toFixed(2),
      priceCurrency: productCurrency,
      availability: "https://schema.org/InStock",
      url: `${base}/${locale}/adults/${slug}`,
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
            name: isHe ? "בית" : "Home",
            item: `${base}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: isHe ? "למבוגרים בלבד" : "Adults Only",
            item: `${base}/${locale}/adults`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: `${base}/${locale}/adults/${slug}`,
          },
        ],
      },
      {
        "@type": "Product",
        name: title,
        description: shortDesc,
        url: `${base}/${locale}/adults/${slug}`,
        ...(game.cover_image_url ? { image: game.cover_image_url } : {}),
        brand: { "@type": "Brand", name: "Mioshy" },
        category: gameCats
          .map((c) => (isHe ? c.name_he : c.name_en || c.name_he))
          .filter(Boolean)
          .join(", ") || (isHe ? "משחקי זוגיות למבוגרים" : "Adult couples games"),
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
    <div
      dir={isHe ? "rtl" : "ltr"}
      // `isolate` (CSS isolation: isolate) is CRITICAL here.
      // Without it, `position: relative` alone does NOT create a stacking
      // context, so the `-z-10` AdultsAmbience layer paints behind THIS
      // element's `bg-[#0a0410]` solid background - i.e. invisible.
      // Adding `isolate` makes the wrapper its own stacking context, so
      // `-z-10` paints between the wrapper's bg and the in-flow content.
      className="relative isolate min-h-[100dvh] overflow-hidden bg-[#0a0410] text-white"
    >
      {/* Deep midnight base + ambient color washes - same vocabulary as the
          /adults marketing surface so the detail page feels like part of the
          same after-dark room rather than a flat indigo plate. The fog
          blobs inside AdultsAmbience use mix-blend-screen, so overlapping
          blobs synthesize new colours where they meet (rose + fuchsia →
          magenta etc). For that to paint correctly, we DON'T set
          `isolation: isolate` anywhere between the blobs and the base wash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-full bg-[linear-gradient(180deg,#0a0410_0%,#13061a_25%,#1a071f_50%,#15051a_75%,#0a0410_100%)]"
      />
      <AdultsAmbience />
      <AmbienceDebugProbe label="adults-detail" />

      {/* Product structured data - Google rich-result eligibility. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Outer rail width AND padding match the SiteHeader exactly
          (max-w-7xl, mx-auto, px-4) so the page, header and footer
          all sit on the same vertical grid lines - same right edge in
          RTL on every screen. Content blocks below still cap themselves
          (max-w-3xl on the benefits column, etc.) for reading comfort. */}
      <main className="relative mx-auto max-w-7xl px-4 py-10">
        {/* Back link */}
        <Link
          href="/adults"
          className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft
            className={`h-4 w-4 ${isHe ? "rotate-180" : ""}`}
          />
          {isHe ? "חזרה לכל המשחקים" : "Back to all games"}
        </Link>

        {/* If the visitor already owns this game (e.g. they landed here
            from search instead of /my/adults), surface a one-click jump to
            the gated play surface so they don't get stuck on the marketing
            page they don't need anymore. */}
        {entitled ? (
          <Link
            href={`/adults/${slug}/play`}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 backdrop-blur transition hover:bg-emerald-400/15"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isHe ? "המשחק שלכם · פתחו אותו" : "You own this · Open game"}
          </Link>
        ) : null}

        {/* Hero - focused two-column layout.
            Per design spec: each column capped at 550px wide. Cover side
            also fixes its height at 420px (landscape). On screens <md the
            two columns stack vertically; on md+ they sit side-by-side and
            justify-center keeps the pair anchored to the page's centre
            instead of stretching to the full max-w-7xl rail. */}
        <section className="mt-6 flex flex-col items-stretch gap-8 md:flex-row md:items-start md:justify-center md:gap-10">
          <div className="w-full md:max-w-[550px] md:flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* "New" badge - was bg-emerald-500 (green), which clashed
                  against the rose / fuchsia / violet ambience. Now uses
                  the warm rose-amber gradient that matches the page's
                  primary CTA + headline gradient family. */}
              {game.is_new ? (
                <span className="rounded-full bg-gradient-to-r from-rose-500 to-amber-400 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
                  {isHe ? "חדש" : "New"}
                </span>
              ) : null}
              {game.is_popular ? (
                <span className="rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
                  {isHe ? "פופולרי" : "Popular"}
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
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {title}
            </h1>
            {shortDesc ? (
              <p className="mt-4 text-lg text-white/80">{shortDesc}</p>
            ) : null}

            {/* PRIMARY COMMERCE - big price + buy CTA, directly under the
                lede where the visitor's eye naturally lands after reading
                the short description. Replaces the old right-sidebar
                pricing panel + "Sign in required" lock card.
                Auto-resumes a logged-out purchase via ?continuePurchase=1
                after the visitor returns from the auth flow. */}
            {pricing ? (
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
            ) : null}

            {/* Levels */}
            <div className="mt-10 flex flex-wrap gap-3">
              <LevelPill
                icon={<Heart className="h-4 w-4 text-rose-200" />}
                label={isHe ? "אינטימיות" : "Intimacy"}
                level={game.intimacy_level}
              />
              <LevelPill
                icon={<MessageCircleHeart className="h-4 w-4 text-sky-200" />}
                label={isHe ? "תקשורת" : "Communication"}
                level={game.communication_level}
              />
              <LevelPill
                icon={<Flame className="h-4 w-4 text-orange-200" />}
                label={isHe ? "חום" : "Heat"}
                level={game.heat_level}
              />
            </div>

            {gameTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {gameTags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/70 ring-1 ring-white/10"
                  >
                    #{isHe ? t.name_he : t.name_en || t.name_he}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Cover - capped at 550px wide × 420px tall (landscape) per
              spec. On mobile, drops to a comfortable aspect-[4/3]
              auto-height so it doesn't crop ugly. */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/30 to-violet-500/20 shadow-2xl md:aspect-auto md:h-[420px] md:max-w-[550px] md:flex-1">
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
            lives on /adults/[slug]/play behind the entitlement gate.

            Layout: same start-aligned column as the hero copy (NOT
            mx-auto centred), so the title row + bullet rows share the
            same right-edge alignment in RTL. `mt-8` instead of `mt-12`
            pulls the section visually closer to the hero. */}
        <section className="mt-8">
          <div className="max-w-3xl space-y-8 text-start">
            {benefits && benefits.length > 0 ? (
              <div>
                {/* Section heading - bumped to text-2xl (24px) per design
                    spec ("at least 20px"). Body bullets bumped from
                    text-sm (14px) to text-base (16px) so the section as
                    a whole reads with more weight against the now-bright
                    background. */}
                <h2 className="text-2xl font-semibold text-white/95">
                  {isHe ? "מה תקבלו" : "What you'll get"}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {benefits.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-base leading-relaxed text-white/85"
                    >
                      <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-emerald-300" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {targets && targets.length > 0 ? (
              <div>
                <h2 className="text-2xl font-semibold text-white/95">
                  {isHe ? "המשחק הזה הוא בשבילכם אם…" : "This game is for you if…"}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {targets.map((t, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-base leading-relaxed text-white/85"
                    >
                      <Target className="mt-1 h-4 w-4 flex-shrink-0 text-fuchsia-200" />
                      <span>{t}</span>
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
            <h2 className="text-xl font-semibold text-white/95">
              {isHe ? "גלריה" : "Gallery"}
            </h2>
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
                 belongs exclusively on the gated /adults/[slug]/play
                 surface; leaking even "preview" cards onto the public
                 marketing page muddles that boundary.
            The public page now shows only image, short_desc, levels,
            categories/tags, benefits, target audience, gallery, and the
            commerce panel. Any actual game cards live behind the
            entitlement gate. */}
      </main>
    </div>
  );
}

function LevelPill({
  icon,
  label,
  level,
}: {
  icon: React.ReactNode;
  label: string;
  level: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs">
      {icon}
      <span className="text-white/80">{label}</span>
      <span className="font-semibold text-white">{level}/5</span>
    </div>
  );
}

