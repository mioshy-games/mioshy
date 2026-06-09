"use client";

/**
 * components/dashboard/BottomNav.tsx
 *
 * Mobile-only (`md:hidden`) bottom navigation for the admin dashboard.
 * Five primary tabs cover the team's daily flow; the fifth ("More")
 * opens a Sheet with everything else, so we never lose a destination.
 *
 * Deliberately self-contained: it does NOT touch the desktop Sidebar or
 * its breakpoints. Tablet (md) and desktop (lg) render exactly as before.
 * The fixed bar sits above content with a safe-area inset so the home
 * indicator on iOS never overlaps a tap target.
 *
 * Tap targets are >=44px tall (Apple HIG); the active tab is tinted with
 * the primary colour and a pending-messages badge rides the Couples tab.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  HeartHandshake,
  Route,
  Gamepad2,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";

type Tab = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Treat any path under these prefixes as "this tab is active". */
  match: string[];
  badgeId?: string;
};

const TABS: Tab[] = [
  {
    href: "/dashboard",
    labelKey: "nav.overview",
    icon: LayoutDashboard,
    match: ["/dashboard"],
  },
  {
    href: "/dashboard/journey/clients",
    labelKey: "nav.couples",
    icon: HeartHandshake,
    match: ["/dashboard/journey/clients", "/dashboard/my-clients"],
    badgeId: "pending_messages",
  },
  {
    href: "/dashboard/journey",
    labelKey: "nav.journey",
    icon: Route,
    match: ["/dashboard/journey"],
  },
  {
    href: "/dashboard/games",
    labelKey: "nav.games",
    icon: Gamepad2,
    match: [
      "/dashboard/games",
      "/dashboard/questions",
      "/dashboard/snakes",
      "/dashboard/between-us",
      "/dashboard/adults",
    ],
  },
];

/** Sections surfaced in the "More" sheet. Landing href per area. */
const MORE_LINKS: { href: string; labelKey: string }[] = [
  { href: "/dashboard/clinician", labelKey: "nav.todays_queue" },
  { href: "/dashboard/users", labelKey: "nav.users" },
  { href: "/dashboard/subscriptions", labelKey: "nav.users_subscriptions" },
  { href: "/dashboard/leads", labelKey: "nav.users_leads" },
  { href: "/dashboard/assessments", labelKey: "nav.assessments" },
  { href: "/dashboard/homepage", labelKey: "nav.homepage" },
  { href: "/dashboard/articles", labelKey: "nav.articles" },
  { href: "/dashboard/automation", labelKey: "nav.automation" },
  { href: "/dashboard/settings", labelKey: "nav.settings" },
];

function isActive(pathname: string, match: string[]): boolean {
  return match.some((m) =>
    m === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === m || pathname.startsWith(m + "/"),
  );
}

export function BottomNav({
  locale = "he",
  badges,
}: {
  locale?: AdminLocale;
  badges?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const safeBadges = badges ?? {};
  // The "Couples" tab is active when on its area but NOT when a more
  // specific tab (Journey content) would also match. We resolve ties by
  // letting the deepest/most-specific match win via ordering: clients is
  // checked against its own prefixes only, so /journey/clients lights
  // Couples and not the generic Journey tab.
  const couplesActive = isActive(pathname, TABS[1].match);

  return (
    <nav
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t border-border backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t(locale, "nav.menu")}
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active =
            tab.labelKey === "nav.journey"
              ? isActive(pathname, tab.match) && !couplesActive
              : isActive(pathname, tab.match);
          const Icon = tab.icon;
          const count = tab.badgeId ? safeBadges[tab.badgeId] ?? 0 : 0;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-6" />
                  {count > 0 ? (
                    <span className="absolute -end-2 -top-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{t(locale, tab.labelKey)}</span>
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <Sheet>
            <SheetTrigger
              className="text-muted-foreground hover:text-foreground flex min-h-[56px] w-full flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium transition-colors"
              aria-label={t(locale, "nav.more")}
            >
              <MoreHorizontal className="size-6" />
              <span>{t(locale, "nav.more")}</span>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="max-h-[80vh] overflow-y-auto rounded-t-2xl"
            >
              <SheetHeader>
                <SheetTitle>{t(locale, "nav.more")}</SheetTitle>
              </SheetHeader>
              <ul className="mt-4 grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]">
                {MORE_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="bg-muted/40 hover:bg-muted flex min-h-[48px] items-center rounded-lg px-4 text-sm font-medium"
                    >
                      {t(locale, l.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
