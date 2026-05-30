"use client";

/**
 * NotificationsList — client component for /my/notifications.
 *
 * Renders the user's notification inbox in a shell-tone scrollable
 * list:
 *   - Each row: tone-tinted icon, headline, payload preview, time-ago,
 *     and a soft "unread" dot when read_at is null.
 *   - Top action: "Mark all as read" — disabled when zero unread.
 *   - Clicking a row marks it read + deep-links via payload.href when
 *     present. Otherwise the row is purely informational (no nav).
 *
 * Reuses the existing JourneyNotificationsBell server actions:
 *   markAllUserNotificationsRead() / markNotificationRead(id)
 * — so the dual-write contract (notifications + activity log) stays
 * consistent across surfaces.
 *
 * Optimistic UI: state mutates locally on action invocation, then
 * `router.refresh()` pulls the canonical row. Errors surface as
 * toasts; rollback is implicit on the next refresh.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Loader2 } from "lucide-react";

import {
  markAllUserNotificationsRead,
  markNotificationRead,
} from "@/app/actions/journey-notifications";
import type { NotificationRow } from "@/lib/journey-content/notifications-read";
import {
  describeNotification,
  notificationHref,
  notificationPreview,
} from "@/lib/notifications/labels";

interface Props {
  initial: NotificationRow[];
  isHe: boolean;
  /** Localized strings — full set comes from appShell.notifications namespace. */
  labels: {
    markAllLabel:  string;
    markingLabel:  string;
    emptyTitle:    string;
    emptyBody:     string;
    nothingLeftLabel: string;
  };
}

function relativeStamp(iso: string, hebrew: boolean): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.round(ms / 60_000));
  if (hebrew) {
    if (m < 60) return `לפני ${m} ד׳`;
    const h = Math.round(m / 60);
    if (h < 24) return `לפני ${h} שעות`;
    const d = Math.round(h / 24);
    if (d < 7) return `לפני ${d} ימים`;
    return new Date(iso).toLocaleDateString("he-IL");
  }
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export function NotificationsList({ initial, isHe, labels }: Props) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initial);
  const [marking, setMarking] = React.useState(false);

  // Resync when server props refresh after revalidatePath.
  const lastSigRef = React.useRef(
    initial.map((r) => `${r.id}:${r.read_at ?? ""}`).join("|"),
  );
  React.useEffect(() => {
    const next = initial.map((r) => `${r.id}:${r.read_at ?? ""}`).join("|");
    if (next !== lastSigRef.current) {
      lastSigRef.current = next;
      setRows(initial);
    }
  }, [initial]);

  const unreadCount = rows.filter((r) => !r.read_at).length;

  async function handleMarkAll() {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    // Optimistic.
    const stampedAt = new Date().toISOString();
    setRows((prev) =>
      prev.map((r) => (r.read_at ? r : { ...r, read_at: stampedAt })),
    );
    try {
      const res = await markAllUserNotificationsRead();
      if (!res.ok) {
        toast.error(
          isHe ? "סימון הקריאה נכשל" : "Failed to mark all as read",
        );
      }
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  async function handleRowClick(e: React.MouseEvent, row: NotificationRow) {
    // Optimistic — flip read_at locally even if there's no href.
    if (!row.read_at) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, read_at: new Date().toISOString() } : r,
        ),
      );
      void markNotificationRead(row.id);
    }
    const href = notificationHref(row.payload);
    if (href) {
      // Let the parent <a> navigate naturally — Link will handle it
      // because we wrapped the row in a Next Link below. router.refresh
      // happens on the destination side.
      return;
    }
    // No href — informational only. Cancel default just in case it
    // was triggered from a real anchor click in the future.
    e.preventDefault();
  }

  if (rows.length === 0) {
    return (
      <div
        className="rounded-2xl border p-6 text-center"
        style={{
          background: "var(--shell-card)",
          borderColor: "var(--shell-line-soft)",
        }}
      >
        <div
          className="mb-1 text-[20px] font-extrabold"
          style={{ color: "var(--shell-text-1)" }}
        >
          {labels.emptyTitle}
        </div>
        <div
          className="text-[16px] leading-relaxed"
          style={{ color: "var(--shell-text-2)" }}
        >
          {labels.emptyBody}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mark-all bar */}
      <div className="flex items-center justify-between">
        <span
          className="text-[14px]"
          style={{ color: "var(--shell-text-3)" }}
        >
          {unreadCount > 0
            ? isHe
              ? `${unreadCount} חדשות`
              : `${unreadCount} new`
            : labels.nothingLeftLabel}
        </span>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={marking || unreadCount === 0}
          className="inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[14px] font-bold transition disabled:opacity-50"
          style={{
            color: "var(--shell-pink-text)",
            background: "transparent",
            borderColor: "rgba(242,181,189,0.18)",
          }}
        >
          {marking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCheck className="h-3.5 w-3.5" />
          )}
          <span>{marking ? labels.markingLabel : labels.markAllLabel}</span>
        </button>
      </div>

      {/* List */}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row) => (
          <NotificationRowView
            key={row.id}
            row={row}
            isHe={isHe}
            onClick={(e) => handleRowClick(e, row)}
          />
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

interface RowProps {
  row: NotificationRow;
  isHe: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function NotificationRowView({ row, isHe, onClick }: RowProps) {
  const descriptor = describeNotification(row.kind);
  const headline = isHe ? descriptor.headlineHe : descriptor.headlineEn;
  const preview = notificationPreview(row.payload);
  const href = notificationHref(row.payload);
  const stamp = relativeStamp(row.created_at, isHe);
  const unread = !row.read_at;
  const Icon = descriptor.icon;

  const innerClass =
    "flex items-start gap-3 rounded-[14px] border p-4 transition hover:brightness-110";
  const innerStyle: React.CSSProperties = {
    background: unread
      ? "linear-gradient(120deg, rgba(236,72,153,0.10) 0%, var(--shell-card) 100%)"
      : "var(--shell-card)",
    borderColor: unread
      ? "rgba(236,72,153,0.30)"
      : "var(--shell-line-soft)",
  };

  const inner = (
    <>
      {/* tone icon */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]"
        style={{
          background: unread
            ? "var(--shell-wine-soft)"
            : "rgba(255,255,255,0.05)",
          color: unread
            ? "var(--shell-pink-text)"
            : "var(--shell-text-2)",
        }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="truncate text-[16px] font-bold"
            style={{ color: "var(--shell-text-1)" }}
          >
            {headline}
          </span>
          <span
            className="shrink-0 text-[13px]"
            style={{ color: "var(--shell-text-3)" }}
          >
            {stamp}
          </span>
        </div>
        {preview ? (
          <p
            className="line-clamp-2 mt-1 text-[16px] leading-[1.45]"
            style={{ color: "var(--shell-text-2)" }}
          >
            {preview}
          </p>
        ) : null}
      </div>
      {unread ? (
        <span
          aria-label={isHe ? "לא נקרא" : "Unread"}
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: "var(--shell-wine)" }}
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <li>
        <a
          href={href}
          onClick={onClick}
          className={innerClass}
          style={innerStyle}
        >
          {inner}
        </a>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`${innerClass} w-full text-start`}
        style={innerStyle}
      >
        {inner}
      </button>
    </li>
  );
}
