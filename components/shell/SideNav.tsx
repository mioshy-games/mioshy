"use client";

/**
 * SideNav — desktop right-side navigation rail.
 *
 * Composed of:
 *   1. <CoupleCard>         — top (names + avatars)
 *   2. Three grouped nav blocks (המסע / משחקים / החשבון)
 *   3. Divider + "התנתקות" item
 *   4. <ExpertMini>         — bottom (chat preview + ask link)
 *
 * Width: 240px fixed (post-Studio v12 — narrower than the earlier
 * 288px reading). Sticky to the viewport, scrollable inner content.
 *
 * Active-item visual is INTENTIONALLY subtle (small accent bar on the
 * inside edge + slightly elevated background) — sidebar marks PRESENCE,
 * the hero CTA in the content area marks ACTION. Per Studio v12 fix.
 *
 * Client component because:
 *   • reads pathname via @/navigation usePathname() for active state
 *   • will host onClick handlers (collapse toggle, ⋯ menu) in future steps
 *
 * Receives data props from the (shell) layout's server component.
 */

import { Link, usePathname } from "@/navigation";

import { CoupleCard } from "./CoupleCard";
import { ExpertMini } from "./ExpertMini";
import { LogoutLink } from "./LogoutLink";
import { isNavActive } from "./NavConfig";
import type {
  CoupleCardData,
  ExpertMiniData,
  NavGroup,
  NavItem,
  ShellChrome,
} from "./types";

interface Props {
  items:    NavItem[];
  couple:   CoupleCardData;
  expert:   ExpertMiniData | null;
  chrome:   ShellChrome;
}

const GROUP_ORDER: NavGroup[] = ["journey", "games", "account"];

export function SideNav({ items, couple, expert, chrome }: Props) {
  const pathname = usePathname();

  // Group items by their .group, preserving array order within each group.
  const byGroup: Record<NavGroup, NavItem[]> = {
    journey:  [],
    games:    [],
    account:  [],
  };
  for (const item of items) byGroup[item.group].push(item);

  return (
    <aside
      // border-inline-end (border-e) sits on the edge facing the content
      // area in BOTH directions: LTR → right side of sidebar, RTL → left
      // side of sidebar. The pink gradient line below also lives on the
      // same edge (insetInlineEnd:0) so the two divider treatments stack
      // without crossing the viewport edge.
      className="relative flex h-full flex-col border-e border-[var(--shell-side-line)]"
      style={{
        background:
          "linear-gradient(180deg, var(--shell-side-bg-soft) 0%, var(--shell-side-bg) 60%)",
        color: "var(--shell-side-t1)",
      }}
    >
      {/* Soft pink edge top-down — visual separator from content area.
          insetInlineEnd:0 anchors to the same edge as the border-e above. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 top-0 w-px"
        style={{
          insetInlineEnd: 0,
          background:
            "linear-gradient(180deg, rgba(236,72,153,0.30) 0%, rgba(236,72,153,0.05) 35%, transparent 100%)",
        }}
      />

      <CoupleCard data={couple} />

      <nav
        className="flex flex-1 flex-col gap-px overflow-y-auto px-2 py-2"
        aria-label="ניווט ראשי"
      >
        {GROUP_ORDER.map((group) => {
          const groupItems = byGroup[group];
          if (groupItems.length === 0) return null;
          return (
            <div key={group}>
              <div
                className="px-2.5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: "var(--shell-side-t3)" }}
              >
                {chrome.groupHeadings[group]}
              </div>
              {groupItems.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  active={isNavActive(item, pathname)}
                />
              ))}
            </div>
          );
        })}

        {/* divider + logout (matches Studio v12 — logout in nav, not buried
            in settings). LogoutLink calls the existing logoutAction server
            action and hard-redirects to "/" to clear cached auth state. */}
        <div
          className="mx-3 my-2 h-px"
          style={{ background: "var(--shell-side-line)" }}
        />
        <LogoutLink label={chrome.logoutLabel} />
      </nav>

      <ExpertMini data={expert} />
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Single nav row. Active state = subtle background + thin gradient
// accent on the inner edge (RTL-aware). Not a button — presence only.
// ─────────────────────────────────────────────────────────────────────

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.Icon;
  return (
    <Link
      href={item.href}
      className="relative flex min-h-[40px] items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[15px] font-semibold transition hover:bg-[var(--shell-side-hover)]"
      style={{
        color: "var(--shell-side-t1)",
        background: active ? "rgba(244,236,238,0.04)" : "transparent",
        fontWeight: active ? 700 : 600,
      }}
      aria-current={active ? "page" : undefined}
    >
      {/* Active indicator: 2.5px gradient bar on the inside edge.
          insetInlineStart so it flips correctly in LTR locales. */}
      {active ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-2 top-2 w-[2.5px] rounded-[2px]"
          style={{
            insetInlineStart: 0,
            background: "var(--shell-cta-grad)",
          }}
        />
      ) : null}

      <Icon
        className="h-[19px] w-[19px] shrink-0"
        style={{
          color: active ? "var(--shell-pink-text)" : "var(--shell-side-t2)",
        }}
      />
      <span className="flex-1 truncate">{item.label}</span>

      {/* Badge (numeric) or soft dot */}
      {item.badge && item.badge > 0 ? (
        <span
          className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-white"
          style={{ background: "var(--shell-wine)" }}
        >
          {item.badge}
        </span>
      ) : item.dot ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: "var(--shell-wine)" }}
          aria-label="חדש"
        />
      ) : null}
    </Link>
  );
}
