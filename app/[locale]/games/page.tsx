import type { Metadata } from "next";
import Image from "next/image";
import { getCmsTranslations } from "@/lib/cms/getCmsTranslations";
import { loadCmsTextsForPage } from "@/lib/cms/server";
import { CmsTextProvider } from "@/components/cms/CmsTextProvider";
import { CmsText } from "@/components/cms/CmsText";
import { unstable_noStore as noStore } from "next/cache";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import { Link } from "@/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/admin";
import { fetchGameSettings } from "@/lib/settings-queries";
import type { GameRow, WheelConfigRow } from "@/lib/types/database";
import type { GameSettings } from "@/lib/types/settings";
import type { WheelSegment } from "@/components/Wheel";
// 2026-05-20 — HeartHandshake / Sparkles / Shield removed from imports
// alongside the now-commented `whyMeta` array that was their only
// consumer. ArrowRight / Gamepad2 / Users still rendered in JSX so
// they stay. Lucide tree-shaking handles the bundle delta in prod;
// removing the import names just satisfies ESLint's unused-vars rule
// for the strict build.
import { ArrowRight, Gamepad2, Users, Wifi } from "lucide-react";
import { AdminThumbnailEdit } from "@/components/games/AdminThumbnailEdit";
// Lazy wrapper: code-splits LiveDemoHero (which embeds the full Wheel +
// framer-motion + sound effects) out of the initial /games bundle. The
// wrapper renders a sized skeleton during initial paint, then hydrates
// the real interactive demo on the client. Big win on TTI for visitors
// who never spin the wheel.
import { LazyLiveDemoHero } from "@/components/marketing/v2/LazyLiveDemoHero";
// MediaSlider import removed 2026-05-20 — press section was deleted
// from /games (homepage v2 still uses it via HomepageV2.tsx).
// import { MediaSlider } from "@/components/marketing/v2/MediaSlider";
// Counter import removed 2026-05-20 — was used by the #why section
// (`<Counter to={500} />`) which was deleted. Kept commented for
// quick restoration if Itzik wants the stats back.
// import { Counter } from "@/components/marketing/v2/Counter";
import { RevealOnScroll } from "@/components/marketing/v2/RevealOnScroll";
import { FAQ } from "@/components/marketing/v2/FAQ";
import { pickGameThumbnail } from "@/lib/games-thumbnail";
import { FreeBadge, SubscriptionTag } from "@/components/games/FreeBadge";
import { isComingSoon, comingSoonFirst } from "@/lib/games/coming-soon";
import { ComingSoonCountdown } from "@/components/games/ComingSoonCountdown";
import { GamesPageAtmosphere } from "@/components/games/GamesPageAtmosphere";
// `GamesOrbsDiagProbe` import removed 2026-05-19 along with the
// orbs field. Probe file kept on disk for future debugging.
// `BreadcrumbBackdropProbe` import removed 2026-05-20 — the probe
// helped us discover the missing-isolation bug; mystery solved
// (added `isolate` to the wrapper). Probe file kept on disk.

/**
 * /games - the games category landing page.
 *
 * Sections (top → bottom):
 *  1. Hero (dark, animated aurora)
 *  2. Why Mioshy (light bg, big cards)
 *  3. Benefits - "מה זה עושה לכם" (dark editorial spread, 4 emotion words)
 *  4. Press mentions (light bg)
 *  5. Catalogue - all active wheel games + virtual snakes card (light bg)
 *  6. Personas - "למי זה מתאים" (light bg, 3 magazine chapters)
 */

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
  const t = await getCmsTranslations({
    locale: locale === "he" ? "he" : "en",
    namespace: "gamesHub",
    page: "games",
  });
  // 2026-05-22 — Itzik switched to social-share-first copy: the new
  // gamesHub.title already contains "Mioshy · ..." so we no longer
  // prefix it. og:image:alt is locale-aware via gamesHub.ogImageAlt,
  // with a safe fallback to the title if the key is missing.
  const title = t("title");
  const description = t("subtitle");
  let ogImageAlt = title;
  try { ogImageAlt = t("ogImageAlt"); } catch { /* fallback to title */ }
  const canonical = `${base}/${locale}/games`;
  return {
    title,
    description,
    keywords: t("metaKeywords")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    alternates: {
      canonical,
      languages: {
        en: `${base}/en/games`,
        he: `${base}/he/games`,
        "x-default": `${base}/en/games`,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
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

// 2026-05-20 — GAMES_PAGE_BUILD constant removed alongside its only
// consumers (the diagnostic <script> tags and server-side log).
// Build verification now goes through the Vercel deployment URL.
// const GAMES_PAGE_BUILD = "2026-05-06-dark-ambient-v1";

export default async function GamesHubPage({
  params,
}: {
  params: { locale: string };
}) {
  noStore();
  const locale = params.locale;
  const isHe = locale === "he";
  // CMS-backed translator — retained for raw-string slots (metadata,
  // JSON-LD, alt props, sub-component string props). JSX-child
  // consumers below render via <CmsText> so they pick up is_rich
  // from each row and render <em>/<strong> via the .cms-rich CSS rule.
  // Bug fix 2026-05-13: pre-CmsTextProvider rendering ignored is_rich
  // and printed admin-entered <em> tags as literal text in the DOM.
  const t = await getCmsTranslations({
    locale: isHe ? "he" : "en",
    namespace: "gamesHub",
    page: "games",
  });
  const cmsRows = await loadCmsTextsForPage("games");

  const supabase = await createServerSupabaseClient();

  // Auth gate - same pattern as /adults: members skip the marketing
  // wrap and see just the catalog. Anonymous visitors get the full
  // story below.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthed = !!user;

  const { data } = await supabase
    .from("games")
    .select("*")
    // A.9 — free game(s) first (admin-controlled via is_free, no slug hardcode),
    // then newest. Puts "כנות ואתגר" at the top of the catalogue.
    .order("is_free", { ascending: false })
    .order("created_at", { ascending: false });
  // D — a scheduled (coming-soon) game always sorts FIRST, with its countdown.
  const games = comingSoonFirst((data ?? []) as GameRow[], (g) => g.opens_at);

  // 2026-05-20 — TEMP DIAGNOSTIC. Itzik reports the recent edits
  // (benefits-moved-below-hero, bg-white removed, alignment fix)
  // don't appear visually. Adding a build-stamped marker so we can
  // confirm whether the new server-rendered output is actually
  // reaching the browser. Look for `[GamesHubPage/DIAG]` in the
  // Vercel function logs OR Network → games doc → response HTML
  // for `<!--GAMES_PAGE_BUILD_…-->`. Remove once verified.
  const GAMES_PAGE_DIAG_STAMP = "2026-05-20T-benefits-above-press-v3";
  // eslint-disable-next-line no-console
  console.log("[GamesHubPage/DIAG]", JSON.stringify({
    stamp: GAMES_PAGE_DIAG_STAMP,
    locale,
    isAuthed,
    view: isAuthed ? "authed-catalog" : "marketing",
    benefitsPosition: "first-light-section-after-hero",
    benefitsBgWhite: false,
    benefitsWrapperClass: "relative overflow-hidden px-4 py-[60px]",
    benefitsInnerMaxWidth: "max-w-7xl",
  }));

  // ─── Logged-in catalog-only view ──────────────────────────────────────
  // Per Itzik 2026-05-02: returning members shouldn't re-read the same
  // marketing page on every visit. They land on a clean, dense grid
  // of every active game with a section title.
  if (isAuthed) {
    // No bg-color on the wrapper - GamesPageAtmosphere supplies the
    // base gradient via a child layer. A solid bg here would create a
    // stacking opaque surface that paints OVER negative-z children
    // (the gradient at -z-30, the radial wash at -z-20, the floating
    // blobs/orbits at -z-10) and the whole atmosphere would be
    // invisible. Itzik 2026-05-06: this is exactly the bug that
    // made "I don't see the change" reproducible.
    return (
      <CmsTextProvider rows={cmsRows}>
      <div
        dir={isHe ? "rtl" : "ltr"}
        className="relative min-h-[100dvh] overflow-hidden text-white"
      >
        {/* 2026-05-20 — [GamesHub/client] build-marker <script>
            removed from the authed branch (same change as marketing
            branch above). */}
        <GamesPageAtmosphere />
        {/* `GamesOrbsDiagProbe` removed 2026-05-19 — orbs are gone,
            the probe is no longer useful. File kept on disk. */}
        <main className="relative mx-auto max-w-7xl px-4 pb-20 pt-12 sm:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-300/30 bg-rose-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-100">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
            <CmsText cmsKey="gamesHub.cataloguePill" />
          </div>
          <CmsText
            cmsKey="gamesHub.catalogueTitle"
            as="h1"
            className="mt-3 font-heading text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
          />
          <CmsText
            cmsKey="gamesHub.catalogueHint"
            as="p"
            className="mt-2 max-w-2xl text-sm text-white/70"
          />

          {games.length === 0 ? (
            <CmsText
              cmsKey="gamesHub.noActiveGames"
              as="p"
              className="mt-12 text-white/60"
            />
          ) : (
            // Catalogue grid — 2 per row (was 3) per Itzik 2026-05-07.
            // Bigger card footprint reads as fewer "products" and more
            // "experiences".
            <ul className="mt-10 grid gap-7 sm:grid-cols-2">
              {games.map((g) => {
                const name = isHe ? g.name_he : g.name_en;
                const desc = isHe ? g.description_he : g.description_en;
                const thumb = pickGameThumbnail(g, locale);
                // D — coming-soon: card shows name/image/description, but entry
                // is disabled and a live countdown runs until it opens.
                const soon = isComingSoon(g.opens_at);

                const media = (
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-rose-500/30 to-fuchsia-500/20">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt={g.alt_text || name || g.name_he}
                        width={640}
                        height={400}
                        className={`h-full w-full object-cover ${
                          soon ? "opacity-60" : "transition group-hover:scale-105"
                        }`}
                        unoptimized
                      />
                    ) : null}
                    {soon ? (
                      <>
                        <div className="absolute inset-0 bg-black/45" aria-hidden />
                        <span className="absolute start-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-100 ring-1 ring-white/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
                          {isHe ? "בקרוב" : "Coming soon"}
                        </span>
                        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                          <ComingSoonCountdown opensAt={g.opens_at!} isHe={isHe} />
                        </div>
                      </>
                    ) : g.is_free ? (
                      <FreeBadge className="absolute start-3 top-3 z-10" />
                    ) : (
                      <SubscriptionTag className="absolute start-3 top-3 z-10" />
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                );

                const textBody = (
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-white group-hover:text-rose-100">
                      {name}
                    </h3>
                    {desc ? (
                      <p className="mt-2 line-clamp-2 text-sm text-white/70 transition-[max-height,color] duration-500 ease-in-out group-hover:line-clamp-none">
                        {desc}
                      </p>
                    ) : null}
                    <div className="mt-5 flex items-center justify-between">
                      {soon ? (
                        <span className="text-sm font-semibold text-white/45">
                          {isHe ? "ייפתח בקרוב" : "Opening soon"}
                        </span>
                      ) : (
                        <CmsText
                          cmsKey="gamesHub.playArrow"
                          as="span"
                          className="text-sm text-rose-200 group-hover:text-white"
                        />
                      )}
                    </div>
                  </div>
                );

                return (
                  <li key={g.id}>
                    {soon ? (
                      // Disabled: a <div>, not a <Link> — no entry until it opens.
                      <div
                        aria-disabled="true"
                        className="group block cursor-default overflow-hidden rounded-3xl border border-rose-300/30 bg-gradient-to-br from-white/10 to-white/5 shadow-xl backdrop-blur"
                      >
                        {media}
                        {textBody}
                      </div>
                    ) : (
                      <Link
                        href={`/games/${g.slug}`}
                        className="group block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-xl backdrop-blur transition hover:border-rose-300/40 hover:from-white/20"
                      >
                        {media}
                        {textBody}
                      </Link>
                    )}
                  </li>
                );
              })}

              {/* ── Virtual snakes & ladders card (authenticated view) ──
                  Same hardcoded card the marketing page renders alongside
                  DB-backed wheel games. The board game isn't a row in
                  `games`, it's a standalone /game route - but logged-in
                  members expect to see EVERY active product in their
                  catalogue, not just the wheel-based ones. */}
              <li>
                <Link
                  href="/game"
                  className="group block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 shadow-xl backdrop-blur transition hover:border-rose-300/40 hover:from-white/20"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-rose-500/30 via-fuchsia-500/25 to-violet-500/20">
                    {/* Thumbnail - drop the image at
                        /public/images/snakes-couples.webp (16:10 ratio
                        recommended, e.g. 1280×800). */}
                    <Image
                      src="/images/snakes-couples.webp"
                      alt={t("snakesName")}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                    <CmsText
                      cmsKey="gamesHub.newBadge"
                      as="span"
                      className="absolute end-3 top-3 rounded-full bg-gradient-to-r from-rose-400 to-fuchsia-400 px-3 py-1 text-xs font-bold text-white shadow-lg"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                  </div>
                  <div className="p-5">
                    <CmsText
                      cmsKey="gamesHub.snakesName"
                      as="h3"
                      className="text-xl font-bold text-white group-hover:text-rose-100"
                    />
                    <CmsText
                      cmsKey="gamesHub.snakesDesc"
                      as="p"
                      className="mt-2 line-clamp-2 text-sm text-white/70 transition-[max-height,color] duration-500 ease-in-out group-hover:line-clamp-none"
                    />
                    <div className="mt-5 flex items-center justify-between">
                      <CmsText
                        cmsKey="gamesHub.playArrow"
                        as="span"
                        className="text-sm text-rose-200 group-hover:text-white"
                      />
                    </div>
                  </div>
                </Link>
              </li>
            </ul>
          )}

        </main>
      </div>
      </CmsTextProvider>
    );
  }

  // ── Demo wheel data - fetch the live wheel_configs row of the
  //    "honesty-or-challenge" game so the hero's demo wheel uses
  //    the EXACT same slices/colours as the real production game.
  //    Falls back to wine-palette defaults inside LiveDemoHero if
  //    this lookup returns nothing. ───────────────────────────────
  const demoGame = games.find((g) => g.slug === "honesty-or-challenge") ?? null;
  let demoSlices: WheelSegment[] | null = null;
  let demoWheel: WheelConfigRow | null = null;
  let demoSettings: GameSettings | null = null;
  if (demoGame) {
    const [{ data: wheelData }, settings] = await Promise.all([
      supabase
        .from("wheel_configs")
        .select("*")
        .eq("game_id", demoGame.id)
        .maybeSingle(),
      fetchGameSettings(supabase, demoGame.id),
    ]);
    demoWheel = wheelData as WheelConfigRow | null;
    demoSettings = settings;
    if (demoWheel?.slices?.length) {
      demoSlices = demoWheel.slices.map((s) => ({
        type: s.question_type,
        label: isHe ? s.label_he : s.label_en,
        color: s.color,
      }));
    }
  }

  // Admin check - show image-edit overlay only to admins.
  const adminSession = await getAdminSession().catch(() => null);
  const isAdmin = !!adminSession;

  const base = siteUrl();
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
            name: t("breadcrumbGames"),
            item: `${base}/${locale}/games`,
          },
        ],
      },
      {
        "@type": "CollectionPage",
        name: t("title"),
        description: t("subtitle"),
        url: `${base}/${locale}/games`,
      },
      {
        "@type": "ItemList",
        itemListElement: games.map((g, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${base}/${locale}/games/${g.slug}`,
          name: isHe ? g.name_he : g.name_en,
        })),
      },
    ],
  };


  // 2026-05-20 — `whyMeta` retired alongside the #why section
  // (deleted earlier in this session). The Lucide icons it used
  // (Gamepad2, HeartHandshake, Sparkles, Shield) are still imported
  // at the top of the file for other consumers / future restoration.
  // const whyMeta = [
  //   { Icon: Gamepad2,      iconBg: "bg-[#B83C4D]", stat: t("statGames") },
  //   { Icon: HeartHandshake, iconBg: "bg-[#8B2638]", stat: t("statCouples") },
  //   { Icon: Sparkles,       iconBg: "bg-[#4A1721]", stat: t("statNoInstall") },
  //   { Icon: Shield,         iconBg: "bg-[#3D1F3D]", stat: t("statPrivate") },
  // ];

  // 2026-06-09 — trust row (התנסות חינמית · לשני בני הזוג · ללא התקנה ·
  // בלי הגבלת זמן) removed from the games hero per Itzik. The labels
  // (trustTry/trustForCouples/statNoInstall/trustWorldwide) stay in the
  // messages files, and LiveDemoHero still supports the `trust` prop —
  // it's simply no longer passed here.

  // V2 wine palette - three subtle warm gradients for tile hover glows
  const accents = [
    "from-[#B83C4D]/30 via-[#8B2638]/20 to-[#4A1721]/20",
    "from-[#8B2638]/30 via-[#4A1721]/20 to-[#3D1F3D]/20",
    "from-[#4A1721]/30 via-[#3D1F3D]/20 to-[#1E0F1E]/20",
  ];

  // Editorial benefits — 3 focused emotion words (תשוקה / חברות / כיף).
  // 2026-05-20 — original `benefitNumerals = ["I", "II", "III"]` removed.
  // Itzik flagged Roman numerals as feeling "academic" — replaced with
  // unicode glyphs (♡ ✦ ✺) inlined directly in the JSX. CMS keys
  // (gamesHub.benefits.{i}.{title,body}) still drive the editable text.

  // Personas - magazine chapters on light. Three couple archetypes.
  // Chapter numerals (01/02/03) stay inline (static); tag/title/body/quote
  // are CMS-managed via gamesHub.personas.{i}.*.
  // 2026-06-09 — personaNumerals removed together with the Personas section.

  return (
    <CmsTextProvider rows={cmsRows}>
    {/* 2026-05-19 — `isolate` (CSS isolation:isolate) added to the
        marketing wrapper. THIS IS THE FIX for the "breadcrumb sits on
        black" mystery the BreadcrumbBackdropProbe found.
        Why: the wine-gradient divs below use `-z-20` / `-z-10`. The
        wrapper's `relative` alone does NOT create a stacking context
        (only relative + an explicit z-index does), so the negative-z
        gradients escape the wrapper's local stacking context entirely
        and end up painted BEHIND <body>'s background-color (which is
        `bg-[var(--mio-bg)]` = #0d0a14 on the Chrome wrapper). Result:
        the breadcrumb strip showed the dark `--mio-bg` instead of the
        wine atmosphere we intended.
        `isolate` forces the wrapper into a new stacking context, so
        the negative-z gradients now stay inside it (painted above the
        Chrome bg, below the breadcrumb). Matches the /journey
        wrapper at app/[locale]/journey/page.tsx#L174 which had this
        from day one. */}
    <div
      className="relative isolate min-h-[100dvh] overflow-hidden text-white"
      dir={isHe ? "rtl" : "ltr"}
    >
      {/* 2026-05-20 — [GamesHub/client] build-marker <script> and
          <BreadcrumbBackdropProbe /> both removed. The probe served
          its purpose (helped diagnose the missing-isolation bug);
          the build marker is reproducible via Network panel hash
          inspection without a console.log running on every load. */}
      {/* 2026-05-20 TEMP DIAGNOSTIC — Itzik can't see the recent
          changes. The HTML comment + client console.log below confirm
          which version of /games is actually served. To verify:
            (1) View Source on /he/games → grep for "GAMES_PAGE_BUILD_"
                — the stamp string proves SSR HTML is fresh.
            (2) Browser console → look for "[GamesHub/client/DIAG]". */}
      <script
        dangerouslySetInnerHTML={{
          __html: `console.log("[GamesHub/client/DIAG]", { stamp: "${GAMES_PAGE_DIAG_STAMP}", route: "marketing", benefitsAt: "first-section-after-hero", benefitsBgWhiteRemoved: true });`,
        }}
      />
      {/* Inline marker visible in View Source: */}
      {/* GAMES_PAGE_BUILD_2026-05-20T-benefits-above-press-v3 */}

      {/* ── Dark hero backdrop (covers ONLY the first viewport - 110vh).
          Per Itzik 2026-05-06: revert of the page-wide dark treatment.
          The dark atmosphere belongs to the hero + the #catalogue section
          only; the marketing copy in between (Why / Press / Personas /
          Benefits) reads on the cream surface like the original design.

          2026-05-19 — reverted to top:0 to match the /journey treatment
          per Itzik. The dark wine gradient extends behind the breadcrumb
          (no transparent strip at the top). /journey's app/[locale]/
          journey/page.tsx uses the same top:0 + h-[110vh] for the wine
          backdrop and top:0 + h-[85vh] for the radial layer, and the
          two pages should feel identical at the page-header strip. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[110vh] bg-[linear-gradient(180deg,#0E0810_0%,#1A0B14_55%,#1E0F1E_100%)]"
      />
      {/* Wine + magenta + violet aurora wash — copied verbatim from
          /journey so the two pages feel like the same atmosphere.
          Differences from the previous /games version:
            • `animate-aurora-drift` added (subtle motion already in use
              on /journey).
            • Third radial stop swapped from wine-dark @ 50%/40% to
              violet @ 50%/65% with opacity 0.32 → 0.40 — gives the
              header strip a real wine + violet blend instead of a
              flat dark wine; this is the visible difference Itzik
              flagged between the two pages' header areas. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[85vh] animate-aurora-drift"
        style={{
          background:
            "radial-gradient(1100px 640px at 14% 0%, rgba(184,60,77,0.55), transparent 62%), " +
            "radial-gradient(900px 520px at 88% 12%, rgba(217,70,239,0.45), transparent 60%), " +
            "radial-gradient(900px 560px at 50% 65%, rgba(168,85,247,0.40), transparent 60%)",
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <main className="relative">

        {/* ════════════════════════════════════════════════════════════
            1. HERO - dark, animated
        ════════════════════════════════════════════════════════════ */}
        <section className="relative">
          {/* 2026-05-19 round 3 — breadcrumb pulled out of the document
              flow and floated ABSOLUTELY over the LiveDemoHero so it
              sits on top of the GAME's own atmosphere (GamePageBackground
              with honesty-or-challenge's bg_value), not on the page-level
              wine wash above it. Earlier rounds tried matching the page-
              level wine to LiveDemoHero's bg, but they're produced by
              different components (page-wrapper radial-gradient vs
              GamePageBackground's blob system) and never matched
              exactly — that produced the visible "wine strip above /
              navy strip below" seam Itzik flagged.
              The breadcrumb is now position:absolute top-0 with z-30,
              and the LiveDemoHero below starts at the section's top
              (no gap reserved for the breadcrumb) — so the LiveDemoHero
              atmosphere paints all the way up under the breadcrumb,
              and the breadcrumb visually integrates with the hero
              instead of competing with it. */}
          <nav
            aria-label="breadcrumb"
            className="absolute inset-x-0 top-0 z-30 mx-auto hidden max-w-7xl items-center gap-2 px-4 pt-4 text-[13px] text-white/45 sm:flex"
          >
            <Link href="/" className="transition hover:text-white/75">
              <CmsText cmsKey="gamesHub.breadcrumbHome" />
            </Link>
            <span aria-hidden className="text-white/30">/</span>
            <CmsText
              cmsKey="gamesHub.breadcrumbGames"
              as="span"
              className="text-white/65"
            />
          </nav>

          {/* Per Itzik 2026-05-07: secondary CTA "למה מיאושי?" removed
              from the hero — the section "Why Mioshy" lives just below
              and is reached by scrolling. The hero now has one primary
              CTA only ("All games") for less visual noise. */}
          <LazyLiveDemoHero
            isHe={isHe}
            title={t("h1")}
            lede={t("lede")}
            ctaPrimary={t("ctaPrimary")}
            ctaPrimaryHref="#catalogue"
            ctaSecondary={undefined}
            ctaSecondaryHref={undefined}
            badge={t("heroBadge")}
            gameHref={demoGame ? `/games/${demoGame.slug}` : "#catalogue"}
            sampleQuestionType={t("sampleQuestionType")}
            sampleQuestion={t("sampleQuestion")}
            slices={demoSlices}
            wheelConfig={demoWheel}
            gameSettings={demoSettings}
            gameSlug={demoGame?.slug ?? "honesty-or-challenge"}
            gameBgValue={demoGame?.bg_value ?? null}
          />
          {/* /LazyLiveDemoHero - the underlying LiveDemoHero is loaded via
              next/dynamic with ssr:false; see LazyLiveDemoHero.tsx. */}
        </section>

        {/* ════════════════════════════════════════════════════════════
            LIGHT SECTIONS - #why + #press + #catalogue + #personas
            Itzik 2026-05-06 revert: the marketing copy below the hero
            reads on a cream surface (original design). Only the
            #catalogue section inside this wrapper opts back into a dark
            surface - see its own bg/style block.
        ════════════════════════════════════════════════════════════ */}
        <div className="bg-[#FAF6F7] pb-[60px] text-slate-900">

          {/* ── Transition: dark → light wave divider ── */}
          <div className="pointer-events-none -mt-16 h-16 bg-[linear-gradient(to_bottom,transparent,#FAF6F7)]" />

          {/* 2026-05-20 — BENEFITS moved up from the bottom of the page
              to here (first light section after the hero). Was the very
              last marketing block above the footer; Itzik wants it
              immediately under the hero. Also dropped its `bg-white`
              wrapper class so the section now blends with the cream
              parent (#FAF6F7) instead of reading as a discrete white
              card. Original CmsKeys (gamesHub.whyItWorks.*,
              gamesHub.benefits.{i}.*) unchanged.
              2026-05-20 round 2 — outer wrapper normalised to match
              other sections (`relative overflow-hidden px-4 py-[60px]`)
              instead of the prior `mx-4 sm:mx-8 lg:mx-12 px-6...` which
              produced non-standard side insets that didn't line up
              with the SiteHeader logo or the press/catalogue/personas
              sections below. Inner `max-w-4xl → max-w-7xl` so the
              right edge of the benefit rows aligns horizontally with
              the SiteHeader's logo column and every other content
              column on the page. */}
          <section
            id="benefits"
            data-benefits-position="above-press-v3"
            data-bg-white-removed="true"
            data-stamp="2026-05-20T-benefits-above-press-v3"
            className="relative overflow-hidden px-4 py-[60px]"
          >
            <div className="relative mx-auto max-w-7xl">
              {/* Header - right-aligned (RTL natural). Single reading axis, no
                  center→right awkwardness. */}
              <RevealOnScroll variant="scale-up">
                {/* 2026-06-09 — centered on desktop, right-aligned on
                    mobile, per Itzik (approved mockup). */}
                <div className="text-start lg:text-center">
                  <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.32em] text-[#170E14]">
                    <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.18)]" />
                    <CmsText cmsKey="gamesHub.whyItWorks.eyebrow" />
                  </span>
                  {/* 2026-05-20 — `gamesHub.whyItWorks.titleLine2`
                      (the wine-italic "ערב שלם אחר." suffix) removed
                      from the headline per Itzik. The CMS key itself
                      is NOT deleted from cms_texts or messages/*.json
                      so admins can restore it later by re-adding the
                      <CmsText> below; for now the headline shows just
                      titleLine1. */}
                  <h2
                    className="mt-7 section-h2 tracking-[-0.02em] text-[#170E14] lg:mx-auto lg:max-w-[820px]"
                    style={{
                      fontFamily: "'Frank Ruhl Libre', serif",
                      fontWeight: 600,
                    }}
                  >
                    <CmsText cmsKey="gamesHub.whyItWorks.titleLine1" />
                  </h2>
                  <CmsText
                    cmsKey="gamesHub.whyItWorks.lede"
                    as="p"
                    className="mt-2 max-w-2xl text-[22px] leading-[1.5] text-[#3D2C36] lg:mx-auto lg:text-[24px]"
                  />
                </div>
              </RevealOnScroll>

              {/* 2026-05-20 round 5 — Itzik: cards too prominent.
                  Stripped ALL card chrome (no background tint, no
                  border ring, no rounded corners, no shadow, no
                  hover-lift). What's left is the typography only —
                  glyph + word + body — sitting in 3 columns of pure
                  whitespace on the parent cream.

                  The 3 columns are separated by a single thin wine
                  hairline that softly fades at top/bottom (gradient
                  mask), so the divider reads as a typographic
                  flourish rather than a hard edge. On mobile the
                  vertical dividers go away (single column stack)
                  and natural spacing takes over.

                  Implementation note: `before:` pseudo-element keyed
                  to inline-start respects RTL automatically — the
                  hairline ends up between adjacent cards regardless
                  of script direction. `first:before:hidden` strips
                  the line from the first column so we don't get a
                  stray hairline on the leading edge. */}
              <div className="mt-[52px] grid gap-12 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-14 lg:mt-[52px] lg:grid-cols-3 lg:gap-x-12 lg:gap-y-0">
                {[0, 1, 2].map((i) => {
                  return (
                    <RevealOnScroll
                      key={i}
                      variant="fade-up"
                      delay={0.1 + i * 0.08}
                    >
                      <article
                        className="group relative px-2 text-start lg:px-6 lg:text-center"
                      >
                        {/* 2026-06-09 — glyph (♡ ✦ ✺), the divider
                            hairline (before:*), and the ink-black period
                            after the word were all removed per Itzik
                            (approved mockup). The card opens straight on
                            the centered word. */}
                        <h3
                          className="text-[34px] leading-[1] text-[#B83C4D] sm:text-[38px] lg:text-[40px]"
                          style={{
                            fontFamily: "'Frank Ruhl Libre', serif",
                            fontStyle: "italic",
                            fontWeight: 500,
                          }}
                        >
                          <CmsText cmsKey={`gamesHub.benefits.${i}.title`} />
                        </h3>

                        {/* Body — natural readable size, ink-dark
                            for contrast on the cream parent. */}
                        <CmsText
                          cmsKey={`gamesHub.benefits.${i}.body`}
                          as="p"
                          className="mt-4 text-[17px] leading-[1.65] text-[#3D2C36] lg:mx-auto lg:mt-5 lg:max-w-[15rem] lg:text-[18px]"
                        />
                      </article>
                    </RevealOnScroll>
                  );
                })}
              </div>

              {/* 2026-05-20 — closing italic `gamesHub.whyItWorks.closing`
                  removed per Itzik. CMS key + JSON fallback are left
                  intact so it can be re-added later without a deploy. */}
            </div>
          </section>

          {/* `<section id="why">` (Why Mioshy: 4 stat cards + social-
              proof pull-quote + CTA) removed 2026-05-19 per Itzik.
              The CMS keys it referenced (`gamesHub.whyBadge`,
              `gamesHub.whyTitle`, `gamesHub.whyHook`,
              `gamesHub.whyItems.{0..3}.{h,p}`, `gamesHub.byTheNumbers.*`)
              are NOT deleted from the cms_texts table or messages/*.json
              — admins may want to bring the section back, and the
              `whyMeta`/`personaNumerals` constants are still in scope
              above. Just the JSX block was removed so the marketing
              page now goes straight from the dark hero → wave-divider
              → light press section → catalogue. */}

          {/* 2026-05-20 — PRESS section (id="press", MediaSlider)
              removed from /games per Itzik. The component file
              `components/marketing/v2/MediaSlider.tsx` is left intact
              — homepage v2 still mounts it via HomepageV2.tsx, so the
              press logos / quotes are still surfaced sitewide; just
              not duplicated on the /games catalog page. CMS keys
              (homeV2.media.*) and the import of MediaSlider can be
              dropped from this file later if a full cleanup pass is
              done; for now we keep the import to avoid touching
              unrelated lines. */}

          {/* ════════════════════════════════════════════════════════════
              4. CATALOGUE - all wheel games + snakes virtual card
          ════════════════════════════════════════════════════════════ */}
          <section
            id="catalogue"
            className="relative overflow-hidden bg-[#0E0810] px-4 pb-24 pt-14 text-white"
          >
            {/* ── Animated atmosphere ──────────────────────────────────────
                Dark wine gradient base + drifting blobs + floating glow +
                12 small orbit dots. Mirrors the inner-page (journey)
                animation language but in the catalogue's wine/burgundy
                palette so the section feels stitched into the wider site.
                Lifted from -z-10 to z-0; content above sets z-10. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            >
              {/* Aurora wash */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(900px 600px at 18% 25%, rgba(184,60,77,0.18), transparent 60%), " +
                    "radial-gradient(800px 540px at 82% 75%, rgba(61,31,61,0.22), transparent 60%), " +
                    "linear-gradient(160deg, #1A0A14 0%, #0E0810 60%, #1A0A14 100%)",
                }}
              />
              {/* Converging blobs - wine red ↔ deep burgundy */}
              <div className="catalogue-blob catalogue-blob-1" />
              <div className="catalogue-blob catalogue-blob-2" />
              {/* Soft floating circle */}
              <div className="catalogue-floating-circle" />
              {/* Floating orbs (.catalogue-orbs-field) removed
                  2026-05-19 per Itzik — sizing experiments didn't
                  land. CSS rule kept inert in the page <style>
                  block for future reuse. */}
            </div>

            <div className="relative z-10 mx-auto max-w-7xl">
              {/* Stacked header - eyebrow + title + lead description.
                  Per Itzik 2026-05-06: lead reads BELOW the title (not on
                  the side) so the catalogue copy flows top-to-bottom. */}
              <div className="flex flex-col items-start gap-4">
                <span className="inline-flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.2em] text-rose-200">
                  <span className="h-[7px] w-[7px] rounded-sm bg-[#B83C4D] shadow-[0_0_0_3px_rgba(184,60,77,0.28)]" />
                  <CmsText cmsKey="gamesHub.cataloguePill" />
                </span>
                <CmsText
                  cmsKey="gamesHub.catalogueTitle"
                  as="h2"
                  className="font-heading section-h2 font-bold tracking-[-0.02em] text-white"
                />
                <CmsText
                  cmsKey="gamesHub.catalogueHint"
                  as="p"
                  className="max-w-2xl text-[18px] leading-[1.6] text-white/70"
                />
              </div>

              {games.length === 0 && (
                <p className="mt-10 text-white/60">-</p>
              )}

              {/* Catalogue grid — 2 per row (was 3) per Itzik 2026-05-07.
                Bigger card footprint reads as fewer "products" and more
                "experiences". */}
            <ul className="mt-10 grid gap-7 sm:grid-cols-2">
                {/* ── Regular wheel games from DB ── */}
                {games.map((g, idx) => {
                  const name = isHe ? g.name_he : g.name_en;
                  const desc = isHe ? g.description_he : g.description_en;
                  const accent = accents[idx % accents.length]!;
                  const thumb = pickGameThumbnail(g, locale);
                  // QA 2026-06-16 — bring the public marketing catalogue in line
                  // with the members' catalogue: free badge / subscription tag,
                  // and a coming-soon countdown (locked, no entry) for scheduled
                  // games. Ordering (free-first, coming-soon-first) already comes
                  // from the shared `games` array above.
                  const soon = isComingSoon(g.opens_at);

                  const media = (
                    <div className="relative aspect-[16/10] w-full overflow-hidden">
                      {thumb ? (
                        <>
                          <Image
                            src={thumb}
                            alt={g.alt_text || name || g.name_he}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className={`object-cover transition duration-700 ${
                              soon ? "opacity-60" : "group-hover:scale-[1.05]"
                            }`}
                          />
                          <div
                            aria-hidden
                            className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                          />
                        </>
                      ) : (
                        <div
                          className={`grid h-full w-full place-items-center bg-gradient-to-br ${accent}`}
                        >
                          <Gamepad2 className="h-12 w-12 text-white/70" />
                        </div>
                      )}
                      {soon ? (
                        <>
                          <div className="absolute inset-0 bg-black/45" aria-hidden />
                          <span className="absolute start-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-100 ring-1 ring-white/20">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
                            {isHe ? "בקרוב" : "Coming soon"}
                          </span>
                          <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                            <ComingSoonCountdown opensAt={g.opens_at!} isHe={isHe} />
                          </div>
                        </>
                      ) : g.is_free ? (
                        <FreeBadge className="absolute start-3 top-3 z-10" />
                      ) : (
                        <SubscriptionTag className="absolute start-3 top-3 z-10" />
                      )}
                      {/* Admin image-swap overlay - pre-fills with the
                          current per-locale URLs so the admin can edit
                          either or both. */}
                      {isAdmin && (
                        <AdminThumbnailEdit
                          gameId={g.id}
                          initialHe={g.thumbnail_url_he}
                          initialEn={g.thumbnail_url_en}
                        />
                      )}
                    </div>
                  );

                  const body = (
                    <div className="flex flex-1 flex-col p-6">
                      {/* Per Itzik 2026-05-07: game card titles in
                          the catalogue serif (Frank Ruhl Libre) so
                          they read as named things, not labels. */}
                      <h3
                        className="text-[32px] font-bold leading-[1.15] tracking-[-0.01em] text-white"
                        style={{ fontFamily: "var(--font-frank-ruhl), 'Frank Ruhl Libre', serif" }}
                      >
                        {name}
                      </h3>
                      {desc ? (
                        <p className="mt-2 line-clamp-3 text-[25px] leading-[1.5] text-white transition-[max-height,color] duration-500 ease-in-out group-hover:line-clamp-none sm:text-[22px]">
                          {desc}
                        </p>
                      ) : null}
                      {soon ? (
                        <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[18px] font-semibold text-white/45">
                          {isHe ? "ייפתח בקרוב" : "Opening soon"}
                        </span>
                      ) : (
                        <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[18px] font-semibold text-rose-200 transition group-hover:text-white">
                          {t("ctaPrimary")}
                          <ArrowRight
                            className={`h-5 w-5 transition group-hover:translate-x-1 ${
                              isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                            }`}
                          />
                        </span>
                      )}
                    </div>
                  );

                  return (
                    <li key={g.id} className="group relative">
                      {/* Hover glow */}
                      <div
                        aria-hidden
                        className={`pointer-events-none absolute -inset-px -z-10 rounded-[28px] bg-gradient-to-br ${accent} opacity-0 blur-xl transition duration-500 group-hover:opacity-60`}
                      />
                      {soon ? (
                        // Locked until it opens — a <div>, not a <Link>.
                        <div
                          aria-disabled="true"
                          className="relative flex h-full cursor-default flex-col overflow-hidden rounded-3xl border border-rose-300/30 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-sm"
                        >
                          {media}
                          {body}
                        </div>
                      ) : (
                        <Link
                          href={`/games/${g.slug}`}
                          className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-rose-300/40 hover:bg-white/[0.07]"
                        >
                          {media}
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}

                {/* ── Virtual snakes & ladders card - dark wine palette ── */}
                <li className="group relative">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-px -z-10 rounded-[28px] bg-gradient-to-br from-[#B83C4D]/40 via-[#8B2638]/30 to-[#3D1F3D]/30 opacity-0 blur-xl transition duration-500 group-hover:opacity-70"
                  />
                  <Link
                    href="/game"
                    className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-rose-300/40 hover:bg-white/[0.07]"
                  >
                    {/* Thumbnail - see /public/images/snakes-couples.webp */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-[#B83C4D]/30 via-[#8B2638]/25 to-[#3D1F3D]/30">
                      <Image
                        src="/images/snakes-couples.webp"
                        alt={t("snakesName")}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      />
                      {/* New badge */}
                      <CmsText
                        cmsKey="gamesHub.newBadge"
                        as="span"
                        className="absolute end-3 top-3 rounded-full bg-gradient-to-r from-[#B83C4D] to-[#8B2638] px-3 py-1 text-xs font-bold text-white shadow-lg"
                      />
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      {/* Multi-player badge - on-dark variant */}
                      {/* 2026-06-09 — second badge ("גם מרחוק") added per
                          Itzik: snakes & ladders is playable even when the
                          partners aren't side by side. */}
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-100">
                          <Users className="h-3 w-3" />
                          <CmsText cmsKey="gamesHub.snakesPlayers" />
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-100">
                          <Wifi className="h-3 w-3" />
                          <CmsText cmsKey="gamesHub.snakesRemote" />
                        </span>
                      </div>
                      <CmsText
                        cmsKey="gamesHub.snakesName"
                        as="h3"
                        className="text-[32px] font-bold leading-[1.15] tracking-[-0.01em] text-white"
                        style={{ fontFamily: "var(--font-frank-ruhl), 'Frank Ruhl Libre', serif" }}
                      />
                      <CmsText
                        cmsKey="gamesHub.snakesDesc"
                        as="p"
                        className="mt-2 line-clamp-3 text-[25px] leading-[1.5] text-white transition-[max-height,color] duration-500 ease-in-out group-hover:line-clamp-none sm:text-[22px]"
                      />
                      <span className="mt-auto inline-flex items-center gap-2 pt-5 text-[18px] font-semibold text-rose-200 transition group-hover:text-white">
                        <CmsText cmsKey="gamesHub.playNow" />
                        <ArrowRight
                          className={`h-5 w-5 transition group-hover:translate-x-1 ${
                            isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                          }`}
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              </ul>

            </div>

            {/* Inline keyframes/styles for the catalogue atmosphere - kept
                local so the new pattern doesn't bleed into other dark
                sections that might want their own palette. */}
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  /* Large drifting blobs - soft, slow, atmospheric.
                     Perf 2026-05-17 — radius 110px→50px and dimensions
                     620→460 / 560→420. Perf 2026-05-19 — removed
                     filter: blur() entirely; the radial-gradient stops
                     already feather the edge, and dropping the blur
                     shader recovers the GPU compositor cost that made
                     /games feel sluggish vs other pages. To compensate
                     for the slightly crisper inner core, the gradient
                     stops below were softened (added a mid stop at
                     35% so the falloff is gentler). */
                  .catalogue-blob {
                    position: absolute;
                    border-radius: 50%;
                    opacity: 0.55;
                    pointer-events: none;
                    will-change: transform;
                  }
                  .catalogue-blob-1 {
                    width: 460px; height: 460px;
                    top: -120px;
                    inset-inline-start: -90px;
                    background: radial-gradient(circle, rgba(184,60,77,0.7) 0%, rgba(184,60,77,0.32) 35%, rgba(184,60,77,0) 75%);
                    animation: catalogue-blob-1-converge 56s ease-in-out infinite;
                  }
                  .catalogue-blob-2 {
                    width: 420px; height: 420px;
                    bottom: -100px;
                    inset-inline-end: -80px;
                    background: radial-gradient(circle, rgba(139,38,56,0.6) 0%, rgba(139,38,56,0.28) 35%, rgba(139,38,56,0) 75%);
                    animation: catalogue-blob-2-converge 56s ease-in-out infinite;
                  }
                  @keyframes catalogue-blob-1-converge {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50%      { transform: translate(140px, 100px) scale(1.06); }
                  }
                  @keyframes catalogue-blob-2-converge {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50%      { transform: translate(-140px, -100px) scale(1.06); }
                  }

                  /* Soft floating circle — 2026-05-19 dropped filter:
                     blur(40px); the radial-gradient now feathers with
                     a mid stop so the visual is unchanged but the GPU
                     no longer runs the blur shader every frame. */
                  .catalogue-floating-circle {
                    position: absolute;
                    width: 220px; height: 220px;
                    top: 38%;
                    left: 48%;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(232,131,148,0.45) 0%, rgba(208,90,118,0.22) 40%, rgba(184,60,77,0) 75%);
                    opacity: 0.5;
                    animation: catalogue-floating-circle-move 32s ease-in-out infinite;
                    pointer-events: none;
                  }
                  @keyframes catalogue-floating-circle-move {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    25%      { transform: translate(-30px, 40px) scale(1.05); }
                    50%      { transform: translate(40px, -20px) scale(1.1); }
                    75%      { transform: translate(20px, 30px) scale(1); }
                  }

                  /* 2026-05-19 single-layer orbs field replacing the
                     legacy .catalogue-orbit-* spans below. Sharper edge
                     (transparent 48%), more transparent (opacity 0.45)
                     per Itzik global guideline "less blur + more
                     transparency". */
                  .catalogue-orbs-field {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    /* 2026-05-19 round 5 — matched to /journey final
                       (3-stop solid core 0-40% → transparent 80%).
                       Defines clear dots with subtle halo, opacity 0.3. */
                    opacity: 0.3;
                    background-image:
                      radial-gradient(circle 18px at 12% 22%, rgba(244, 63, 94, 0.95) 0%, rgba(244, 63, 94, 0.95) 40%, transparent 80%),
                      radial-gradient(circle 14px at 24% 68%, rgba(217, 70,239, 0.95) 0%, rgba(217, 70,239, 0.95) 40%, transparent 80%),
                      radial-gradient(circle 22px at 38% 18%, rgba(236, 72,153, 0.9)  0%, rgba(236, 72,153, 0.9)  40%, transparent 80%),
                      radial-gradient(circle 12px at 48% 74%, rgba(168, 85,247, 0.95) 0%, rgba(168, 85,247, 0.95) 40%, transparent 80%),
                      radial-gradient(circle 17px at 62% 30%, rgba(244, 63, 94, 0.9)  0%, rgba(244, 63, 94, 0.9)  40%, transparent 80%),
                      radial-gradient(circle 17px at 74% 66%, rgba(139, 92,246, 0.95) 0%, rgba(139, 92,246, 0.95) 40%, transparent 80%),
                      radial-gradient(circle 21px at 86% 24%, rgba(217, 70,239, 0.9)  0%, rgba(217, 70,239, 0.9)  40%, transparent 80%),
                      radial-gradient(circle 14px at 18% 46%, rgba(236, 72,153, 0.95) 0%, rgba(236, 72,153, 0.95) 40%, transparent 80%),
                      radial-gradient(circle 18px at 54% 54%, rgba(168, 85,247, 0.9)  0%, rgba(168, 85,247, 0.9)  40%, transparent 80%),
                      radial-gradient(circle 17px at 80% 48%, rgba(244, 63, 94, 0.9)  0%, rgba(244, 63, 94, 0.9)  40%, transparent 80%),
                      radial-gradient(circle 13px at 30% 38%, rgba(217, 70,239, 0.95) 0%, rgba(217, 70,239, 0.95) 40%, transparent 80%),
                      radial-gradient(circle 18px at 68% 8%,  rgba(236, 72,153, 0.9)  0%, rgba(236, 72,153, 0.9)  40%, transparent 80%),
                      radial-gradient(circle 16px at 14% 86%, rgba(168, 85,247, 0.95) 0%, rgba(168, 85,247, 0.95) 40%, transparent 80%),
                      radial-gradient(circle 14px at 42% 90%, rgba(139, 92,246, 0.9)  0%, rgba(139, 92,246, 0.9)  40%, transparent 80%),
                      radial-gradient(circle 18px at 68% 94%, rgba(244, 63, 94, 0.9)  0%, rgba(244, 63, 94, 0.9)  40%, transparent 80%),
                      radial-gradient(circle 17px at 90% 48%, rgba(236, 72,153, 0.95) 0%, rgba(236, 72,153, 0.95) 40%, transparent 80%);
                    background-size: 100% 100%;
                    background-repeat: no-repeat;
                    animation: catalogue-orbs-drift 24s ease-in-out infinite;
                    will-change: transform;
                  }
                  @keyframes catalogue-orbs-drift {
                    0%, 100% { transform: translate3d(0, 0, 0); }
                    33%      { transform: translate3d(3%, -2.5%, 0); }
                    66%      { transform: translate3d(-2.5%, 3%, 0); }
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .catalogue-orbs-field { animation: none; }
                  }

                  /* Legacy .catalogue-orbit-* rules below — inert, kept
                     on disk for possible rollback. */
                  .catalogue-orbit {
                    position: absolute;
                    border-radius: 50%;
                    pointer-events: none;
                    will-change: transform, opacity;
                  }
                  .catalogue-orbit-1  { width: 8px;  height: 8px;  left: 12%; top: 22%; background: radial-gradient(circle, rgba(232,131,148,0.85) 0%, rgba(232,131,148,0) 70%); box-shadow: 0 0 10px rgba(232,131,148,0.25); animation: catalogue-orbit-a 26s ease-in-out infinite; }
                  .catalogue-orbit-2  { width: 6px;  height: 6px;  left: 24%; top: 68%; background: radial-gradient(circle, rgba(184,60,77,0.85) 0%, rgba(184,60,77,0) 70%);   box-shadow: 0 0 8px  rgba(184,60,77,0.22);   animation: catalogue-orbit-b 32s ease-in-out infinite; animation-delay: 1s; }
                  .catalogue-orbit-3  { width: 10px; height: 10px; left: 38%; top: 18%; background: radial-gradient(circle, rgba(251,200,210,0.8)  0%, rgba(251,200,210,0)  70%); box-shadow: 0 0 12px rgba(251,200,210,0.22); animation: catalogue-orbit-c 30s ease-in-out infinite; animation-delay: 2s; }
                  .catalogue-orbit-4  { width: 5px;  height: 5px;  left: 48%; top: 74%; background: radial-gradient(circle, rgba(245,158,177,0.85) 0%, rgba(245,158,177,0) 70%); box-shadow: 0 0 8px  rgba(245,158,177,0.22); animation: catalogue-orbit-d 36s ease-in-out infinite; animation-delay: 3s; }
                  .catalogue-orbit-5  { width: 7px;  height: 7px;  left: 62%; top: 30%; background: radial-gradient(circle, rgba(184,60,77,0.8)  0%, rgba(184,60,77,0)  70%);   box-shadow: 0 0 10px rgba(184,60,77,0.22);   animation: catalogue-orbit-e 28s ease-in-out infinite; animation-delay: .8s; }
                  .catalogue-orbit-6  { width: 7px;  height: 7px;  left: 74%; top: 66%; background: radial-gradient(circle, rgba(139,38,56,0.85) 0%, rgba(139,38,56,0) 70%);   box-shadow: 0 0 10px rgba(139,38,56,0.22);   animation: catalogue-orbit-a 34s ease-in-out infinite; animation-delay: 3.6s; }
                  .catalogue-orbit-7  { width: 9px;  height: 9px;  left: 86%; top: 24%; background: radial-gradient(circle, rgba(232,131,148,0.85) 0%, rgba(232,131,148,0) 70%); box-shadow: 0 0 12px rgba(232,131,148,0.22); animation: catalogue-orbit-b 30s ease-in-out infinite; animation-delay: 4.2s; }
                  .catalogue-orbit-8  { width: 6px;  height: 6px;  left: 18%; top: 46%; background: radial-gradient(circle, rgba(245,158,177,0.85) 0%, rgba(245,158,177,0) 70%); box-shadow: 0 0 8px  rgba(245,158,177,0.22); animation: catalogue-orbit-c 38s ease-in-out infinite; animation-delay: 1.6s; }
                  .catalogue-orbit-9  { width: 8px;  height: 8px;  left: 54%; top: 54%; background: radial-gradient(circle, rgba(184,60,77,0.8)  0%, rgba(184,60,77,0)  70%);   box-shadow: 0 0 10px rgba(184,60,77,0.22);   animation: catalogue-orbit-d 32s ease-in-out infinite; animation-delay: 5s; }
                  .catalogue-orbit-10 { width: 7px;  height: 7px;  left: 80%; top: 48%; background: radial-gradient(circle, rgba(251,200,210,0.85) 0%, rgba(251,200,210,0) 70%); box-shadow: 0 0 10px rgba(251,200,210,0.22); animation: catalogue-orbit-e 34s ease-in-out infinite; animation-delay: 2.4s; }
                  .catalogue-orbit-11 { width: 5px;  height: 5px;  left: 30%; top: 38%; background: radial-gradient(circle, rgba(245,158,177,0.8)  0%, rgba(245,158,177,0)  70%); box-shadow: 0 0 8px  rgba(245,158,177,0.2);  animation: catalogue-orbit-a 28s ease-in-out infinite; animation-delay: 4s; }
                  .catalogue-orbit-12 { width: 8px;  height: 8px;  left: 68%; top: 8%;  background: radial-gradient(circle, rgba(232,131,148,0.8)  0%, rgba(232,131,148,0)  70%); box-shadow: 0 0 10px rgba(232,131,148,0.22); animation: catalogue-orbit-b 30s ease-in-out infinite; animation-delay: .5s; }

                  /* Drift ranges - ambient, not propelled. */
                  @keyframes catalogue-orbit-a { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(30px,-40px);  opacity: .65; } }
                  @keyframes catalogue-orbit-b { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(-40px,30px); opacity: .65; } }
                  @keyframes catalogue-orbit-c { 0%,100% { transform: translate(0,0); opacity: .2; }  33% { transform: translate(40px,18px);  opacity: .55; } 66% { transform: translate(-25px,-30px); opacity: .7; } }
                  @keyframes catalogue-orbit-d { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(-30px,-45px); opacity: .65; } }
                  @keyframes catalogue-orbit-e { 0%,100% { transform: translate(0,0); opacity: .25; } 50% { transform: translate(45px,35px);   opacity: .65; } }

                  @media (prefers-reduced-motion: reduce) {
                    .catalogue-blob,
                    .catalogue-floating-circle,
                    .catalogue-orbit {
                      animation: none !important;
                    }
                  }
                `,
              }}
            />
          </section>
          {/* 2026-06-09 — Personas section ("למי זה מתאים", 3 chapter cards) removed per Itzik. CMS keys gamesHub.personasHeader.* and gamesHub.personas.* stay on disk for reuse. */}
          {/* 2026-05-20 — original BENEFITS section was here at the
              bottom of the cream wrapper. Moved to right below the
              hero (see above, right after the wave-divider). */}

          {/* ════════════════════════════════════════════════════════════
              FAQ - 8 questions tailored to the /games funnel.
              Mounted via the shared <FAQ> component with a `gamesHub.faq.*`
              CMS namespace, so admins can edit each Q/A independently of
              the homepage FAQ (`homeV2.faq.*`). Wrapped in `.home-v2` so
              the existing `.home-v2 .faq` styling in styles.css applies
              without duplication. Itzik 2026-05-20.
          ════════════════════════════════════════════════════════════ */}
          <div className="home-v2">
            <FAQ
              cmsKeyPrefix="gamesHub.faq"
              numbers={[1, 2, 3, 4, 5, 6, 7, 8]}
              anchorId="faq-games"
            />
          </div>
        </div>
        {/* ── end light sections ── */}

      </main>
    </div>
    </CmsTextProvider>
  );
}
