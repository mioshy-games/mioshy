import type { MetadataRoute } from "next";
import { createServiceRoleClient } from "@/lib/supabase-admin";

// Regenerate at most hourly. Crucially this makes the route cacheable and
// removes the per-request cookie read that previously forced dynamic
// rendering (and let a slow/failing Supabase call surface to Googlebot as a
// "General HTTP error"). The DB section is now best-effort on top of a
// guaranteed static core.
export const revalidate = 3600;

/**
 * Sitemap for Mioshy - a couples-games platform.
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
};
type DbAdultsGame = {
  slug: string;
  created_at: string;
};

function langAlternates(site: string, path: string) {
  return {
    en: `${site}/en${path}`,
    he: `${site}/he${path}`,
    // Hebrew-first site: the default target for untargeted traffic is /he.
    "x-default": `${site}/he${path}`,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = baseUrl();
  const now = new Date();

  const staticPaths: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "", priority: 1.0, changeFrequency: "weekly" },
    { path: "/games", priority: 0.95, changeFrequency: "weekly" },
    // /mioshy-sex is the flagship product surface - high priority.
    { path: "/mioshy-sex", priority: 0.95, changeFrequency: "weekly" },
    // /couples-assessment is the free-entry funnel top - previously missing
    // from the sitemap and not indexed at all.
    { path: "/couples-assessment", priority: 0.95, changeFrequency: "weekly" },
    { path: "/journey", priority: 0.85, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.7, changeFrequency: "monthly" },
    { path: "/articles", priority: 0.8, changeFrequency: "weekly" },
    { path: "/about/founder", priority: 0.5, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
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
    // Cookieless service-role client: no request context, so the route stays
    // cacheable and can never 500 on a missing cookie store. If env is absent
    // (CI/build without secrets) we ship the static core below.
    const supabase = createServiceRoleClient();
    if (!supabase) return staticEntries;

    const [{ data: articles }, { data: games }, { data: adultsGames }] =
      await Promise.all([
        supabase
          .from("articles")
          .select("slug, published_at, created_at, cover_image_url")
          .eq("is_published", true),
        supabase
          .from("games")
          .select("slug, created_at")
          .eq("is_active", true),
        // Flagship /adults catalogue - published-only experience games.
        supabase
          .from("experience_games")
          .select("slug, created_at")
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

    const adultsEntries: MetadataRoute.Sitemap = ((adultsGames ?? []) as DbAdultsGame[])
      .filter((g) => Boolean(g.slug))
      .flatMap((g) => {
        const lm = new Date(g.created_at);
        // The experience-games catalogue lives under /mioshy-sex/<slug>. The
        // legacy /adults/<slug> route was renamed, so emitting /adults here
        // fed Google 404s for the entire flagship catalogue.
        const path = `/mioshy-sex/${g.slug}`;
        return (["en", "he"] as const).map((locale) => ({
          url: `${site}/${locale}${path}`,
          lastModified: lm,
          changeFrequency: "monthly" as const,
          priority: 0.85,
          alternates: { languages: langAlternates(site, path) },
        }));
      });

    return [
      ...staticEntries,
      ...articleEntries,
      ...gameEntries,
      ...adultsEntries,
    ];
  } catch {
    return staticEntries;
  }
}
