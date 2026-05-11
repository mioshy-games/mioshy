"use client";

/**
 * AdminLocaleToggle
 *
 * Phase 11A — single-button toggle that switches the admin between
 * English (LTR) and Hebrew (RTL). Lives in the sidebar header.
 *
 * Implementation: posts to /api/admin/locale (a thin route that just
 * sets the cookie), then reloads the page so the server-side layout
 * picks up the new dir + locale. Reload is intentional — every
 * server component reads getAdminLocale() at render so a client-side
 * Context wouldn't fully cover.
 */

import { useTransition } from "react";
import { Languages, Loader2 } from "lucide-react";

import type { AdminLocale } from "@/lib/admin/locale";

export function AdminLocaleToggle({
  current,
}: {
  current: AdminLocale;
}) {
  const [pending, startTransition] = useTransition();
  const next: AdminLocale = current === "he" ? "en" : "he";
  const label = next === "he" ? "עברית" : "English";
  const aria  = next === "he" ? "החלף לעברית" : "Switch to English";

  const toggle = () => {
    startTransition(async () => {
      try {
        await fetch("/api/admin/locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: next }),
        });
        // Reload so the server layout applies the new dir + locale.
        if (typeof window !== "undefined") window.location.reload();
      } catch (e) {
        console.warn("[AdminLocaleToggle] fetch failed", e);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={aria}
      title={aria}
      className="inline-flex items-center gap-1.5 rounded-md border border-sidebar-border/40 bg-sidebar-accent/20 px-2 py-1 text-[11px] font-semibold text-sidebar-foreground/85 hover:bg-sidebar-accent/40 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Languages className="size-3" />
      )}
      {label}
    </button>
  );
}
