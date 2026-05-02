"use client";

// ============================================================
// JourneyNotificationsBell — slice 10 user-side notifications
// inbox, dropdown form. Lives in the SiteHeader.
//
// Server passes initialUnreadCount + isHe; the bell renders the
// count badge instantly. On click, the dropdown lazy-loads the
// latest 20 via the server action listMyNotifications().
//
// Mark-read is per-row (clicking a row navigates AND stamps read_at)
// or batched via "Mark all as read".
// ============================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listMyNotifications,
  markAllUserNotificationsRead,
  markNotificationRead,
} from "@/app/actions/journey-notifications";
import type { NotificationRow } from "@/lib/journey-content/notifications-read";
import {
  describeNotification,
  notificationHref,
  notificationPreview,
  toneClasses,
} from "@/lib/notifications/labels";

interface Props {
  initialUnreadCount: number;
  isHe: boolean;
}

export function JourneyNotificationsBell({
  initialUnreadCount,
  isHe,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(initialUnreadCount);
  const [items, setItems] = React.useState<NotificationRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  // Click-outside dismiss.
  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Lazy-load on first open.
  React.useEffect(() => {
    if (!open || items !== null) return;
    setLoading(true);
    void listMyNotifications()
      .then((rows) => setItems(rows))
      .finally(() => setLoading(false));
  }, [open, items]);

  async function handleMarkAll() {
    const res = await markAllUserNotificationsRead();
    if (res.ok) {
      setItems((prev) =>
        prev
          ? prev.map((r) =>
              r.read_at ? r : { ...r, read_at: new Date().toISOString() },
            )
          : prev,
      );
      setUnread(0);
      router.refresh();
    }
  }

  async function handleRowClick(
    e: React.MouseEvent,
    row: NotificationRow,
  ) {
    if (!row.read_at) {
      // Optimistic
      setItems((prev) =>
        prev
          ? prev.map((r) =>
              r.id === row.id
                ? { ...r, read_at: new Date().toISOString() }
                : r,
            )
          : prev,
      );
      setUnread((u) => Math.max(0, u - 1));
      // Fire-and-forget; the page navigate will revalidate.
      void markNotificationRead(row.id);
    }
    const href = notificationHref(row.payload);
    if (!href) {
      e.preventDefault();
      return;
    }
    // Allow normal Link navigation otherwise.
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          isHe ? `התראות (${unread} חדשות)` : `Notifications (${unread} unread)`
        }
        className="relative inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:bg-white/10"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 ? (
          <span
            className="absolute -end-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          dir={isHe ? "rtl" : "ltr"}
          role="menu"
          className={cn(
            "absolute z-50 mt-2 w-[360px] max-w-[92vw] rounded-xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur",
            isHe ? "start-0" : "end-0",
          )}
          style={isHe ? { left: 0, right: "auto" } : { right: 0, left: "auto" }}
        >
          <header className="flex items-center justify-between border-b border-white/10 p-3">
            <span className="text-sm font-semibold text-white">
              {isHe ? "התראות" : "Notifications"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] text-white/70 hover:text-white"
              onClick={() => void handleMarkAll()}
              disabled={unread === 0}
            >
              {isHe ? "סמנו את הכל כנקראו" : "Mark all as read"}
            </Button>
          </header>

          <div className="max-h-[440px] overflow-y-auto">
            {loading && items === null ? (
              <div className="flex items-center justify-center p-6">
                <Loader2 className="size-4 animate-spin text-white/50" />
              </div>
            ) : !items || items.length === 0 ? (
              <div className="p-6 text-center text-xs text-white/55">
                {isHe ? "אין התראות עדיין." : "No notifications yet."}
              </div>
            ) : (
              <ul>
                {items.map((row) => {
                  const desc = describeNotification(row.kind);
                  const tone = toneClasses(desc.tone);
                  const href = notificationHref(row.payload);
                  const preview = notificationPreview(row.payload);
                  const Icon = desc.icon;
                  const headline = isHe ? desc.headlineHe : desc.headlineEn;
                  const Body = (
                    <>
                      <span className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1 inline-block size-2 shrink-0 rounded-full",
                            row.read_at ? "bg-transparent" : tone.dot,
                          )}
                          aria-hidden
                        />
                        <Icon
                          className="mt-0.5 size-4 shrink-0 text-white/70"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-white">
                            {headline}
                          </span>
                          {preview ? (
                            <span className="mt-0.5 block truncate text-xs text-white/60">
                              {preview}
                            </span>
                          ) : null}
                          <time className="mt-1 block text-[10px] text-white/40">
                            {new Date(row.created_at).toLocaleString(
                              isHe ? "he-IL" : "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </time>
                        </span>
                      </span>
                    </>
                  );
                  const rowClass = cn(
                    "block w-full border-b border-white/5 p-3 text-start transition-colors hover:bg-white/5",
                    !row.read_at && "bg-white/[0.04]",
                  );
                  return (
                    <li key={row.id}>
                      {href ? (
                        <Link
                          href={href}
                          className={rowClass}
                          onClick={(e) => handleRowClick(e, row)}
                        >
                          {Body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className={rowClass}
                          onClick={(e) => void handleRowClick(e, row)}
                        >
                          {Body}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
