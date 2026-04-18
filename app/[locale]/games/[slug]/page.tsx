import { TruthOrDareClient } from "@/components/TruthOrDareClient";
import { GamePageBackground } from "@/components/game/GamePageBackground";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GameRow, QuestionRow, WheelConfigRow } from "@/lib/types/database";
import { unstable_noStore as noStore } from "next/cache";
import type { Metadata } from "next";
import { fetchGameSettings } from "@/lib/settings-queries";

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
      "slug, name_en, name_he, description_en, description_he, thumbnail_url, meta_title_he, meta_title_en, meta_description_he, meta_description_en, og_image_url, keywords",
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

  const ogImage = game?.og_image_url || game?.thumbnail_url || null;
  const canonical = `${base}/${locale}/games/${slug}`;
  return {
    title: metaTitle.toLowerCase().startsWith("mioshy")
      ? metaTitle
      : `Mioshy — ${metaTitle}`,
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
        "x-default": `${base}/en/games/${slug}`,
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
        <h1 className="text-2xl font-bold">Game not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This game is not available right now.
        </p>
      </div>
    );
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

  if (!wheel) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">Game is missing a wheel</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Please try again later.
        </p>
      </div>
    );
  }

  const g = game as GameRow;
  const w = wheel as WheelConfigRow;
  const qs = (questions ?? []) as QuestionRow[];

  // bg_type "image" games still use their own image bg — everything else gets
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

  if (useImageBg) {
    // Legacy image-background games — keep the original behaviour
    return (
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <TruthOrDareClient game={g} wheel={w} questions={qs} gameSettings={gameSettings} />
      </div>
    );
  }

  return (
    <GamePageBackground gameSlug={g.slug} primaryColor={bgValue} bgSettings={gameSettings?.background} particlesSettings={gameSettings?.particles}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TruthOrDareClient game={g} wheel={w} questions={qs} transparent gameSettings={gameSettings} />
    </GamePageBackground>
  );
}

