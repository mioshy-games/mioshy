import Link from "next/link";
import type { ConsoleFeedItem } from "@/lib/journey/console-feed";

/** Compact, dependency-free relative time ("לפני 5 ד׳", "אתמול"). */
function relativeHe(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "עכשיו";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `לפני ${min} ד׳`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `לפני ${hr} ש׳`;
  const days = Math.round(hr / 24);
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}

const URGENCY_CHIP: Record<string, string> = {
  high: "bg-rose-500/15 text-rose-200 border-rose-400/25",
  medium: "bg-amber-500/15 text-amber-100 border-amber-400/25",
  low: "bg-sky-500/15 text-sky-100 border-sky-400/25",
  info: "bg-white/[0.06] text-white/60 border-white/15",
};

export function ConsoleFeedRow({
  item,
  selected,
}: {
  item: ConsoleFeedItem;
  selected: boolean;
}) {
  const href =
    item.kind === "couple"
      ? `/dashboard/console?couple=${item.coupleId}`
      : `/dashboard/console?user=${item.userId}`;

  const chipClass = item.workflow
    ? URGENCY_CHIP[item.workflow.urgency] ?? URGENCY_CHIP.info
    : URGENCY_CHIP.info;
  const chipLabel = item.workflow ? item.workflow.label_he : "—";

  return (
    <Link
      href={href}
      dir="rtl"
      className={`block border-b border-white/[0.06] px-3 py-3 transition hover:bg-white/[0.04] ${
        selected ? "bg-white/[0.07]" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-white">
          {item.label}
        </span>
        <span className="shrink-0 text-[11px] text-white/40">
          {relativeHe(item.lastMessageAt)}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs text-white/55">
          {item.lastBody?.slice(0, 80) ||
            (item.kind === "solo" ? "משתמש ללא זוג" : "אין הודעות אחרונות")}
        </span>
        {item.needsReplyCount > 0 ? (
          <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
            {item.needsReplyCount}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={`inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[10px] ${chipClass}`}
          title={item.workflow?.next_action_he ?? undefined}
        >
          {chipLabel}
        </span>
        {item.subtitle ? (
          <span className="truncate text-[10px] text-white/35">
            {item.subtitle}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
