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
 * Added 2026-05-29 (Step 1 of post-login redesign).
 */

import {
  Sun,
  BookOpen,
  MessageCircle,
  LayoutGrid,
  Heart,
  Users,
  Settings,
} from "lucide-react";

import type { NavItem, NavKey } from "./types";

/**
 * Map from NavKey → href (locale-less). Single place to update if a
 * route slug changes — both nav surfaces + the redirect middleware
 * (Step 2) read from this.
 */
export const NAV_HREF: Record<NavKey, string> = {
  today:    "/my/today",
  lessons:  "/my/lessons",
  expert:   "/my/expert",
  games:    "/games",
  adults:   "/mioshy-sex",
  share:    "/my/share",
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
    {
      key:   "today",
      group: "journey",
      label: labels.today,
      href:  NAV_HREF.today,
      Icon:  Sun,
      badge: badges.today ?? null,
      dot:   dots.today ?? false,
    },
    {
      key:   "lessons",
      group: "journey",
      label: labels.lessons,
      href:  NAV_HREF.lessons,
      Icon:  BookOpen,
      badge: badges.lessons ?? null,
      dot:   dots.lessons ?? false,
    },
    {
      key:   "expert",
      group: "journey",
      label: labels.expert,
      href:  NAV_HREF.expert,
      Icon:  MessageCircle,
      badge: badges.expert ?? null,
      dot:   dots.expert ?? false,
    },

    // ── משחקים ─────────────────────────────────
    {
      key:   "games",
      group: "games",
      label: labels.games,
      href:  NAV_HREF.games,
      Icon:  LayoutGrid,
      badge: badges.games ?? null,
      dot:   dots.games ?? false,
    },
    {
      key:   "adults",
      group: "games",
      label: labels.adults,
      href:  NAV_HREF.adults,
      Icon:  Heart,
      badge: badges.adults ?? null,
      dot:   dots.adults ?? false,
    },

    // ── החשבון ─────────────────────────────────
    {
      key:   "share",
      group: "account",
      label: labels.share,
      href:  NAV_HREF.share,
      Icon:  Users,
      badge: badges.share ?? null,
      dot:   dots.share ?? false,
    },
    {
      key:   "settings",
      group: "account",
      label: labels.settings,
      href:  NAV_HREF.settings,
      Icon:  Settings,
      badge: badges.settings ?? null,
      dot:   dots.settings ?? false,
    },
  ];
}

/**
 * Pick which 4 nav items appear in the mobile bottom-tab bar. The fifth
 * slot is always "עוד" → opens a sheet with the remaining items.
 *
 * Order is fixed by product priority — see Studio v12 mobile mock:
 *   1. היום   (today)
 *   2. שיעורים (lessons)
 *   3. מומחה  (expert)
 *   4. משחקים (games)
 *   5. עוד    → adults, share, settings
 */
export const MOBILE_PRIMARY_KEYS: NavKey[] = [
  "today",
  "lessons",
  "expert",
  "games",
];

export const MOBILE_OVERFLOW_KEYS: NavKey[] = [
  "adults",
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

  // Treat /my as /my/today (legacy landing).
  const normalized = path === "/my" ? "/my/today" : path;

  return normalized === item.href || normalized.startsWith(item.href + "/");
}
