"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gamepad2,
  Home,
  MessageSquareText,
  BookOpenText,
  Users,
  UserCog,
  Mail,
  Zap,
  CreditCard,
  Settings,
  Menu,
  HeartHandshake,
  Route,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Megaphone,
  BarChart3,
  Sparkles,
  Link2,
  FileText,
  Tags,
  FolderKanban,
  Stethoscope,
  Inbox,
  TrendingDown,
  UsersRound,
  Send,
  Activity,
  BookMarked,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";
type Loc = AdminLocale;
import { AdminLocaleToggle } from "./AdminLocaleToggle";

// ── Navigation model ────────────────────────────────────────────────────────
// The sidebar is a tree of NavItems. Groups are items that optionally have an
// `href` (so clicking the group also navigates - the group is still a valid
// destination) and a `children` list (the expandable sub-items). Leaf items
// have only `href`. Everything is driven off this single structure so adding
// a new page is just one edit.

type NavLeaf = {
  kind: "leaf";
  href: string;
  /** i18n key for the label. */
  labelKey: string;
  icon: LucideIcon;
  /** Hide this leaf from non-admin sidebars. Optional. */
  adminOnly?: boolean;
  /** i18n key for the tooltip. Optional. */
  tooltipKey?: string;
  /** 2026-06-01 — stable id used to inject runtime badge counts (e.g.
   *  pending expert messages). Optional; only items expected to carry
   *  a badge declare one. */
  badgeId?: string;
};

type NavGroup = {
  kind: "group";
  id: string; // stable id for persistence
  /** i18n key for the label. */
  labelKey: string;
  icon: LucideIcon;
  /** Optional landing href for the group (e.g. Adults → /dashboard/adults). */
  href?: string;
  children: NavLeaf[];
  /** Hide this whole group from non-admin sidebars. Optional. */
  adminOnly?: boolean;
  /** 2026-06-01 — propagate the SUM of badge counts from descendants up
   *  to the group header so a collapsed group still shows the unread
   *  affordance. Computed by the renderer from `badgeId` matches; do
   *  NOT set manually. */
};

type NavItem = NavLeaf | NavGroup;

const NAV: NavItem[] = [
  { kind: "leaf", href: "/dashboard", labelKey: "nav.overview", icon: LayoutDashboard },

  {
    kind: "group",
    id: "coaching",
    labelKey: "nav.coaching",
    icon: Stethoscope,
    children: [
      { kind: "leaf", href: "/dashboard/help",           labelKey: "nav.help",           icon: HelpCircle },
      { kind: "leaf", href: "/dashboard/coaching-guide", labelKey: "nav.coaching_guide", icon: BookMarked, tooltipKey: "tip.coaching_guide" },
      { kind: "leaf", href: "/dashboard/clinician",      labelKey: "nav.todays_queue",   icon: Stethoscope },
      { kind: "leaf", href: "/dashboard/my-clients",     labelKey: "nav.my_clients",     icon: HeartHandshake, badgeId: "pending_messages" },
      { kind: "leaf", href: "/dashboard/coach-profile",  labelKey: "nav.my_profile",     icon: UserCog, tooltipKey: "tip.my_profile" },
      { kind: "leaf", href: "/dashboard/coach-library",  labelKey: "nav.my_library",     icon: BookOpenText, tooltipKey: "tip.my_library" },
      { kind: "leaf", href: "/dashboard/experts",        labelKey: "nav.experts",        icon: UserCog, adminOnly: true },
      // 2026-06-01 — admin-only whitelist for QA/test accounts.
      { kind: "leaf", href: "/dashboard/test-users",     labelKey: "nav.test_users",     icon: Sparkles, adminOnly: true },
    ],
  },

  {
    kind: "group",
    id: "games",
    labelKey: "nav.games",
    icon: Gamepad2,
    children: [
      { kind: "leaf", href: "/dashboard/games",      labelKey: "nav.wheels",          icon: RefreshCw },
      { kind: "leaf", href: "/dashboard/questions",  labelKey: "nav.wheel_questions", icon: MessageSquareText },
      { kind: "leaf", href: "/dashboard/snakes",     labelKey: "nav.snakes",          icon: Gamepad2 },
      { kind: "leaf", href: "/dashboard/between-us", labelKey: "nav.adults_only",     icon: HeartHandshake },
    ],
  },

  {
    kind: "group",
    id: "journey",
    labelKey: "nav.journey",
    icon: Route,
    href: "/dashboard/journey",
    children: [
      { kind: "leaf", href: "/dashboard/journey/programs",       labelKey: "nav.programs",       icon: FolderKanban },
      { kind: "leaf", href: "/dashboard/journey/categories",     labelKey: "nav.categories",     icon: Tags },
      { kind: "leaf", href: "/dashboard/journey/items",          labelKey: "nav.items",          icon: FileText },
      { kind: "leaf", href: "/dashboard/journey/assignments",    labelKey: "nav.assignments",    icon: Link2, tooltipKey: "tip.assignments" },
      { kind: "leaf", href: "/dashboard/journey/clients",        labelKey: "nav.clients",        icon: Users },
      { kind: "leaf", href: "/dashboard/journey/groups",         labelKey: "nav.groups",         icon: UsersRound, tooltipKey: "tip.groups" },
      { kind: "leaf", href: "/dashboard/journey/push",           labelKey: "nav.push",           icon: Send, tooltipKey: "tip.push" },
      { kind: "leaf", href: "/dashboard/journey/match-rules",    labelKey: "nav.match_rules",    icon: Sparkles },
      { kind: "leaf", href: "/dashboard/journey/feedback",       labelKey: "nav.feedback",       icon: MessageSquareText },
      { kind: "leaf", href: "/dashboard/journey/replies",        labelKey: "nav.replies",        icon: Inbox, badgeId: "pending_messages" },
      { kind: "leaf", href: "/dashboard/journey/expert-messages",labelKey: "nav.expert_messages",icon: MessageSquareText },
      { kind: "leaf", href: "/dashboard/journey/metrics",        labelKey: "nav.metrics",        icon: Activity },
      { kind: "leaf", href: "/dashboard/journey/health",         labelKey: "nav.health",         icon: Activity, adminOnly: true, tooltipKey: "tip.health" },
      { kind: "leaf", href: "/dashboard/journey-analytics",      labelKey: "nav.analytics",      icon: TrendingDown, adminOnly: true },
    ],
  },

  { kind: "leaf", href: "/dashboard/assessments", labelKey: "nav.assessments", icon: FileText, adminOnly: true },

  {
    kind: "group",
    id: "adults",
    labelKey: "nav.adults",
    icon: Sparkles,
    href: "/dashboard/adults",
    children: [
      { kind: "leaf", href: "/dashboard/adults/games",      labelKey: "nav.adults_games",      icon: Gamepad2 },
      { kind: "leaf", href: "/dashboard/adults/categories", labelKey: "nav.adults_categories", icon: Tags },
      { kind: "leaf", href: "/dashboard/adults/tags",       labelKey: "nav.adults_tags",       icon: Tags },
      { kind: "leaf", href: "/dashboard/adults/promotions", labelKey: "nav.adults_promotions", icon: Megaphone },
      { kind: "leaf", href: "/dashboard/adults/settings",   labelKey: "nav.adults_settings",   icon: Settings },
    ],
  },

  {
    kind: "group",
    id: "users",
    labelKey: "nav.users",
    icon: Users,
    children: [
      { kind: "leaf", href: "/dashboard/users",         labelKey: "nav.users_journey",       icon: UserCog },
      { kind: "leaf", href: "/dashboard/leads",         labelKey: "nav.users_leads",         icon: Users },
      { kind: "leaf", href: "/dashboard/subscriptions", labelKey: "nav.users_subscriptions", icon: CreditCard },
    ],
  },

  {
    kind: "group",
    id: "marketing",
    labelKey: "nav.marketing",
    icon: Megaphone,
    children: [
      { kind: "leaf", href: "/dashboard/homepage",  labelKey: "nav.homepage",  icon: Home },
      { kind: "leaf", href: "/dashboard/articles",  labelKey: "nav.articles",  icon: BookOpenText },
      { kind: "leaf", href: "/dashboard/templates", labelKey: "nav.templates", icon: Mail },
      // /admin/content lives OUTSIDE the dashboard route tree
      // (different layout, different auth gate — see app/admin/...).
      // Linking from here is the natural entry point for admins who
      // are already in the dashboard.
      { kind: "leaf", href: "/admin/content",       labelKey: "nav.content_cms", icon: FileText, adminOnly: true },
    ],
  },

  {
    kind: "group",
    id: "report",
    labelKey: "nav.report",
    icon: BarChart3,
    // Placeholder - no report pages shipped yet; the group is visible so admins
    // know analytics is a first-class area we plan to fill. Remove this TODO
    // and populate children when the analytics pages land.
    children: [],
  },

  {
    kind: "group",
    id: "system",
    labelKey: "nav.system",
    icon: Settings,
    children: [
      { kind: "leaf", href: "/dashboard/automation", labelKey: "nav.automation", icon: Zap },
      { kind: "leaf", href: "/dashboard/settings",   labelKey: "nav.settings",   icon: Settings },
    ],
  },
];

// ── Active-path matching ────────────────────────────────────────────────────

function isHrefActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

function isGroupActive(pathname: string, group: NavGroup): boolean {
  if (group.href && isHrefActive(pathname, group.href)) return true;
  return group.children.some((c) => isHrefActive(pathname, c.href));
}

// ── Components ──────────────────────────────────────────────────────────────

function LeafLink({
  item,
  pathname,
  indent,
  locale,
  badgeCount = 0,
}: {
  item: NavLeaf;
  pathname: string;
  indent?: boolean;
  locale: Loc;
  /** 2026-06-01 — when > 0 we paint a small rose-tinted count badge at
   *  the trailing edge of the row. The badge is purely visual; the
   *  click target stays the whole link. */
  badgeCount?: number;
}) {
  const active = isHrefActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.tooltipKey ? t(locale, item.tooltipKey) : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        indent && "ps-9",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
      )}
    >
      <Icon className={cn("size-4 shrink-0", indent && "opacity-70")} />
      <span className="truncate flex-1">{t(locale, item.labelKey)}</span>
      {badgeCount > 0 ? (
        <span
          className="ms-auto inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-rose-500/90 px-1.5 text-[11px] font-extrabold text-white"
          aria-label={`${badgeCount} pending`}
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function GroupNav({
  group,
  pathname,
  expanded,
  onToggle,
  locale,
  badges,
}: {
  group: NavGroup;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  locale: Loc;
  badges: Partial<Record<string, number>>;
}) {
  const active = isGroupActive(pathname, group);
  const Icon = group.icon;
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const hasChildren = group.children.length > 0;

  // 2026-06-01 — sum every descendant's badge so a COLLAPSED group still
  // surfaces the unread count on its own header. When the group is
  // expanded the count moves down to the individual leaf (the per-leaf
  // badge still renders below regardless).
  const groupBadgeTotal = group.children.reduce<number>(
    (acc, c) => acc + (c.badgeId ? badges[c.badgeId] ?? 0 : 0),
    0,
  );

  // A group header is a row with two click targets so we can satisfy both
  // navigation (click the label) and disclosure (click the chevron) without
  // nesting a Link inside a <button>, which is invalid HTML. The whole row
  // highlights together on hover so it still reads as one unit.
  const rowClass = cn(
    "group/header flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
    active
      ? "text-sidebar-foreground bg-sidebar-accent/40"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
  );

  const labelContent = (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{t(locale, group.labelKey)}</span>
      {/* Only render the rollup badge when the group is COLLAPSED — once
          expanded, the children carry their own badges so showing both
          double-counts visually. */}
      {!expanded && groupBadgeTotal > 0 ? (
        <span
          className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-rose-500/90 px-1.5 text-[11px] font-extrabold text-white"
          aria-label={`${groupBadgeTotal} pending in ${t(locale, group.labelKey)}`}
        >
          {groupBadgeTotal > 99 ? "99+" : groupBadgeTotal}
        </span>
      ) : null}
    </>
  );

  const groupLabel = t(locale, group.labelKey);

  return (
    <div className="flex flex-col">
      <div className={rowClass}>
        {group.href ? (
          <Link
            href={group.href}
            className="flex flex-1 min-w-0 items-center gap-3 rounded-s-lg px-3 py-2"
          >
            {labelContent}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex flex-1 min-w-0 items-center gap-3 rounded-s-lg px-3 py-2 text-start"
            aria-expanded={expanded}
          >
            {labelContent}
          </button>
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              expanded
                ? `${t(locale, "btn.close")} ${groupLabel}`
                : `${t(locale, "btn.open")} ${groupLabel}`
            }
            aria-expanded={expanded}
            className="p-2 rounded-e-lg hover:bg-sidebar-accent/30"
          >
            <Chevron className="size-3.5 opacity-60 rtl:scale-x-[-1]" />
          </button>
        ) : (
          <span className="pe-3 text-[10px] uppercase tracking-wide opacity-40">
            {t(locale, "nav.soon")}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-0.5 flex flex-col gap-0.5 border-s border-sidebar-border/60 ms-[18px] ps-1.5">
          {group.children.map((child) => (
            <LeafLink
              key={child.href}
              item={child}
              pathname={pathname}
              indent
              locale={locale}
              badgeCount={child.badgeId ? badges[child.badgeId] ?? 0 : 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mioshy.sidebar.expanded.v1";

function useExpandedGroups(pathname: string) {
  // Groups that contain the current path start expanded. State also persists
  // in localStorage so the admin's last choice sticks across page loads.
  const initialAutoExpanded = useMemo(() => {
    const s = new Set<string>();
    for (const item of NAV) {
      if (item.kind === "group" && isGroupActive(pathname, item)) s.add(item.id);
    }
    return s;
  }, [pathname]);

  const [expanded, setExpanded] = useState<Set<string>>(initialAutoExpanded);

  // Load persisted state on mount (client only) and merge with auto-expanded
  // groups so the current section is always visible.
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      if (!Array.isArray(ids)) return;
      setExpanded((prev) => {
        const next = new Set(ids);
        // Merge in the auto-expanded groups (current section) so nothing the
        // user is currently viewing gets hidden. Using forEach avoids the
        // down-level Set<T> iteration that tsconfig rejects here.
        prev.forEach((id) => next.add(id));
        return next;
      });
    } catch {
      /* ignore corrupt storage */
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand the current section whenever the route changes.
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const item of NAV) {
        if (item.kind === "group" && isGroupActive(pathname, item)) next.add(item.id);
      }
      return next;
    });
  }, [pathname]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return { expanded, toggle };
}

// Admin-only sidebar groups - experts (non-admin) don't see these. Keep this
// list explicit so a non-admin signing in only sees Coaching.
const ADMIN_ONLY_GROUP_IDS = new Set([
  "games",
  "journey",
  "adults",
  "users",
  "marketing",
  "report",
  "system",
]);

function filterNav(items: NavItem[], isAdmin: boolean): NavItem[] {
  if (isAdmin) return items;
  return items.filter((item) => {
    if (item.kind === "leaf") return item.href === "/dashboard"; // overview only
    return item.id === "coaching" // expert keeps Coaching
      && !ADMIN_ONLY_GROUP_IDS.has(item.id);
  }).map((item) => {
    if (item.kind !== "group") return item;
    if (item.id === "coaching") {
      return {
        ...item,
        children: item.children.filter((c) => c.href !== "/dashboard/experts"),
      };
    }
    return item;
  });
}

export function Sidebar({
  isAdmin = true,
  locale = "en",
  badges,
}: {
  isAdmin?: boolean;
  locale?: Loc;
  /** 2026-06-01 — runtime badge counts keyed by NavLeaf.badgeId. Server
   *  layout resolves these once per render (e.g. pending-messages) and
   *  passes them down. The Sidebar itself is a client component and
   *  can't fetch — keeps the data flow one-way. */
  badges?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  const { expanded, toggle } = useExpandedGroups(pathname);
  const visibleNav = useMemo(() => filterNav(NAV, isAdmin), [isAdmin]);
  const safeBadges = badges ?? {};

  const nav = (
    <nav className="flex flex-col gap-1">
      {visibleNav.map((item) =>
        item.kind === "leaf" ? (
          <LeafLink
            key={item.href}
            item={item}
            pathname={pathname}
            locale={locale}
            badgeCount={item.badgeId ? safeBadges[item.badgeId] ?? 0 : 0}
          />
        ) : (
          <GroupNav
            key={item.id}
            group={item}
            pathname={pathname}
            expanded={expanded.has(item.id)}
            onToggle={() => toggle(item.id)}
            locale={locale}
            badges={safeBadges}
          />
        ),
      )}
    </nav>
  );

  // Side a/b honour RTL — sidebar pinned to start (right in Hebrew, left in English).
  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 border-e border-sidebar-border md:flex md:flex-col">
        <div className="flex items-center justify-between gap-2 p-4">
          <div className="text-lg font-semibold tracking-tight">
            {isAdmin
              ? t(locale, "brand.admin")
              : t(locale, "brand.coaching")}
          </div>
          <AdminLocaleToggle current={locale} />
        </div>
        <div className="px-2 pb-4 overflow-y-auto">{nav}</div>
      </aside>
      <div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 flex items-center justify-between gap-2 border-b p-3 backdrop-blur md:hidden">
        <span className="font-semibold">
          {isAdmin
            ? t(locale, "brand.admin")
            : t(locale, "brand.coaching")}
        </span>
        <div className="flex items-center gap-2">
          <AdminLocaleToggle current={locale} />
          <Sheet>
            <SheetTrigger
              className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
              aria-label={t(locale, "nav.menu")}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side={locale === "he" ? "right" : "left"} className="w-72">
              <SheetHeader>
                <SheetTitle>{t(locale, "nav.menu")}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 overflow-y-auto">{nav}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
