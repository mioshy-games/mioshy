import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function baseUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com";
  return raw.replace(/\/+$/, "");
}

type DbArticle = { slug: string; published_at: string | null; created_at: string };
type DbGame = { slug: string; created_at: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = baseUrl();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${site}/en`, lastModified: new Date() },
    { url: `${site}/he`, lastModified: new Date() },
    { url: `${site}/en/products`, lastModified: new Date() },
    { url: `${site}/he/products`, lastModified: new Date() },
    { url: `${site}/en/pricing`, lastModified: new Date() },
    { url: `${site}/he/pricing`, lastModified: new Date() },
    { url: `${site}/en/articles`, lastModified: new Date() },
    { url: `${site}/he/articles`, lastModified: new Date() },
  ];

  try {
    const supabase = await createServerSupabaseClient();

    const [{ data: articles }, { data: games }] = await Promise.all([
      supabase
        .from("articles")
        .select("slug, published_at, created_at")
        .eq("is_published", true),
      supabase
        .from("games")
        .select("slug, created_at")
        .eq("is_active", true),
    ]);

    const articleEntries: MetadataRoute.Sitemap = ((articles ?? []) as DbArticle[])
      .filter((a) => Boolean(a.slug))
      .flatMap((a) => {
        const lm = new Date(a.published_at ?? a.created_at);
        return [
          { url: `${site}/en/articles/${a.slug}`, lastModified: lm },
          { url: `${site}/he/articles/${a.slug}`, lastModified: lm },
        ];
      });

    const gameEntries: MetadataRoute.Sitemap = ((games ?? []) as DbGame[])
      .filter((g) => Boolean(g.slug))
      .flatMap((g) => {
        const lm = new Date(g.created_at);
        return [
          { url: `${site}/en/games/${g.slug}`, lastModified: lm },
          { url: `${site}/he/games/${g.slug}`, lastModified: lm },
        ];
      });

    return [...staticEntries, ...articleEntries, ...gameEntries];
  } catch {
    // If Supabase isn't configured during build, ship static URLs only.
    return staticEntries;
  }
}

