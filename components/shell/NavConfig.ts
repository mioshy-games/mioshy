/**
 * Shell navigation graph.
 *
 * Single source of truth for the 7 post-login navigation items.
 * Same data feeds both <SideNav> (desktop) and <MobileTabs> (mobile).
 *
 * Order matters — visual order in the sidebar = array order. Mobile
 * tabs render the first 4 + an "עוד" overflow that opens the rest.
 *
 * Labels are NOT defined here — the layout pulls them from CMS / next-intl
 * messages and passes them in via the `labels` map. This keeps the graph
 * locale-agnostic.
 *
 * NOTE on icons: the lucide components are NOT bundled into NavItem —
 * they'd be function references and crash the RSC payload boundary
 * ("Functions cannot be passed directly to Client Components"). The
 * client rails (SideNav / MobileTabs) own their NAV_ICONS map and
 * resolve the icon at render time by NavKey.
 *
 * Added 2026-05-29 (Step 1 of post-login redesign).
 */

import type { NavItem, NavKey } from "./types";

/**
 * Map from NavKey → href (locale-less). Single place to update if a
 * route slug changes — both nav surfaces + the redirect middleware
 * (Step 2) read from this.
 */
export const NAV_HREF: Record<NavKey, string> = {
  // 2026-05-31 — `today` dropped from nav. The "Today" content (current
  // lesson + chat preview + focus pill) now lives at the top of
  // /my/lessons under a "Today" pill. /my/today still resolves via 308
  // redirect for legacy links.
  lessons:  "/my/lessons",
  expert:   "/my/expert",
  // 2026-05-30 — was pointing at the marketing catalogues (/games and
  // /mioshy-sex). Logged-in users should land on their OWN catalogue
  // (the entitled-only view at /my/games and /my/adults) — the
  // existing legacy pages handle gating and journey-includes-all rules.
  games:    "/my/games",
  adults:   "/my/adults",
  share:    "/my/share",
  // Survey nav points at the public daily-question flow (/he/survey), not the
  // /my/survey dashboard landing — the nav should open today's question
  // directly (Itzik 2026-07-14). /my/survey still exists (post-signup landing).
  survey:   "/survey",
  settings: "/my/settings",
};

/**
 * Build the nav graph for a given pass of labels + badges. Pure function
 * — re-evaluated server-side per request so badge counts reflect fresh
 * state without client-side fetching. labels keyed by NavKey.
 */
export function buildNavItems(args: {
  labels:  Record<NavKey, string>;
  badges?: Partial<Record<NavKey, number | null>>;
  dots?:   Partial<Record<NavKey, boolean>>;
}): NavItem[] {
  const { labels, badges = {}, dots = {} } = args;

  return [
    // ── המסע שלי ────────────────────────────────
    { key: "lessons",  group: "journey", label: labels.lessons,  href: NAV_HREF.lessons,  badge: badges.lessons  ?? null, dot: dots.lessons  ?? false },
    { key: "expert",   group: "journey", label: labels.expert,   href: NAV_HREF.expert,   badge: badges.expert   ?? null, dot: dots.expert   ?? false },

    // ── משחקים ─────────────────────────────────
    { key: "games",    group: "games",   label: labels.games,    href: NAV_HREF.games,    badge: badges.games    ?? null, dot: dots.games    ?? false },
    { key: "adults",   group: "games",   label: labels.adults,   href: NAV_HREF.adults,   badge: badges.adults   ?? null, dot: dots.adults   ?? false },
    { key: "survey",   group: "games",   label: labels.survey,   href: NAV_HREF.survey,   badge: badges.survey   ?? null, dot: dots.survey    ?? true  },

    // ── החשבון ─────────────────────────────────
    { key: "share",    group: "account", label: labels.share,    href: NAV_HREF.share,    badge: badges.share    ?? null, dot: dots.share    ?? false },
    { key: "settings", group: "account", label: labels.settings, href: NAV_HREF.settings, badge: badges.settings ?? null, dot: dots.settings ?? false },
  ];
}

/**
 * Pick which 4 nav items appear in the mobile bottom-tab bar. The fifth
 * slot is always "עוד" → opens a sheet with the remaining items.
 *
 * 2026-05-31 — Itzik: "Today" merged into "Lessons" + bring Adults up
 * to the primary bar. New order:
 *   1. שיעורים שלי (lessons — now also the landing post-login)
 *   2. מומחה        (expert)
 *   3. משחקים       (games)
 *   4. למבוגרים     (adults)  ← promoted from overflow
 *   5. עוד          → share, settings
 */
export const MOBILE_PRIMARY_KEYS: NavKey[] = [
  "lessons",
  "expert",
  "games",
  "adults",
  "survey",
];

export const MOBILE_OVERFLOW_KEYS: NavKey[] = [
  "share",
  "settings",
];

/**
 * Additional paths that should light up the "עוד" tab on mobile when
 * the user is browsing them. These aren't part of the regular nav
 * graph (so they're not in NavKey) but they still belong to the
 * overflow surface.
 */
export const MOBILE_OVERFLOW_PATHS: string[] = [
  "/my/notifications",
];

/**
 * Decide if a given nav item is "active" for the current pathname.
 *
 * We match prefix not strict — `/my/today` AND `/my/today/anything`
 * both light up the "היום" tab. Special case: `/my` (no segment) is
 * treated as "/my/today" so a homepage hit highlights the right item
 * during the post-login transition window before /my/today is the
 * default landing.
 */
export function isNavActive(item: NavItem, pathname: string): boolean {
  // Strip the locale prefix if present (he|en).
  const path = pathname.replace(/^\/(he|en)(?=\/|$)/, "") || "/";

  // 2026-05-31 — /my (no segment) and /my/today both treated as
  // /my/lessons (the new landing). The /my/today route itself ships a
  // 308 redirect, so this branch only fires for the brief render before
  // navigation completes.
  const normalized =
    path === "/my" || path === "/my/today" ? "/my/lessons" : path;

  // Highlight the Lessons tab when the user is inside a journey/timeline
  // detail page (which now also lives under the shell wrapper).
  const lessonsAlias =
    item.href === "/my/lessons" &&
    (normalized.startsWith("/journey/timeline") ||
      normalized === "/journey/timeline");

  return (
    lessonsAlias ||
    normalized === item.href ||
    normalized.startsWith(item.href + "/")
  );
}
