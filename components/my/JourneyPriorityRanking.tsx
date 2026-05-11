"use client";

/**
 * JourneyPriorityRanking - the central piece of /my/journey: a
 * reorderable list of the user's relationship priorities, plus a
 * way to add a custom priority that didn't exist in the assessment.
 *
 * Phase 4 - UI scaffolding only. State lives in component state;
 * persistence (server action + DB row) is a follow-up.
 *
 * Tone: clinical. The user reorders to tell the clinician
 * "this is what I need first". No drag library - we use ↑↓ buttons
 * for cross-browser reliability and accessibility.
 */

import { useState } from "react";
import { ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { track } from "@/lib/analytics";

export interface PriorityItem {
  id: string;
  /** Localized label. */
  label: string;
  /** Optional one-liner about what this priority means for the user. */
  note?: string | null;
  /** True for items the user added manually (vs. seeded from
   *  the assessment). Custom items show a subtle "מותאם" pill so
   *  the clinician knows. */
  isCustom?: boolean;
}

export function JourneyPriorityRanking({
  isHe,
  initialItems,
}: {
  isHe: boolean;
  initialItems: PriorityItem[];
}) {
  const [items, setItems] = useState<PriorityItem[]>(initialItems);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
    track("journey_priority_reordered", {
      from: idx,
      to: target,
      direction: dir === -1 ? "up" : "down",
      item_id: items[idx]?.id ?? null,
      total: items.length,
    });
  };

  const remove = (idx: number) => {
    const removed = items[idx];
    setItems(items.filter((_, i) => i !== idx));
    track("journey_priority_removed", {
      item_id: removed?.id ?? null,
      is_custom: removed?.isCustom ?? false,
    });
  };

  const addCustom = () => {
    const label = draftLabel.trim();
    if (!label) return;
    const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setItems([
      ...items,
      {
        id: newId,
        label,
        isCustom: true,
      },
    ]);
    setDraftLabel("");
    setAdding(false);
    track("journey_priority_added", {
      item_id: newId,
      label_length: label.length,
      total: items.length + 1,
    });
  };

  return (
    <section className="rounded-2xl border border-slate-300/[0.08] bg-slate-950/40 p-5 backdrop-blur-md">
      <header className="mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-white/85">
          {isHe
            ? "מה הכי חשוב לכם לטפל בו עכשיו?"
            : "What's most important to address first?"}
        </h2>
        <p className="mt-1 text-[12px] text-white/55">
          {isHe
            ? "סדרו את הנושאים לפי חשיבות. הראשון = הכי דחוף. ניתן להוסיף נושא משלכם שלא מופיע ברשימה."
            : "Order topics by priority. Top = most urgent. You can add a topic of your own that isn't on the list."}
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {items.map((item, idx) => (
          <li key={item.id}>
            <PriorityRow
              item={item}
              idx={idx}
              total={items.length}
              isHe={isHe}
              onMoveUp={() => move(idx, -1)}
              onMoveDown={() => move(idx, 1)}
              onRemove={() => remove(idx)}
            />
          </li>
        ))}
      </ol>

      {/* Add custom */}
      <div className="mt-3 border-t border-white/[0.05] pt-3">
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/70 hover:border-white/30 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            {isHe ? "הוסיפו נושא משלכם" : "Add a topic of your own"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
                if (e.key === "Escape") {
                  setDraftLabel("");
                  setAdding(false);
                }
              }}
              autoFocus
              maxLength={120}
              placeholder={isHe ? "...לדוגמה: ניהול זמן ביחד" : "e.g. shared time management"}
              className="flex-1 rounded-md border border-white/10 bg-slate-950/60 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!draftLabel.trim()}
              className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40"
            >
              {isHe ? "להוסיף" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftLabel("");
                setAdding(false);
              }}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-white/65 hover:border-white/25 hover:text-white"
            >
              {isHe ? "ביטול" : "Cancel"}
            </button>
          </div>
        )}
      </div>

      {/* Footer hint - honest about scope. Persistence is Phase 5; for
          now the order lives in the session and the clinician acts on
          what's discussed in the message channel + assessments. */}
      <p className="mt-3 text-[11px] italic text-white/40">
        {isHe
          ? "סדרו לפי החשיבות עבורכם. השמירה האוטומטית תיכנס לשימוש בעדכון הקרוב."
          : "Order by importance to you. Automatic saving will land in the next update."}
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function PriorityRow({
  item,
  idx,
  total,
  isHe,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: PriorityItem;
  idx: number;
  total: number;
  isHe: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/15 hover:bg-white/[0.04]">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-[11px] tabular-nums text-white/65">
        {idx + 1}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {item.label}
          {item.isCustom ? (
            <span className="ms-2 inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
              {isHe ? "מותאם" : "Custom"}
            </span>
          ) : null}
        </p>
        {item.note ? (
          <p className="mt-0.5 truncate text-[11px] text-white/45">
            {item.note}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={idx === 0}
          aria-label={isHe ? "העלה למעלה" : "Move up"}
          className="rounded border border-white/10 p-1 text-white/65 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={idx === total - 1}
          aria-label={isHe ? "הורד למטה" : "Move down"}
          className="rounded border border-white/10 p-1 text-white/65 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronDown className="size-3.5" />
        </button>
        {item.isCustom ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={isHe ? "מחק" : "Remove"}
            className="rounded border border-white/10 p-1 text-white/65 hover:border-rose-400/40 hover:text-rose-200"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
