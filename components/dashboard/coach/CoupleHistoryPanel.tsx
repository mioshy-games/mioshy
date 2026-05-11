"use client";

/**
 * CoupleHistoryPanel
 *
 * Phase 13 — collapsible by-day timeline of everything that happened
 * with the couple. Coach opens the per-couple page → expands the
 * panel → sees a full chronology grouped by day with kind-colored
 * dots. Helps recall context fast.
 *
 * Server component would have been simpler but we want collapse
 * controls per-day → client.
 */

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  CheckCircle2,
  Send,
  Users,
} from "lucide-react";

import type {
  HistoryByDay,
  HistoryEventKind,
} from "@/lib/journey/couple-history";

const KIND_ICON: Record<HistoryEventKind, React.ReactNode> = {
  user_message:     <MessageSquare className="size-3 text-blue-400" />,
  coach_message:    <MessageSquare className="size-3 text-emerald-400" />,
  couple_message:   <Users className="size-3 text-blue-300" />,
  couple_coach_msg: <Users className="size-3 text-emerald-300" />,
  item_pushed:      <Send className="size-3 text-amber-300" />,
  item_completed:   <CheckCircle2 className="size-3 text-emerald-500" />,
};

const KIND_LABEL_HE: Record<HistoryEventKind, string> = {
  user_message:     "המשתמש",
  coach_message:    "מאמן",
  couple_message:   "פרטנר בערוץ הזוגי",
  couple_coach_msg: "מאמן בערוץ הזוגי",
  item_pushed:      "הצמדה",
  item_completed:   "השלמה",
};

function formatDay(iso: string): string {
  // iso = YYYY-MM-DD. Show as "DD/MM/YYYY · יום X" in Israel locale.
  const d = new Date(`${iso}T00:00:00+02:00`);
  return d.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CoupleHistoryPanel({
  history,
}: {
  history: HistoryByDay[];
}) {
  // Open the most recent day by default; the rest collapsed.
  const [openDays, setOpenDays] = useState<Set<string>>(
    new Set(history.length > 0 ? [history[0].date] : []),
  );

  const toggle = (date: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  if (history.length === 0) {
    return (
      <section className="bg-card rounded-lg border p-4 text-sm" dir="rtl">
        <div className="text-muted-foreground text-center">
          אין היסטוריה ב-60 הימים האחרונים.
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card rounded-lg border" dir="rtl">
      <header className="border-b p-3">
        <h2 className="text-sm font-semibold">היסטוריה מלאה</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          כל אירוע (הודעות, השלמות, הצמדות) של הזוג. ימים מקופלים פתחו
          לחיצה.
        </p>
      </header>
      <div className="divide-border divide-y">
        {history.map((day) => {
          const isOpen = openDays.has(day.date);
          return (
            <div key={day.date}>
              <button
                type="button"
                onClick={() => toggle(day.date)}
                className="hover:bg-muted/40 flex w-full items-center justify-between gap-2 p-3 text-sm transition"
              >
                <span className="font-semibold">{formatDay(day.date)}</span>
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <span>
                    {day.events.length} {day.events.length === 1 ? "אירוע" : "אירועים"}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </span>
              </button>
              {isOpen ? (
                <ul className="bg-muted/20 divide-border divide-y">
                  {day.events.map((e) => (
                    <li key={e.id} className="flex gap-2 p-3 text-sm">
                      <div className="mt-1 flex flex-col items-center gap-1">
                        {KIND_ICON[e.kind]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2 text-[11px]">
                          <span className="text-muted-foreground tabular-nums">
                            {formatTime(e.at)}
                          </span>
                          <span className="text-muted-foreground font-bold uppercase tracking-wider">
                            {KIND_LABEL_HE[e.kind]}
                          </span>
                          {e.meta ? (
                            <span className="text-muted-foreground">
                              · {e.meta}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-foreground/85 mt-0.5 leading-snug">
                          {e.preview}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
