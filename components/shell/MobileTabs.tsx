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
import { useEffect, useRef } from "react";
import type { ComponentType, SVGProps } from "react";
import {
  BookOpen,
  ClipboardList,
  Heart,
  LayoutGrid,
  MessageCircle,
  Settings,
  Users,
} from "lucide-react";

import { MOBILE_PRIMARY_KEYS, isNavActive, NAV_HREF } from "./NavConfig";
import { SurveyNavLink } from "@/components/analytics/SurveyLink";
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
  survey:   ClipboardList,
  settings: Settings,
};

interface Props {
  items: NavItem[];
  /** Label for the "עוד" tab. CMS-controlled via the layout. */
  moreLabel: string;
  /** Where "עוד" links to. Defaults to /my/more — caller can override. */
  moreHref?: string;
}

export function MobileTabs({ items }: Props) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  // Publish the bar's measured height as `--mobile-tabs-h` so anything else
  // pinned to the bottom edge can stack ON TOP of it instead of covering it
  // (AssessmentBar does exactly this on /my/survey). Measurement only — this
  // adds no styling to the bar and cannot change how it looks.
  //
  // AppShell wraps this component in `lg:hidden`, so on desktop the ancestor is
  // display:none and offsetHeight is 0 — which is the right answer there.
  useEffect(() => {
    const measure = () => {
      const h = navRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--mobile-tabs-h", `${h}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      document.documentElement.style.removeProperty("--mobile-tabs-h");
    };
  }, []);

  // Lookup table so we can pull the 5 primary items in display order.
  const itemByKey: Partial<Record<NavKey, NavItem>> = {};
  for (const item of items) itemByKey[item.key] = item;

  // 2026-07-13 — bottom bar is now the 5 services [lessons, expert, games,
  // adults, survey]. The old "עוד" tab was retired: share/notifications/settings
  // are reached from the PageHeader shortcuts (share + bell + gear).
  const primaryItems = MOBILE_PRIMARY_KEYS
    .map((k) => itemByKey[k])
    .filter((x): x is NavItem => !!x);

  return (
    <nav
      ref={navRef}
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
  // The survey tab reports its click (Meta + PostHog); every other tab stays a
  // plain Link. Both render the identical props/children below.
  const Anchor = href === NAV_HREF.survey ? SurveyNavLink : Link;
  return (
    <Anchor
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
    </Anchor>
  );
}
