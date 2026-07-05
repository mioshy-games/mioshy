/**
 * /dashboard/journey/replies
 *
 * 2026-06-02 (Itzik) — full table of pending user replies across both
 * surfaces (general channel + per-item threads). Replaces the partial
 * coverage from the existing `/dashboard/journey/expert-messages` page,
 * which only shows expert-authored messages.
 *
 * Each row represents ONE user with at least one unanswered message.
 * Click → /dashboard/console (?couple=<id> | ?user=<id>) — the coach chat
 * console is the single place the expert reads and replies.
 *
 * Sorted OLDEST-first — the longest-waiting user floats to the top (Itzik
 * 2026-07-05). The wait is shown as a numeric duration with an SLA color:
 * amber over 12h, red over 24h. No filters yet — the volume here is bounded by
 * "users with at least one pending reply" which stays small in practice.
 */

import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { getPendingExpertMessages } from "@/lib/journey/pending-messages";
import type { PendingMessageRow } from "@/lib/journey/pending-messages";

export const dynamic = "force-dynamic";

/** Numeric wait duration + SLA color (amber > 12h, red > 24h). */
function waitBadge(iso: string): { label: string; cls: string } {
  if (!iso) return { label: "—", cls: "bg-white/[0.04] text-white/65 border-white/15" };
  const hours = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  const label =
    hours >= 24 ? `${Math.floor(hours / 24)} ימים` : hours >= 1 ? `${hours} שעות` : "פחות משעה";
  const cls =
    hours >= 24
      ? "bg-red-500/15 text-red-200 border-red-400/40"
      : hours >= 12
        ? "bg-amber-400/15 text-amber-100 border-amber-300/40"
        : "bg-white/[0.04] text-white/65 border-white/15";
  return { label, cls };
}

function clip(body: string, n = 180): string {
  const trimmed = body.replace(/\s+/g, " ").trim();
  if (trimmed.length <= n) return trimmed;
  return trimmed.slice(0, n) + "…";
}

function deepLinkFor(row: PendingMessageRow): string {
  // Every reply opens the coach chat console focused on the conversation:
  // couples by coupleId, solo users by userId. The console is the single
  // place the expert reads and replies (no more my-clients / expert-messages).
  return row.coupleId
    ? `/dashboard/console?couple=${row.coupleId}`
    : `/dashboard/console?user=${row.userId}`;
}

export default async function RepliesPage() {
  await requireAdmin();
  const { rows: rawRows, count, ok } = await getPendingExpertMessages({ limit: 50 });
  // Oldest-first: the longest-waiting user floats to the top.
  const rows = [...rawRows].sort((a, b) =>
    (a.lastUserMessageAt || "").localeCompare(b.lastUserMessageAt || ""),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
          חזרה
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Inbox className="size-6 text-rose-300" />
          <h1 className="text-3xl font-bold tracking-tight">
            תגובות שמחכות למענה
          </h1>
          {count > 0 ? (
            <span className="inline-flex h-7 min-w-[34px] items-center justify-center rounded-full bg-rose-500/90 px-2.5 text-[13px] font-extrabold text-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[14px] text-muted-foreground">
          כל המשתמשים עם לפחות הודעה אחת שעדיין לא נענתה - כולל שאלות על
          פרקים ספציפיים וגם הודעות בצ׳אט הכללי.
        </p>
      </div>

      {!ok ? (
        <p className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-[14px] text-amber-100">
          שליפת הנתונים נכשלה זמנית - תרענן בעוד כמה שניות.
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] py-16 text-center">
          <Inbox className="mx-auto mb-3 size-10 text-white/30" />
          <p className="text-[16px] font-semibold text-white/85">
            אין תגובות שמחכות
          </p>
          <p className="mt-1 text-[13px] text-white/55">
            כל מה ששלחו כבר נענה. נקי!
          </p>
        </div>
      ) : (
        <RepliesTable rows={rows} />
      )}
    </div>
  );
}

function RepliesTable({ rows }: { rows: PendingMessageRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03] text-[12px] uppercase tracking-wider text-white/55">
            <th className="px-4 py-3 text-start">משתמש</th>
            <th className="px-4 py-3 text-start">הודעה אחרונה</th>
            <th className="px-4 py-3 text-start">מקור</th>
            <th className="px-4 py-3 text-start">סטטיסטיקות</th>
            <th className="px-4 py-3 text-start">ממתין</th>
            <th className="px-4 py-3 text-start" aria-label="פתיחה" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.userId}
              className="group border-b border-white/[0.06] transition hover:bg-white/[0.04]"
            >
              {/* User column — name + email */}
              <td className="px-4 py-4 align-top">
                <Link
                  href={deepLinkFor(row)}
                  className="flex items-start gap-3"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
                    }}
                    aria-hidden
                  >
                    {row.displayName.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-white group-hover:text-rose-200">
                      {row.displayName}
                    </span>
                    {row.email ? (
                      <span
                        dir="ltr"
                        className="block truncate text-[12px] text-white/55"
                      >
                        {row.email}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </td>

              {/* Message preview */}
              <td className="px-4 py-4 align-top">
                <p className="m-0 line-clamp-3 max-w-[420px] text-[13.5px] leading-snug text-white/75">
                  {clip(row.lastBody) || (
                    <span className="italic text-white/45">
                      (הודעה ריקה)
                    </span>
                  )}
                </p>
              </td>

              {/* Surface tag */}
              <td className="px-4 py-4 align-top">
                {row.lastContext === "per_item" ? (
                  <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-1 text-[12px] font-semibold text-amber-100">
                    על פרק
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[12px] font-semibold text-white/75">
                    צ׳אט כללי
                  </span>
                )}
              </td>

              {/* Stats */}
              <td className="px-4 py-4 align-top text-[12px] text-white/65">
                <div className="space-y-1">
                  {row.pendingPerItemThreads > 0 ? (
                    <div>
                      {row.pendingPerItemThreads} שאלות על פרקים
                    </div>
                  ) : null}
                  {row.pendingGeneralChannel ? (
                    <div>צ׳אט כללי פתוח</div>
                  ) : null}
                  <div className="text-white/45">
                    {row.totalUserMessages} סה״כ
                  </div>
                </div>
              </td>

              {/* Wait duration + SLA color */}
              <td className="whitespace-nowrap px-4 py-4 align-top">
                {(() => {
                  const w = waitBadge(row.lastUserMessageAt);
                  return (
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold ${w.cls}`}>
                      {w.label}
                    </span>
                  );
                })()}
              </td>

              {/* Chevron */}
              <td className="px-4 py-4 align-top">
                <Link
                  href={deepLinkFor(row)}
                  className="inline-flex items-center text-white/40 transition group-hover:text-rose-300"
                  aria-label={`פתיחת שיחה עם ${row.displayName}`}
                >
                  <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
