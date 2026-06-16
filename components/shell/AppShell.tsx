/**
 * AppShell — the post-login application shell.
 *
 * Wraps every authenticated route under app/[locale]/(shell)/* (added
 * in Step 2). Renders:
 *
 *   Desktop (lg ≥ 1024px):
 *     ┌─────────────────────────────────────────┐
 *     │  CONTENT (children)        │  SIDEBAR   │
 *     │                            │  - couple  │
 *     │                            │  - nav     │
 *     │                            │  - expert  │
 *     └─────────────────────────────────────────┘
 *
 *   Mobile (< lg):
 *     ┌─────────────────────────────┐
 *     │   CONTENT (children)        │
 *     │                             │
 *     │   <bottom safe-area pad>    │
 *     └─────────────────────────────┘
 *     ┌─────────────────────────────┐
 *     │  [היום][שיעורים][מומחה]…    │  ← sticky tabs
 *     └─────────────────────────────┘
 *
 * Class `app-shell` on the root activates the post-login design tokens
 * in globals.css. Tokens are scoped — they do NOT leak into homepage
 * /marketing or game-in-play routes (which live under (naked)/).
 *
 * Data flow: this is a server component. It receives pre-resolved data
 * from the calling layout (couple + expert + badge counts). It owns no
 * DB calls itself, which keeps it cheap to render on every navigation.
 *
 * Added 2026-05-29 as Step 1 of the post-login redesign.
 * Visual spec: post-login-mockup-v12.html.
 */

import type { ReactNode } from "react";

import { SideNav } from "./SideNav";
import { MobileTabs } from "./MobileTabs";
import type {
  CoupleCardData,
  ExpertMiniData,
  NavItem,
  ShellChrome,
} from "./types";

interface Props {
  /** Page content rendered in the central area. */
  children: ReactNode;

  /** Navigation graph for THIS request (badges already baked in). */
  navItems: NavItem[];

  /** Identity card at the top of the sidebar. */
  couple: CoupleCardData;

  /** Expert mini at the bottom of the sidebar. `null` = hide block. */
  expert: ExpertMiniData | null;

  /** CMS-controlled labels. */
  chrome: ShellChrome;

  /** Mobile "עוד" tab label. CMS-controlled. */
  moreLabel: string;

  /** Optional className on the outer wrapper for per-page overrides. */
  className?: string;
}

export function AppShell({
  children,
  navItems,
  couple,
  expert,
  chrome,
  moreLabel,
  className,
}: Props) {
  return (
    <div
      // .app-shell scopes the post-login design tokens (see globals.css).
      // min-h-[100dvh] + grid keeps the chrome edge-to-edge. Direction is
      // set by the parent <html dir> — we use logical grid columns so the
      // sidebar lands on the inline-start side automatically:
      //   LTR (en): sidebar LEFT, content RIGHT
      //   RTL (he): sidebar RIGHT, content LEFT
      // The sidebar is the FIRST column in the source/grid order; no
      // order utilities needed — RTL flips columns visually for us.
      className={[
        "app-shell relative isolate min-h-[100dvh]",
        "grid grid-cols-1 lg:grid-cols-[240px_1fr]",
        className ?? "",
      ].join(" ")}
      style={{
        background: "var(--shell-canvas-deep)",
        color: "var(--shell-text-1)",
      }}
    >
      {/* a11y (M1): skip-to-content for the post-login shell. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-[#0E0810] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
      >
        דלג לתוכן
      </a>
      {/* ──────────────── Sidebar (desktop only) ────────────────
          Column 1 — inline-start side. RTL renders this on the right
          edge of the viewport, LTR on the left. Hidden under lg so the
          mobile bottom-tabs surface takes its place there. */}
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-[100dvh]">
        <SideNav
          items={navItems}
          couple={couple}
          expert={expert}
          chrome={chrome}
        />
      </aside>

      {/* ──────────────── Content area ────────────────
          Column 2 — inline-end side. On mobile we add bottom-padding so
          content doesn't sit UNDER the sticky <MobileTabs> (~72px + the
          safe-area inset). 96px is a comfortable buffer. lg: removes
          the padding because the mobile tab-bar is hidden then. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="relative min-h-[100dvh] pb-[96px] outline-none lg:pb-0"
        style={{ background: "var(--shell-canvas-grad)" }}
      >
        {children}
      </main>

      {/* ──────────────── Mobile bottom tabs ──────────────── */}
      <div className="lg:hidden">
        <MobileTabs items={navItems} moreLabel={moreLabel} />
      </div>
    </div>
  );
}
