import type { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Sitemap for Mioshy — a couples-games platform.
 *
 * Strategy:
 *   • Every public URL is emitted with both its /en and /he variant and a
 *     cross-linked `alternates.languages` block so Google can map them.
 *   • changeFrequency/priority are tuned to reflect real user intent:
 *     game pages are hubs of activity (weekly, .9), articles are long-tail
 *     (monthly, .7), marketing/legal pages get modest priority (.5).
 *   • If Supabase is unreachable during build (CI with no env), we still
 *     ship the static entries so the sitemap is never empty.
 */

function baseUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com";
  return raw.replace(/\/+$/, "");
}

type DbArticle = {
  slug: string;
  published_at: string | null;
  created_at: string;
  cover_image_url: string | null;
};
type DbGame = {
  slug: string;
  created_at: string;
  thumbnail_url: string | null;
};

function langAlternates(site: string, path: string) {
  return {
    en: `${site}/en${path}`,
    he: `${site}/he${path}`,
    "x-default": `${site}/en${path}`,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = baseUrl();
  const now = new Date();

  const staticPaths: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "", priority: 1.0, changeFrequency: "weekly" },
    { path: "/games", priority: 0.95, changeFrequency: "weekly" },
    { path: "/products", priority: 0.8, changeFrequency: "monthly" },
    { path: "/pricing", priority: 0.7, changeFrequency: "monthly" },
    { path: "/articles", priority: 0.8, changeFrequency: "weekly" },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticPaths.flatMap(({ path, priority, changeFrequency }) =>
    (["en", "he"] as const).map((locale) => ({
      url: `${site}/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: {
        languages: langAlternates(site, path),
      },
    })),
  );

  try {
    const supabase = await createServerSupabaseClient();

    const [{ data: articles }, { data: games }] = await Promise.all([
      supabase
        .from("articles")
        .select("slug, published_at, created_at, cover_image_url")
        .eq("is_published", true),
      supabase
        .from("games")
        .select("slug, created_at, thumbnail_url")
        .eq("is_active", true),
    ]);

    const articleEntries: MetadataRoute.Sitemap = ((articles ?? []) as DbArticle[])
      .filter((a) => Boolean(a.slug))
      .flatMap((a) => {
        const lm = new Date(a.published_at ?? a.created_at);
        const path = `/articles/${a.slug}`;
        return (["en", "he"] as const).map((locale) => ({
          url: `${site}/${locale}${path}`,
          lastModified: lm,
          changeFrequency: "monthly" as const,
          priority: 0.7,
          alternates: { languages: langAlternates(site, path) },
        }));
      });

    const gameEntries: MetadataRoute.Sitemap = ((games ?? []) as DbGame[])
      .filter((g) => Boolean(g.slug))
      .flatMap((g) => {
        const lm = new Date(g.created_at);
        const path = `/games/${g.slug}`;
        return (["en", "he"] as const).map((locale) => ({
          url: `${site}/${locale}${path}`,
          lastModified: lm,
          changeFrequency: "weekly" as const,
          priority: 0.9,
          alternates: { languages: langAlternates(site, path) },
        }));
      });

    return [...staticEntries, ...articleEntries, ...gameEntries];
  } catch {
    return staticEntries;
  }
}
