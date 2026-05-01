/**
 * JourneyActivityHistory — vertical timeline of everything the user
 * has done so far on the Journey, plus what experts have done back.
 *
 * Phase 4 — UI-only. We render whatever we already have on the page
 * (no new server fetch). Activity types shown:
 *
 *   - assessment_completed    → "השלמתם את האבחון"
 *   - item_completed          → "סיימתם פריט: ..."
 *   - response_submitted      → "השארתם תגובה ב-..."
 *   - clinician_replied       → "המומחה השיב לכם ב-..."
 *   - item_unlocked           → "תוכן חדש נפתח: ..."
 *
 * The list is reverse-chronological (newest first). Empty state:
 * a calm "ההיסטוריה שלכם תופיע כאן" caption.
 */

import {
  CheckCircle2,
  MessageCircle,
  Reply,
  Sparkles,
  Star,
} from "lucide-react";

export type ActivityKind =
  | "assessment_completed"
  | "item_completed"
  | "response_submitted"
  | "clinician_replied"
  | "item_unlocked";

export interface JourneyActivityEntry {
  id: string;
  kind: ActivityKind;
  /** Localized title — caller computes. */
  title: string;
  /** Optional sub-line: category, item title etc. */
  detail?: string | null;
  whenIso: string;
}

export function JourneyActivityHistory({
  isHe,
  entries,
}: {
  isHe: boolean;
  entries: JourneyActivityEntry[];
}) {
  const sorted = [...entries].sort((a, b) =>
    (b.whenIso ?? "").localeCompare(a.whenIso ?? ""),
  );

  return (
    <section className="rounded-2xl border border-slate-300/[0.08] bg-slate-950/40 p-5 backdrop-blur-md">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/85">
          {isHe ? "היסטוריית פעולות" : "Activity history"}
        </h2>
        <span className="text-[11px] text-white/45">
          {sorted.length} {isHe ? "פעולות" : "events"}
        </span>
      </header>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] p-4 text-center text-sm text-white/55">
          {isHe
            ? "ההיסטוריה שלכם תופיע כאן ברגע שתתחילו."
            : "Your history will appear here once you begin."}
        </p>
      ) : (
        <ol className="relative flex flex-col gap-3">
          {/* Vertical line — purely decorative */}
          <span
            aria-hidden="true"
            className="absolute bottom-2 top-2 w-px bg-white/[0.06]"
            style={{ insetInlineStart: isHe ? undefined : "13px", insetInlineEnd: isHe ? "13px" : undefined }}
          />
          {sorted.map((entry) => (
            <li key={entry.id}>
              <ActivityRow entry={entry} isHe={isHe} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

const KIND_META: Record<
  ActivityKind,
  { Icon: typeof Star; tint: string; ringTint: string }
> = {
  assessment_completed: {
    Icon: Star,
    tint: "text-amber-200",
    ringTint: "border-amber-300/30 bg-amber-500/10",
  },
  item_completed: {
    Icon: CheckCircle2,
    tint: "text-emerald-200",
    ringTint: "border-emerald-400/30 bg-emerald-500/10",
  },
  response_submitted: {
    Icon: MessageCircle,
    tint: "text-white/80",
    ringTint: "border-white/15 bg-white/[0.04]",
  },
  clinician_replied: {
    Icon: Reply,
    tint: "text-emerald-200",
    ringTint: "border-emerald-400/30 bg-emerald-500/10",
  },
  item_unlocked: {
    Icon: Sparkles,
    tint: "text-white/80",
    ringTint: "border-white/15 bg-white/[0.04]",
  },
};

function ActivityRow({
  entry,
  isHe,
}: {
  entry: JourneyActivityEntry;
  isHe: boolean;
}) {
  const meta = KIND_META[entry.kind];
  const { Icon } = meta;
  return (
    <div className="relative flex items-start gap-3 ps-1">
      <span
        className={[
          "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border",
          meta.ringTint,
        ].join(" ")}
      >
        <Icon className={["size-3.5", meta.tint].join(" ")} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1 pb-1">
        <p className="text-sm font-medium text-white">{entry.title}</p>
        {entry.detail ? (
          <p className="mt-0.5 truncate text-[12px] text-white/55">
            {entry.detail}
          </p>
        ) : null}
        <time
          className="mt-0.5 block text-[11px] text-white/40"
          dateTime={entry.whenIso}
          title={new Date(entry.whenIso).toLocaleString(isHe ? "he-IL" : "en-US")}
        >
          {formatRelative(entry.whenIso, isHe)}
        </time>
      </div>
    </div>
  );
}

function formatRelative(iso: string, isHe: boolean): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "";
  const diffMs = Date.now() - ts;
  const m = Math.round(diffMs / 60000);
  if (m < 1) return isHe ? "כעת" : "now";
  if (m < 60) return isHe ? `לפני ${m} דק'` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return isHe ? `לפני ${h} שעות` : `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return isHe ? `לפני ${d} ימים` : `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return isHe ? `לפני ${w} שבועות` : `${w}w ago`;
  return isHe ? "לפני יותר מחודש" : "over a month ago";
}
