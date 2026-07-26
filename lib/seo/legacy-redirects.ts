/**
 * Legacy-URL 301 redirect resolution (SEO stage 1, 2026-07-26).
 *
 * Pre-relaunch URLs (still indexed by Google and linked externally) had no
 * route on the new site. Under next-intl's `localePrefix: "always"`, an
 * unprefixed path like `/sex-games` was *rewritten* to `/en/sex-games`, which
 * doesn't exist and renders the soft-404 ("LEVEL NOT FOUND") — a 200 page that
 * bleeds link equity instead of passing it on. `resolveLegacyRedirect` maps
 * those paths to the closest live equivalent; the middleware then issues a real
 * permanent (301) redirect.
 *
 * Kept as a pure, dependency-free module so it can be unit-tested without
 * loading the Next.js server / next-intl runtime that middleware.ts pulls in.
 */

/** Strip a single trailing slash so `/sex-games` and `/sex-games/` map alike
 *  (root "/" is preserved). */
function stripTrailingSlash(p: string): string {
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

// Exact old-path → new-target map. Keys are lower-cased, trailing-slash-free.
// Targets were verified against the live sitemap (all article slugs exist).
const LEGACY_EXACT: Record<string, string> = {
  "/red-room-secrets/5-steamy-sex-positions":
    "/he/articles/best-sex-positions-for-couples",
  "/red-room-secrets/make-her-climax": "/he/articles/multiple-orgasms-for-her",
  "/red-room-secrets/womans-sexual-satisfaction":
    "/he/articles/what-women-do-during-sex",
  "/red-room-secrets/foot-fetishes": "/he/mioshy-sex",
  "/red-room-secrets/more-sex-in-marriage":
    "/he/articles/boost-sexual-desire-three-steps",
  "/sex-games": "/he/games",
  "/articles/top-10-exciting-sex-games": "/he/mioshy-sex",
  "/hot-nights": "/he/mioshy-sex",
};

/**
 * Resolve a legacy pathname to its 301 target, or null if the path is a live
 * route (or a non-localized root we own) that must be left untouched.
 *
 * Order:
 *   1. Exact legacy URLs (table above).
 *   2. Prefix families collapsed to one bucket (red-room-secrets/*, board-games/*).
 *   3. Blanket rule: anything else with no /he or /en locale prefix — and not
 *      one of our real non-localized route roots (/admin, /dashboard) or the
 *      site root — is a dead legacy URL → /he. Static files, /api and /ingest
 *      never reach here (excluded by the middleware matcher).
 */
export function resolveLegacyRedirect(pathnameRaw: string): string | null {
  const pathname = stripTrailingSlash(pathnameRaw.toLowerCase());

  if (LEGACY_EXACT[pathname]) return LEGACY_EXACT[pathname];

  if (
    pathname === "/red-room-secrets" ||
    pathname.startsWith("/red-room-secrets/")
  ) {
    return "/he/mioshy-sex";
  }
  if (pathname === "/board-games" || pathname.startsWith("/board-games/")) {
    return "/he/games";
  }

  if (
    pathname !== "" &&
    pathname !== "/" &&
    !/^\/(he|en)(?:\/|$)/.test(pathname) &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/dashboard")
  ) {
    return "/he";
  }

  return null;
}
