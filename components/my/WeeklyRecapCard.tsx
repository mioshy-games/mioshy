/**
 * WeeklyRecapCard
 * ─────────────────────────────────────────────────────────
 * Layer-4 user-facing recap. Renders the most recent weekly recap
 * row for the user's couple. Auto-hides when no recap exists yet
 * (week 1 users) — never shows a placeholder.
 *
 * Visual: warm wine-on-dark card with a soft halo. Counts are
 * surfaced as small inline pills so the page doesn't get crowded.
 */

import { CalendarDays, Flame, MessageCircle, Heart, Sparkles } from "lucide-react";

interface NotableSignals {
  items_completed?:    number;
  responses_posted?:   number;
  reactions_received?: number;
  expert_replies?:     number;
  top_item_title?:     string | null;
}

interface Props {
  isHe:           boolean;
  weekStarting:   string;
  summaryHe:      string;
  summaryEn:      string;
  notableSignals: NotableSignals;
}

export function WeeklyRecapCard({
  isHe,
  weekStarting,
  summaryHe,
  summaryEn,
  notableSignals,
}: Props) {
  const dt = new Date(weekStarting);
  const weekLabel = dt.toLocaleDateString(isHe ? "he-IL" : "en-US", {
    month: "short",
    day:   "numeric",
  });

  const itemsCompleted    = notableSignals.items_completed    ?? 0;
  const responsesPosted   = notableSignals.responses_posted   ?? 0;
  const reactionsReceived = notableSignals.reactions_received ?? 0;
  const expertReplies     = notableSignals.expert_replies     ?? 0;

  const summary = isHe ? summaryHe : summaryEn;

  return (
    <article
      className="relative mt-4 overflow-hidden rounded-3xl border p-5 sm:p-6"
      style={{
        borderColor: "rgba(184,60,77,0.30)",
        background:
          "linear-gradient(135deg, rgba(184,60,77,0.14) 0%, rgba(108,46,64,0.06) 60%, rgba(255,255,255,0.02) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: "#B83C4D" }}
      />

      <div className="relative">
        <header className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#FAF6F7]"
            style={{
              background: "linear-gradient(135deg, #B83C4D 0%, #6C2E40 100%)",
            }}
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#FAF6F7]/75">
            {isHe ? `סיכום השבוע · ${weekLabel}` : `Week of ${weekLabel}`}
          </span>
        </header>

        <p className="mt-3 text-[16px] leading-[1.65] text-white/90">
          {summary}
        </p>

        {/* Inline signal pills — only show pills with non-zero counts
            so quiet weeks don't render a row of zeros. */}
        {itemsCompleted + responsesPosted + reactionsReceived + expertReplies > 0 ? (
          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-white/65">
            {itemsCompleted > 0 ? (
              <li className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-amber-300" />
                {isHe
                  ? `${itemsCompleted} ${itemsCompleted === 1 ? "פריט" : "פריטים"}`
                  : `${itemsCompleted} ${itemsCompleted === 1 ? "step" : "steps"}`}
              </li>
            ) : null}
            {responsesPosted > 0 ? (
              <li className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                {isHe
                  ? `${responsesPosted} ${responsesPosted === 1 ? "הרהור" : "הרהורים"}`
                  : `${responsesPosted} ${responsesPosted === 1 ? "reflection" : "reflections"}`}
              </li>
            ) : null}
            {expertReplies > 0 ? (
              <li className="inline-flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5 text-[#FAF6F7]" />
                {isHe
                  ? `${expertReplies} ${expertReplies === 1 ? "תגובה" : "תגובות"} מהמומחה`
                  : `${expertReplies} coach ${expertReplies === 1 ? "reply" : "replies"}`}
              </li>
            ) : null}
            {reactionsReceived > 0 ? (
              <li className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-rose-300" />
                {isHe
                  ? `${reactionsReceived} תגובות רגשיות`
                  : `${reactionsReceived} reactions`}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
