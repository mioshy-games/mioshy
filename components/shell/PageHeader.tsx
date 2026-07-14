/**
 * PageHeader — the sticky top bar that crowns every (shell) page.
 *
 * Layout (RTL):
 *   ┌────────────────────────────────────────────────────┐
 *   │  [Bell] [Settings] [Search]    מיאושי שלי · עמוד   │
 *   └────────────────────────────────────────────────────┘
 *
 * On mobile we collapse the breadcrumb into a stacked title:
 *   "מיאושי שלי" (small)  +  "השם של העמוד" (bold)
 * — matches the v12 mockup `.m-top` layout. Bell badge optional.
 *
 * Pure presentational. Receives the page name + optional bell count.
 */

import { Bell, Search, Settings, Users } from "lucide-react";
import { Link } from "@/navigation";

interface Props {
  /** Localized "מיאושי שלי" prefix. Comes from appShell.rootCrumb. */
  rootLabel:  string;
  /** Current page name ("היום", "השיעורים שלי", …). */
  pageLabel:  string;
  /** Optional sub-line shown above the page name on mobile only.
   *  Used for context like "המוקד · מיניות ואינטימיות". */
  subLine?:   string | null;
  /** Unread notifications count for the bell badge. 0 hides it. */
  bellCount?: number;
  /** Where the bell links to. Defaults to /my/notifications. */
  bellHref?:  string;
  /** Where the gear links to. Defaults to /my/settings. */
  settingsHref?: string;
}

export function PageHeader({
  rootLabel,
  pageLabel,
  subLine,
  bellCount = 0,
  bellHref = "/my/notifications",
  settingsHref = "/my/settings",
}: Props) {
  return (
    <header
      className="sticky top-0 z-20 flex min-h-[60px] items-center justify-between gap-3 border-b px-5 py-3 backdrop-blur-md"
      style={{
        background: "rgba(15,8,40,0.55)",
        borderColor: "var(--shell-line-soft)",
      }}
    >
      {/* a11y (h1): the page's single, programmatic heading. The visible
          breadcrumb/title below are styled spans; this sr-only h1 gives every
          shell page exactly one h1 without changing the layout. */}
      <h1 className="sr-only">{pageLabel}</h1>
      {/* Breadcrumb / page name. Desktop = single line. Mobile = stacked. */}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-tight" style={{ color: "var(--shell-text-3)" }}>
          {/* On mobile this row shows the sub-line as context.
              On desktop it shows the crumb prefix. */}
          <span className="hidden lg:inline">
            {rootLabel} · <span className="font-semibold" style={{ color: "var(--shell-text-1)" }}>{pageLabel}</span>
          </span>
          <span className="lg:hidden">{subLine ?? rootLabel}</span>
        </div>
        {/* Mobile-only bold page label on row 2 */}
        <div
          className="truncate text-[15px] font-bold leading-tight lg:hidden"
          style={{ color: "var(--shell-text-1)" }}
        >
          {pageLabel}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* Search — hidden on mobile, placeholder for now */}
        <button
          type="button"
          aria-label="חיפוש"
          className="hidden h-8 w-8 items-center justify-center rounded-[9px] text-white transition hover:bg-white/10 lg:flex"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <Search className="h-4 w-4" />
        </button>

        {/* Bell (notifications) */}
        <Link
          href={bellHref}
          aria-label="התראות"
          className="relative flex h-8 w-8 items-center justify-center rounded-[9px] text-white transition hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <Bell className="h-4 w-4" />
          {bellCount > 0 ? (
            <span
              className="absolute -left-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 px-1 text-[10px] font-extrabold leading-none"
              style={{
                background: "var(--shell-amber)",
                color: "#1A1410",
                borderColor: "var(--shell-canvas)",
              }}
            >
              {bellCount > 99 ? "99+" : bellCount}
            </span>
          ) : null}
        </Link>

        {/* Share / invite shortcut — the mobile access point for /my/share
            once the bottom-bar "עוד" tab is replaced by the survey tab. */}
        <Link
          href="/my/share"
          aria-label="שיתוף"
          className="flex h-8 w-8 items-center justify-center rounded-[9px] text-white transition hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <Users className="h-4 w-4" />
        </Link>

        {/* Settings shortcut */}
        <Link
          href={settingsHref}
          aria-label="הגדרות"
          className="flex h-8 w-8 items-center justify-center rounded-[9px] text-white transition hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
