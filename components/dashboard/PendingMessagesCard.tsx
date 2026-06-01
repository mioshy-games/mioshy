/**
 * PendingMessagesCard — the "needs reply" inbox at the top of /dashboard.
 *
 * Server component. Receives a pre-resolved list from
 * `getPendingExpertMessages()` so the page is free to do its other
 * fetches in parallel. Renders an empty state when the list is empty,
 * and clips long previews so the card stays compact even for chatty
 * users.
 *
 * Each row deep-links to `/dashboard/my-clients/[coupleId]#general`
 * — that's where the existing `GeneralChannelAdminReply` component
 * lives. Solo users (no couple yet) fall back to a generic
 * `/dashboard/journey/expert-messages?user=<uid>` filter.
 *
 * Added 2026-06-01 (Itzik: "smart UX for experts handling messages").
 */

import Link from "next/link";
import { ArrowLeft, Inbox, MessagesSquare } from "lucide-react";
import type { PendingMessageRow } from "@/lib/journey/pending-messages";

interface Props {
  rows: PendingMessageRow[];
  /** Total pending count (separate from rows.length when the list was
   *  capped). Drives the "X more waiting" footer link. */
  totalCount: number;
  /** When true the fetch failed — render a soft "service is degraded" hint
   *  instead of an empty state. */
  degraded?: boolean;
}

const PREVIEW_CHARS = 140;

function clip(body: string): string {
  const trimmed = body.replace(/\s+/g, " ").trim();
  if (trimmed.length <= PREVIEW_CHARS) return trimmed;
  return trimmed.slice(0, PREVIEW_CHARS) + "…";
}

/**
 * Relative time stamp. Mirrors the format used elsewhere on the admin
 * dashboard so this widget feels native.
 */
function relativeStamp(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const minutes = Math.max(1, Math.round((now - t) / 60_000));
  if (minutes < 60) return `לפני ${minutes} ד׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שעות`;
  const days = Math.round(hours / 24);
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}

function deepLinkFor(row: PendingMessageRow): string {
  // Couple workspace is where the reply UI already lives. The
  // `#general` anchor scrolls to the GeneralChannelAdminReply section
  // (added in the next step — for now the page just opens at the top
  // and the section is below the fold). Solo users fall back to the
  // existing expert-messages filter view.
  if (row.coupleId) {
    return `/dashboard/my-clients/${row.coupleId}#general`;
  }
  return `/dashboard/journey/expert-messages?user=${row.userId}`;
}

export function PendingMessagesCard({ rows, totalCount, degraded }: Props) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-rose-300" />
          <h2 className="m-0 text-lg font-bold text-white">
            הודעות שמחכות לתגובה
          </h2>
          {totalCount > 0 ? (
            <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full bg-rose-500/90 px-2 text-[12px] font-extrabold text-white">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          ) : null}
        </div>
        <Link
          href="/dashboard/journey/expert-messages"
          className="text-[13px] font-semibold text-white/70 transition hover:text-white"
        >
          לכל ההודעות →
        </Link>
      </div>

      {degraded ? (
        <p className="m-0 text-[14px] text-white/60">
          התצוגה זמנית לא זמינה — תרענן בעוד כמה שניות.
        </p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <MessagesSquare className="h-8 w-8 text-white/30" />
          <p className="m-0 text-[15px] font-semibold text-white/80">
            אין הודעות שמחכות
          </p>
          <p className="m-0 text-[13px] text-white/55">
            כל מה ששלחו לכם הסיק כבר תגובה. בהצלחה!
          </p>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((row) => (
            <li key={row.userId}>
              <Link
                href={deepLinkFor(row)}
                className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] p-4 transition hover:border-rose-300/40 hover:bg-white/[0.07]"
              >
                {/* Avatar — initial inside a wine pill so the row has a
                    visual anchor without needing an image. */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
                  }}
                  aria-hidden
                >
                  {row.displayName.trim().charAt(0).toUpperCase() || "?"}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-bold text-white">
                      {row.displayName}
                    </span>
                    <span className="shrink-0 text-[12px] text-white/55">
                      {relativeStamp(row.lastUserMessageAt)}
                    </span>
                  </div>
                  <p className="m-0 line-clamp-2 text-[14px] leading-snug text-white/75">
                    {clip(row.lastBody) || (
                      <span className="italic text-white/50">
                        (הודעה ריקה — בדוק את התוכן)
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-white/55">
                    {row.email ? <span dir="ltr">{row.email}</span> : null}
                    {row.totalUserMessages > 1 ? (
                      <span className="rounded-full border border-white/10 px-2 py-0.5">
                        {row.totalUserMessages} הודעות בשיחה
                      </span>
                    ) : null}
                  </div>
                </div>

                <ArrowLeft className="mt-1 h-4 w-4 shrink-0 text-white/40 transition group-hover:text-rose-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalCount > rows.length ? (
        <Link
          href="/dashboard/journey/expert-messages"
          className="mt-4 block text-center text-[13px] font-semibold text-rose-300 transition hover:text-rose-200"
        >
          +{totalCount - rows.length} עוד הודעות ברשימה המלאה
        </Link>
      ) : null}
    </section>
  );
}
