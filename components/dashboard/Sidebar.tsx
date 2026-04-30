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

// ── Navigation model ────────────────────────────────────────────────────────
// The sidebar is a tree of NavItems. Groups are items that optionally have an
// `href` (so clicking the group also navigates - the group is still a valid
// destination) and a `children` list (the expandable sub-items). Leaf items
// have only `href`. Everything is driven off this single structure so adding
// a new page is just one edit.

type NavLeaf = {
  kind: "leaf";
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  kind: "group";
  id: string; // stable id for persistence
  label: string;
  icon: LucideIcon;
  /** Optional landing href for the group (e.g. Adults → /dashboard/adults). */
  href?: string;
  children: NavLeaf[];
};

type NavItem = (NavLeaf | NavGroup) & { adminOnly?: boolean };

const NAV: NavItem[] = [
  { kind: "leaf", href: "/dashboard", label: "Overview", icon: LayoutDashboard },

  {
    kind: "group",
    id: "coaching",
    label: "Coaching",
    icon: Stethoscope,
    children: [
      { kind: "leaf", href: "/dashboard/my-clients", label: "My Clients", icon: HeartHandshake },
      { kind: "leaf", href: "/dashboard/experts", label: "Experts", icon: UserCog },
    ],
  },

  {
    kind: "group",
    id: "games",
    label: "Games",
    icon: Gamepad2,
    children: [
      { kind: "leaf", href: "/dashboard/games", label: "Wheels 🎡", icon: RefreshCw },
      { kind: "leaf", href: "/dashboard/questions", label: "Wheel Questions", icon: MessageSquareText },
      { kind: "leaf", href: "/dashboard/snakes", label: "Snakes 🐍", icon: Gamepad2 },
      { kind: "leaf", href: "/dashboard/between-us", label: "Adults Only", icon: HeartHandshake },
    ],
  },

  {
    kind: "group",
    id: "journey",
    label: "Journey",
    icon: Route,
    href: "/dashboard/journey",
    children: [
      { kind: "leaf", href: "/dashboard/journey/programs", label: "Programs", icon: FolderKanban },
      { kind: "leaf", href: "/dashboard/journey/categories", label: "Categories", icon: Tags },
      { kind: "leaf", href: "/dashboard/journey/items", label: "Items", icon: FileText },
      { kind: "leaf", href: "/dashboard/journey/assignments", label: "Assignments", icon: Link2 },
      { kind: "leaf", href: "/dashboard/journey/clients", label: "Clients", icon: Users },
    ],
  },

  {
    kind: "group",
    id: "adults",
    label: "Adults",
    icon: Sparkles,
    href: "/dashboard/adults",
    children: [
      { kind: "leaf", href: "/dashboard/adults/games", label: "Games", icon: Gamepad2 },
      { kind: "leaf", href: "/dashboard/adults/categories", label: "Categories", icon: Tags },
      { kind: "leaf", href: "/dashboard/adults/tags", label: "Tags", icon: Tags },
      { kind: "leaf", href: "/dashboard/adults/promotions", label: "Promotions", icon: Megaphone },
      { kind: "leaf", href: "/dashboard/adults/settings", label: "Settings", icon: Settings },
    ],
  },

  {
    kind: "group",
    id: "users",
    label: "Users",
    icon: Users,
    children: [
      { kind: "leaf", href: "/dashboard/users", label: "Journey users", icon: UserCog },
      { kind: "leaf", href: "/dashboard/leads", label: "Leads", icon: Users },
      { kind: "leaf", href: "/dashboard/subscriptions", label: "Subscriptions", icon: CreditCard },
    ],
  },

  {
    kind: "group",
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    children: [
      { kind: "leaf", href: "/dashboard/homepage", label: "Homepage", icon: Home },
      { kind: "leaf", href: "/dashboard/articles", label: "Articles", icon: BookOpenText },
      { kind: "leaf", href: "/dashboard/templates", label: "Templates", icon: Mail },
    ],
  },

  {
    kind: "group",
    id: "report",
    label: "Report",
    icon: BarChart3,
    // Placeholder - no report pages shipped yet; the group is visible so admins
    // know analytics is a first-class area we plan to fill. Remove this TODO
    // and populate children when the analytics pages land.
    children: [],
  },

  {
    kind: "group",
    id: "system",
    label: "System",
    icon: Settings,
    children: [
      { kind: "leaf", href: "/dashboard/automation", label: "Automation", icon: Zap },
      { kind: "leaf", href: "/dashboard/settings", label: "Settings", icon: Settings },
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
}: {
  item: NavLeaf;
  pathname: string;
  indent?: boolean;
}) {
  const active = isHrefActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        indent && "pl-9",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
      )}
    >
      <Icon className={cn("size-4 shrink-0", indent && "opacity-70")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function GroupNav({
  group,
  pathname,
  expanded,
  onToggle,
}: {
  group: NavGroup;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const active = isGroupActive(pathname, group);
  const Icon = group.icon;
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const hasChildren = group.children.length > 0;

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
      <span className="flex-1 truncate">{group.label}</span>
    </>
  );

  return (
    <div className="flex flex-col">
      <div className={rowClass}>
        {group.href ? (
          <Link
            href={group.href}
            className="flex flex-1 min-w-0 items-center gap-3 rounded-l-lg px-3 py-2"
          >
            {labelContent}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex flex-1 min-w-0 items-center gap-3 rounded-l-lg px-3 py-2 text-left"
            aria-expanded={expanded}
          >
            {labelContent}
          </button>
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? `Collapse ${group.label}` : `Expand ${group.label}`}
            aria-expanded={expanded}
            className="p-2 rounded-r-lg hover:bg-sidebar-accent/30"
          >
            <Chevron className="size-3.5 opacity-60" />
          </button>
        ) : (
          <span className="pr-3 text-[10px] uppercase tracking-wide opacity-40">
            soon
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border/60 ml-[18px] pl-1.5">
          {group.children.map((child) => (
            <LeafLink
              key={child.href}
              item={child}
              pathname={pathname}
              indent
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

// Admin-only sidebar groups — experts (non-admin) don't see these. Keep this
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

export function Sidebar({ isAdmin = true }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { expanded, toggle } = useExpandedGroups(pathname);
  const visibleNav = useMemo(() => filterNav(NAV, isAdmin), [isAdmin]);

  const nav = (
    <nav className="flex flex-col gap-1">
      {visibleNav.map((item) =>
        item.kind === "leaf" ? (
          <LeafLink key={item.href} item={item} pathname={pathname} />
        ) : (
          <GroupNav
            key={item.id}
            group={item}
            pathname={pathname}
            expanded={expanded.has(item.id)}
            onToggle={() => toggle(item.id)}
          />
        ),
      )}
    </nav>
  );

  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground hidden w-60 shrink-0 border-r border-sidebar-border md:flex md:flex-col">
        <div className="p-4 text-lg font-semibold tracking-tight">
          {isAdmin ? "Mioshy Admin" : "Mioshy Coaching"}
        </div>
        <div className="px-2 pb-4 overflow-y-auto">{nav}</div>
      </aside>
      <div className="border-border bg-background flex items-center justify-between border-b p-3 md:hidden">
        <span className="font-semibold">Admin</span>
        <Sheet>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-6 overflow-y-auto">{nav}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
