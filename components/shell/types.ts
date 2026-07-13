/**
 * AppShell — shared types.
 *
 * Single source of truth for the navigation graph + state we pass into
 * the shell components from a /(shell) layout. Keep this minimal so the
 * shell stays a pure presentation layer; everything route-aware is
 * resolved by the layout server-component before being handed in.
 *
 * Added 2026-05-29 as part of Step 1 of the post-login redesign.
 * Visual spec: post-login-mockup-v12.html.
 */

// 2026-05-31 — `today` removed from the nav graph: the post-login spec
// now collapses היום + השיעורים שלי into a single "השיעורים שלי" tab.
// The /my/today route still exists as a 308 redirect to /my/lessons so
// any old links / bookmarks keep working.
export type NavKey =
  | "lessons"
  | "expert"
  | "games"
  | "adults"
  | "share"
  | "survey"
  | "settings";

export type NavGroup = "journey" | "games" | "account";

/**
 * One entry in the sidebar / mobile-tab nav. `href` is locale-less
 * (prepended by `@/navigation` Link automatically). Badges are pulled
 * from the parent layout — the shell never queries the DB itself.
 *
 * NOTE: NavItem is JSON-serialisable on purpose. The parent layout is
 * a server component and the consumer rails (SideNav, MobileTabs) are
 * client components — passing a function reference (like a React
 * component) would crash with "Functions cannot be passed directly to
 * Client Components". The actual lucide icon is resolved client-side
 * via the NAV_ICONS map in SideNav / MobileTabs by NavKey.
 */
export interface NavItem {
  key:    NavKey;
  group:  NavGroup;
  /** Visible label. Picked from messages.json by the layout, not here. */
  label:  string;
  href:   string;
  /** Numeric badge ("1", "2", …) — null hides it. */
  badge?: number | null;
  /** Soft dot indicator (e.g. unfinished partner-share). Stacks BELOW badge. */
  dot?:   boolean;
}

/**
 * Identity card at the top of the sidebar. Either:
 *   • Couple ("נועה ויואב" + two avatar initials)
 *   • Solo  ("נועה" + single avatar initial)
 * The component handles both shapes — pass `partnerInitial = null` for solo.
 */
export interface CoupleCardData {
  ownerName:        string;
  ownerInitial:     string;
  partnerName?:     string | null;
  partnerInitial?:  string | null;
  /** Bottom-line under the names (e.g. "המסע פעיל · החודש 1"). Optional. */
  statusLine?:      string | null;
}

/**
 * Expert presence + last message preview shown at the bottom of the
 * sidebar. When `expertName` is null (no expert assigned yet), the
 * caller should hide the whole panel — the component renders nothing
 * either way.
 */
export interface ExpertMiniData {
  expertName:    string | null;
  expertInitial: string;
  /** ISO. When present, paints the "online" dot green. */
  online?:       boolean;
  /** Last message snippet (≤120 chars recommended; component clamps). */
  lastMessage?:  string | null;
  /** ISO timestamp of the last message. Lets the /my/today ChatRowPreview
   *  build its "X ago" stamp without a second DB round-trip. */
  lastMessageAt?: string | null;
  /** Where the bottom CTA links to (usually /my/expert). */
  askHref:       string;
  /** Label for the CTA. CMS-controlled via the layout. */
  askLabel:      string;
}

/**
 * Strings the shell needs that the layout pulls from CMS. Keeping
 * them as props means the shell file ships zero CMS calls and stays
 * client-friendly when needed.
 */
export interface ShellChrome {
  /** "מיאושי שלי" — left-most crumb segment. */
  rootCrumbLabel:  string;
  /** "התנתקות" — bottom item below the nav divider. */
  logoutLabel:     string;
  /** Group headers in the sidebar. */
  groupHeadings:   Record<NavGroup, string>;
}
