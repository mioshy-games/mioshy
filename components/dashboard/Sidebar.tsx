"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gamepad2,
  MessageSquareText,
  BookOpenText,
  Users,
  CreditCard,
  Settings,
  Menu,
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

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/games", label: "Games", icon: Gamepad2 },
  { href: "/dashboard/snakes", label: "Snakes", icon: Gamepad2 },
  { href: "/dashboard/questions", label: "Questions", icon: MessageSquareText },
  { href: "/dashboard/articles", label: "Articles", icon: BookOpenText },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const nav = (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground hidden w-56 shrink-0 border-r border-sidebar-border md:flex md:flex-col">
        <div className="p-4 text-lg font-semibold tracking-tight">Mioshy Admin</div>
        <div className="px-2 pb-4">{nav}</div>
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
          <SheetContent side="left" className="w-64">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="mt-6">{nav}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
