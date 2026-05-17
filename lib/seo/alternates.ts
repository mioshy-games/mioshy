/**
 * Centralised SEO alternates + Open Graph locale helpers.
 *
 * Every locale-prefixed page should compose its `generateMetadata`
 * output from these helpers so the canonical / hreflang / og:locale
 * trio stays consistent across the site. Reuses the same site-URL
 * resolution as the JSON-LD helpers so preview deploys point at the
 * preview domain instead of mioshy.com.
 */

import { siteUrl } from "./jsonLd";

type Locale = "he" | "en";

/**
 * Normalize a page-relative pathname so callers can pass `"/about"`,
 * `"about"`, or `"/"` and get a consistent canonical suffix. The root
 * pathname `"/"` becomes an empty string so `${siteUrl}/${locale}` is
 * emitted without a trailing slash — matching every per-page canonical
 * already shipping in production (e.g. /he, /he/games, /he/pricing).
 */
function normalize(pathname: string): string {
  if (!pathname || pathname === "/") return "";
  const withLeading = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withLeading.length > 1 && withLeading.endsWith("/")
    ? withLeading.slice(0, -1)
    : withLeading;
}

/**
 * Build the `alternates` block for a Next.js `Metadata` object.
 * Always emits canonical + he + en + x-default (x-default → /en, the
 * documented default for non-IL non-Hebrew traffic). Pass
 * `overrideCanonical` to honour a row-specific canonical from the DB
 * (used by articles whose `canonical_url` column points elsewhere).
 *
 * @example
 *   buildAlternates("he", "/")        // canonical: `${base}/he`
 *   buildAlternates("en", "/about")   // canonical: `${base}/en/about`
 *   buildAlternates("he", "/x", "https://ext.example/y") // canonical: `https://ext.example/y`
 */
export function buildAlternates(
  locale: Locale,
  pathname: string,
  overrideCanonical?: string | null,
): {
  canonical: string;
  languages: {
    he: string;
    en: string;
    "x-default": string;
  };
} {
  const base = siteUrl();
  const path = normalize(pathname);
  return {
    canonical: overrideCanonical ?? `${base}/${locale}${path}`,
    languages: {
      he: `${base}/he${path}`,
      en: `${base}/en${path}`,
      "x-default": `${base}/en${path}`,
    },
  };
}

/**
 * Build the `locale` + `alternateLocale` fields for a Next.js
 * `Metadata.openGraph` object. The return shape mirrors Next.js's
 * own property names so a caller can spread it directly:
 *
 *   openGraph: { ...buildOgLocale(locale), title, description, ... }
 *
 * Codes follow the Open Graph / Facebook convention: `he_IL` for
 * Hebrew, `en_US` for English.
 */
export function buildOgLocale(locale: Locale): {
  locale: string;
  alternateLocale: string[];
} {
  const map = {
    he: { current: "he_IL", alternate: "en_US" },
    en: { current: "en_US", alternate: "he_IL" },
  } as const;
  return {
    locale: map[locale].current,
    alternateLocale: [map[locale].alternate],
  };
}
