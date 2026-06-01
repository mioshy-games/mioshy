"use client";

/**
 * MobileTabs — sticky bottom navigation for the mobile shell.
 *
 * 5 tabs:
 *   [היום] [שיעורים] [מומחה] [משחקים] [עוד ⋯]
 *
 * The first 4 come from MOBILE_PRIMARY_KEYS in NavConfig; the 5th
 * "עוד" opens a bottom-sheet drawer with the rest (adults, share,
 * settings, logout). The drawer itself ships in a follow-up task — for
 * now the "עוד" tab links to /my/more which the (shell) layout can
 * render as a simple list page.
 *
 * Visual spec: post-login-mockup-v12.html .m-tabs.
 *   • Bottom bar uses the SAME dark family as the desktop sidebar
 *     (not cream) — Studio v11/v12 alignment.
 *   • Thin pink gradient line on top as a soft separator.
 *   • Active = small gradient pill behind the icon. Otherwise muted.
 *   • env(safe-area-inset-bottom) padding so iOS Safari home indicator
 *     doesn't crop the labels (same trick as MobileServicesBar).
 *
 * Client component for `usePathname()` active-state.
 */

import { Link, usePathname } from "@/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  BookOpen,
  Heart,
  LayoutGrid,
  Menu,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";

import {
  MOBILE_PRIMARY_KEYS,
  MOBILE_OVERFLOW_PATHS,
  isNavActive,
  NAV_HREF,
} from "./NavConfig";
import type { NavItem, NavKey } from "./types";

/**
 * NavKey → lucide icon. Mirrors the map in SideNav. Lives in this
 * client file so the component refs stay inside the client bundle
 * (server → client cannot carry function references).
 */
const NAV_ICONS: Record<NavKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  lessons:  BookOpen,
  expert:   MessageCircle,
  games:    LayoutGrid,
  adults:   Heart,
  share:    Users,
  settings: Settings,
};

interface Props {
  items: NavItem[];
  /** Label for the "עוד" tab. CMS-controlled via the layout. */
  moreLabel: string;
  /** Where "עוד" links to. Defaults to /my/more — caller can override. */
  moreHref?: string;
}

export function MobileTabs({ items, moreLabel, moreHref = "/my/more" }: Props) {
  const pathname = usePathname();

  // Lookup table so we can pull the 4 primary items in display order.
  const itemByKey: Partial<Record<NavKey, NavItem>> = {};
  for (const item of items) itemByKey[item.key] = item;

  const primaryItems = MOBILE_PRIMARY_KEYS
    .map((k) => itemByKey[k])
    .filter((x): x is NavItem => !!x);

  // "עוד" is active when the user is on a route belonging to the
  // overflow set, an extra overflow path (e.g. /my/notifications), or
  // a child of /my/more.
  const path = pathname.replace(/^\/(he|en)(?=\/|$)/, "") || "/";
  const moreActive =
    path.startsWith("/my/more") ||
    path.startsWith(NAV_HREF.adults) ||
    path.startsWith(NAV_HREF.share) ||
    path.startsWith(NAV_HREF.settings) ||
    MOBILE_OVERFLOW_PATHS.some((p) => path.startsWith(p));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 gap-0.5 px-1.5 pt-1.5"
      style={{
        background:
          "linear-gradient(180deg, var(--shell-side-bg) 0%, var(--shell-canvas) 100%)",
        borderTop: "1px solid var(--shell-side-line-mid)",
        // safe-area inset so iOS home-indicator doesn't crop the labels
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
      }}
      aria-label="ניווט מובייל"
    >
      {/* Thin pink gradient line on top — soft visual separator. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(236,72,153,0.40) 50%, transparent 100%)",
        }}
      />

      {primaryItems.map((item) => {
        const active = isNavActive(item, pathname);
        const Icon = NAV_ICONS[item.key];
        return (
          <Tab
            key={item.key}
            label={item.label}
            href={item.href}
            active={active}
            badge={item.badge}
            dot={item.dot}
          >
            <Icon className="h-[19px] w-[19px]" />
          </Tab>
        );
      })}

      <Tab
        label={moreLabel}
        href={moreHref}
        active={moreActive}
      >
        <Menu className="h-[19px] w-[19px]" />
      </Tab>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────

interface TabProps {
  label:    string;
  href:     string;
  active:   boolean;
  badge?:   number | null;
  dot?:     boolean;
  children: React.ReactNode;
}

function Tab({ label, href, active, badge, dot, children }: TabProps) {
  return (
    <Link
      href={href}
      // 2026-05-31 — label sizing pass after mobile screenshot review:
      //   • text-[11px] → text-[12.5px] for legibility on small viewports
      //   • gap raised so a 2-line label doesn't crowd the icon
      //   • icon pill bumped 24→28px so the wordmark + glyph carry equal weight
      //   • text-center on the label so wrapped lines align to the icon
      //     centerline (without this, the second line was visually drifting
      //     to the start side under RTL).
      className="flex flex-col items-center gap-1 rounded-[11px] px-0.5 py-1.5 font-bold"
      style={{
        color: active ? "#FFFFFF" : "var(--shell-side-t2)",
      }}
      aria-current={active ? "page" : undefined}
    >
      <span
        className="relative flex h-7 w-7 items-center justify-center rounded-lg"
        style={{
          background: active ? "var(--shell-cta-grad)" : "transparent",
          color: active ? "#FFFFFF" : "var(--shell-side-t2)",
          boxShadow: active
            ? "0 6px 14px -6px rgba(236,72,153,0.5)"
            : undefined,
        }}
      >
        {children}
        {/* "חדש" indicator on top-left (RTL flips natively) */}
        {!active && ((badge && badge > 0) || dot) ? (
          <span
            aria-hidden
            className="absolute -top-0.5 h-2 w-2 rounded-full border-2"
            style={{
              insetInlineStart: -2,
              background: "var(--shell-wine)",
              borderColor: "var(--shell-side-bg)",
            }}
          />
        ) : null}
      </span>
      <span
        className="block w-full text-center text-[14.5px] leading-tight"
      >
        {label}
      </span>
    </Link>
  );
}
