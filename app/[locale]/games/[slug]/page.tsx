import { TruthOrDareClient } from "@/components/TruthOrDareClient";
import { FreeBadge } from "@/components/games/FreeBadge";
// 2026-05-20 — replaced GamePageBackground import with GameSurfaceShell,
// which adds the WheelSpinContext on top so blob animations only run
// while the wheel is actively spinning. See GameSurfaceShell.tsx and
// WheelSpinContext.tsx for the rationale.
import { GameSurfaceShell } from "@/components/game/GameSurfaceShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeJsonLd } from "@/lib/seo/jsonLd";
import type { GameRow, QuestionRow, WheelConfigRow } from "@/lib/types/database";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { isComingSoon } from "@/lib/games/coming-soon";
import type { Metadata } from "next";
import { fetchGameSettings } from "@/lib/settings-queries";
import { CmsText } from "@/components/cms/CmsText";
import { MetaViewContent } from "@/components/analytics/MetaViewContent";

// Disable any form of static caching for this route.
//   - `noStore()` (called below) disables Next's per-request fetch cache.
//   - `dynamic = "force-dynamic"` is the route-level switch that
//     prevents Vercel's CDN from holding a stale prerender of /games/<slug>.
//     Without it we saw stale renders served - e.g. /games/truth-or-dare
//     resolving to a previously-built page that contained another game's
//     content, even after the DB had been corrected. With it, every
//     request re-runs the server component against fresh DB data.
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const base = siteUrl();
  const supabase = await createServerSupabaseClient();
  const { data: game } = await supabase
    .from("games")
    .select(
      "slug, name_en, name_he, description_en, description_he, thumbnail_url_he, thumbnail_url_en, meta_title_he, meta_title_en, meta_description_he, meta_description_en, og_image_url, keywords",
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  // Prefer the admin-editable SEO overrides when set, otherwise fall back to
  // the display name/description so existing games stay indexable.
  const metaTitle =
    locale === "he"
      ? game?.meta_title_he ?? game?.name_he ?? game?.name_en ?? "Game"
      : game?.meta_title_en ?? game?.name_en ?? game?.name_he ?? "Game";
  const metaDescription =
    locale === "he"
      ? game?.meta_description_he ?? game?.description_he ?? game?.description_en ?? ""
      : game?.meta_description_en ?? game?.description_en ?? game?.description_he ?? "";

  // OG image cascade: explicit og_image_url > locale-matching catalogue
  // thumbnail > the other-locale thumbnail (better wrong-language than no
  // preview at all).
  const localeThumb =
    locale === "he"
      ? game?.thumbnail_url_he ?? game?.thumbnail_url_en
      : game?.thumbnail_url_en ?? game?.thumbnail_url_he;
  const ogImage = game?.og_image_url || localeThumb || null;
  const canonical = `${base}/${locale}/games/${slug}`;
  // Brand placement. The old rule was `startsWith("mioshy") ? … : "Mioshy - " + …`,
  // which forced the brand to the FRONT of every title that didn't already open
  // with it — so the three flagship games shipped as "Mioshy - אמת או חובה":
  // 20 characters, with the one word nobody searches for in the highest-weighted
  // position. It also made a brand SUFFIX impossible to author, because an
  // admin-set "… | מיאושי" still got a second brand bolted onto the front.
  // Now the brand is appended only when the title doesn't already carry it in
  // either language, so a title that ends in "| מיאושי" is left exactly as
  // written and an untouched game still gets its brand.
  const hasBrand = /mioshy|מיאושי/i.test(metaTitle);
  return {
    title: hasBrand ? metaTitle : `${metaTitle} | Mioshy`,
    description: metaDescription,
    keywords:
      Array.isArray(game?.keywords) && game.keywords.length > 0
        ? game.keywords
        : undefined,
    alternates: {
      canonical,
      languages: {
        en: `${base}/en/games/${slug}`,
        he: `${base}/he/games/${slug}`,
        "x-default": `${base}/he/games/${slug}`,
      },
    },
    openGraph: {
      type: "website",
      url: canonical,
      title: metaTitle,
      description: metaDescription,
      images: ogImage ? [{ url: ogImage }] : undefined,
      siteName: "Mioshy",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function GameBySlugPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  noStore();
  const supabase = await createServerSupabaseClient();
  const { locale, slug } = params;

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!game) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <CmsText
          cmsKey="gamesSlug.gameNotFoundTitle"
          as="h1"
          className="text-2xl font-bold"
        />
        <CmsText
          cmsKey="gamesSlug.gameNotFoundBody"
          as="p"
          className="text-muted-foreground mt-2 text-sm"
        />
      </div>
    );
  }

  // D — a scheduled (coming-soon) game isn't accessible until it opens.
  // Direct-URL visitors get bounced back to the catalogue (computed live).
  if (isComingSoon((game as { opens_at?: string | null }).opens_at)) {
    redirect(`/${locale}/games`);
  }

  const [{ data: wheel }, { data: questions }, gameSettings] = await Promise.all([
    supabase
      .from("wheel_configs")
      .select("*")
      .eq("game_id", game.id)
      .maybeSingle(),
    supabase
      .from("questions")
      .select("*")
      .eq("game_id", game.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    fetchGameSettings(supabase, game.id),
  ]);

  // ── DIAG 2026-05-05 ────────────────────────────────────────────────────
  // Server-side log of the *raw* values fetched from Supabase for this
  // game. Compare these to what the admin claims to have saved. If the
  // admin slider is at 0.85 but this prints 0.4, the save isn't reaching
  // the DB. If it prints 0.85 but the wheel still looks wrong, the
  // problem is downstream (TruthOrDareClient/Wheel).
  console.log("[/games/[slug]/SERVER-DIAG] BUILD=2026-05-05-wheel-trace v1", {
    slug: game.slug,
    game_id: game.id,
    wheel_marker_config: wheel?.marker_config,
    wheel_inner_circle: wheel?.inner_circle,
    wheel_inner_circle_color: wheel?.inner_circle_color,
    wheel_pointer_color: wheel?.pointer_color,
    gs_wheel: gameSettings?.wheel,
    gs_motion: gameSettings?.motion,
    gs_shape: gameSettings?.shape,
  });

  if (!wheel) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <CmsText
          cmsKey="gamesSlug.missingWheelTitle"
          as="h1"
          className="text-2xl font-bold"
        />
        <CmsText
          cmsKey="gamesSlug.missingWheelBody"
          as="p"
          className="text-muted-foreground mt-2 text-sm"
        />
      </div>
    );
  }

  const g = game as GameRow;
  const w = wheel as WheelConfigRow;
  const qs = (questions ?? []) as QuestionRow[];

  // bg_type "image" games still use their own image bg - everything else gets
  // the new GamePageBackground gradient system.
  const bgType = g.bg_type ?? "color";
  const bgValue = g.bg_value ?? "#0b0b0f";
  const useImageBg = bgType === "image";

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
            name: "Home",
            item: `${base}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: locale === "he" ? g.name_he : g.name_en,
            item: `${base}/${locale}/games/${g.slug}`,
          },
        ],
      },
      {
        "@type": "SoftwareApplication",
        name: locale === "he" ? g.name_he : g.name_en,
        applicationCategory: "GameApplication",
        operatingSystem: "Web",
        url: `${base}/${locale}/games/${g.slug}`,
      },
    ],
  };

  // SSR "how to play" prose so Googlebot sees real body copy on the game
  // pages (otherwise an interactive JS shell with almost no indexable text).
  // Assembled ONLY from existing catalogue text — the game description plus
  // the per-game instructions (migration 108). Games without enough copy
  // render nothing here (flagged for copywriting, never padded with invented
  // text). Rendered as a sibling BELOW the immersive game surface.
  const isHe = locale === "he";
  const gameDesc =
    (isHe ? g.description_he : g.description_en || g.description_he)?.trim() ?? "";
  const gameInst = g.instructions?.[isHe ? "he" : "en"];
  const instSteps = gameInst?.steps?.filter((s) => s && s.trim().length > 0) ?? [];
  const hasProse = gameDesc.length >= 120 || instSteps.length >= 3;
  const proseSection = hasProse ? (
    <section
      dir={isHe ? "rtl" : "ltr"}
      className="relative z-10 bg-[#0b0712] px-6 py-14 text-white/85"
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
          {isHe ? `${g.name_he} — איך משחקים` : `How to play ${g.name_en}`}
        </h2>
        {gameDesc ? (
          <p className="mt-5 text-[1.0625rem] leading-[1.8]">{gameDesc}</p>
        ) : null}
        {gameInst?.intro && gameInst.intro.trim() ? (
          <p className="mt-4 text-[1.0625rem] leading-[1.8]">{gameInst.intro}</p>
        ) : null}
        {instSteps.length ? (
          <ol className="mt-5 list-decimal space-y-2 ps-5 marker:text-white/50">
            {instSteps.map((s, i) => (
              <li key={i} className="text-[1.0625rem] leading-[1.7]">
                {s}
              </li>
            ))}
          </ol>
        ) : null}
        {gameInst?.footer && gameInst.footer.trim() ? (
          <p className="mt-4 text-[1.0625rem] leading-[1.8] text-white/70">
            {gameInst.footer}
          </p>
        ) : null}
      </div>
    </section>
  ) : null;

  if (useImageBg) {
    // Legacy image-background games - keep the original behaviour
    return (
      <>
      <div
        style={{
          backgroundImage: `url(${bgValue})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
        className="min-h-[100dvh]"
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
        {/* H — "חינם" marker on the free game's play page. Corner pill (no title
            header on the live wheel); top-start avoids the top-end controls. */}
        {g.is_free ? <FreeBadge className="fixed start-3 top-3 z-40" /> : null}
        <MetaViewContent
          contentIds={[g.slug]}
          contentName={g.name_he ?? g.name_en ?? g.slug}
          contentCategory="games"
        />
        <TruthOrDareClient game={g} wheel={w} questions={qs} gameSettings={gameSettings} />
      </div>
      {proseSection}
      </>
    );
  }

  return (
    <>
    <GameSurfaceShell gameSlug={g.slug} primaryColor={bgValue} bgSettings={gameSettings?.background} particlesSettings={gameSettings?.particles}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      {/* H — "חינם" marker on the free game's play page (corner pill). */}
      {g.is_free ? <FreeBadge className="fixed start-3 top-3 z-40" /> : null}
      <MetaViewContent
        contentIds={[g.slug]}
        contentName={g.name_he ?? g.name_en ?? g.slug}
        contentCategory="games"
      />
      <TruthOrDareClient game={g} wheel={w} questions={qs} transparent gameSettings={gameSettings} />
    </GameSurfaceShell>
    {proseSection}
    </>
  );
}

