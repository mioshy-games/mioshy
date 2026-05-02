"use client";

import { useMemo, useState } from "react";
import { motion, Reorder } from "framer-motion";
import { GripVertical } from "lucide-react";

import { isValidOrder, type PriorityKey } from "@/lib/journey/priorities";
import type {
  AnswerValue,
  Locale,
  QuestionRanking,
  QuestionRankingCategory,
} from "@/lib/journey/types";
import { Button } from "@/components/ui/button";

interface Props {
  question: QuestionRanking;
  locale: Locale;
  onSubmit: (answer: AnswerValue) => Promise<void> | void;
  initial?: AnswerValue | null;
  busy?: boolean;
}

/**
 * Drag-and-drop ranker for the 5 relationship priority categories.
 *
 * Built on framer-motion's `Reorder.Group` / `Reorder.Item` — already in
 * the project, full touch support out of the box (Pointer Events under
 * the hood), works on iOS Safari without us writing any drag math.
 *
 * Submission shape: `{ kind: 'ranking', order: PriorityKey[] }`.
 * `order[0]` is highest priority. Server validator in
 * /api/journey/answer enforces it's a permutation of PRIORITY_KEYS.
 *
 * RTL: the `<section>` inherits `dir` from the parent (JourneyClient
 * sets it on the wrapper). Framer reorder is direction-agnostic — it
 * cares about Y position, not start/end inline axis.
 *
 * The drag handle (`<GripVertical>`) is always rendered at the inline-end
 * side of the card so RTL/LTR users both see the same visual hint.
 *
 * Accessibility note: drag handles are decorative; the whole card is the
 * draggable surface (Reorder.Item gives every item `tabIndex=0` + arrow-
 * key keyboard reorder by default). Screen readers announce the position
 * via `aria-roledescription="sortable"` on the group.
 */
export function PriorityRankingStep({
  question,
  locale,
  onSubmit,
  initial,
  busy = false,
}: Props) {
  const isHe = locale === "he";

  // Initial order: prior answer if valid, else the order declared in
  // the questionnaire (which is the spec's "default order, but user
  // must reorder"). The questionnaire's categories list is the only
  // fallback — there is no longer a hardcoded PRIORITY_KEYS array.
  const initialOrder = useMemo<PriorityKey[]>(() => {
    if (
      initial &&
      initial.kind === "ranking" &&
      isValidOrder(initial.order)
    ) {
      return initial.order;
    }
    const declared = question.categories.map((c) => c.key);
    if (isValidOrder(declared)) return declared;
    // Last-resort fallback: walk the declared categories in order even
    // if isValidOrder rejects (e.g. count mismatch). Cast is safe
    // because the questionnaire schema constrains `key` to PriorityKey.
    return declared as PriorityKey[];
  }, [initial, question.categories]);

  const [order, setOrder] = useState<PriorityKey[]>(initialOrder);

  // Build O(1) lookup tables from the question's own categories list.
  // The questionnaire JSON carries he/en/he_desc/en_desc per category,
  // so the assessment can render entirely from props without touching
  // the DB or any constant map.
  const labelByKey = useMemo(() => {
    const m = new Map<string, QuestionRankingCategory>();
    for (const c of question.categories) m.set(c.key, c);
    return m;
  }, [question.categories]);

  const labelFor = (key: PriorityKey): string => {
    const c = labelByKey.get(key);
    if (!c) return key;
    return isHe ? c.he : c.en;
  };
  const descFor = (key: PriorityKey): string => {
    const c = labelByKey.get(key);
    if (!c) return "";
    return isHe ? c.he_desc : c.en_desc;
  };

  const headline = isHe ? question.he_prompt : question.en_prompt;
  const subline = isHe ? question.he_subline : question.en_subline;
  const continueLabel = isHe ? "המשך" : "Continue";
  const dragHint = isHe ? "גררו לשינוי הסדר" : "Drag to reorder";

  const submit = async () => {
    if (!isValidOrder(order)) return; // shouldn't happen — defense in depth
    await onSubmit({ kind: "ranking", order });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
      // Internal direction for the heading; the page wrapper already sets
      // dir, but we re-assert here so this component stays drop-in if it
      // ever lives outside JourneyClient.
      dir={isHe ? "rtl" : "ltr"}
    >
      <header className="flex flex-col gap-1.5">
        <h2 className="text-xl font-bold leading-snug text-white sm:text-2xl">
          {headline}
        </h2>
        {subline ? (
          <p className="text-sm text-white/70">{subline}</p>
        ) : null}
      </header>

      <Reorder.Group
        axis="y"
        values={order}
        onReorder={(next) => {
          // framer hands back T[]; we trust isValidOrder downstream but
          // narrow with a runtime check here so a re-render with bad
          // state can't slip through.
          if (isValidOrder(next)) setOrder(next);
        }}
        as="ul"
        role="list"
        aria-roledescription="sortable list"
        className="flex flex-col gap-2.5"
      >
        {order.map((key, idx) => (
          <Reorder.Item
            key={key}
            value={key}
            // touch-action:none lets framer own the gesture so the page
            // doesn't try to scroll while the user drags.
            style={{ touchAction: "none" }}
            // whileDrag lifts the card visually so it's clear which one
            // the pointer "owns".
            whileDrag={{
              scale: 1.02,
              boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
              cursor: "grabbing",
              zIndex: 30,
            }}
            // layout=true → Reorder animates siblings as the dragged card
            // shifts into a new slot.
            layout
            className="select-none"
          >
            <div
              className={[
                "relative flex items-start gap-3 rounded-2xl border p-4 transition-colors",
                "border-white/10 bg-white/5 backdrop-blur-sm",
                idx === 0
                  ? // Position 1 — soft glow, slightly larger title
                    "ring-1 ring-fuchsia-300/40 bg-gradient-to-r from-fuchsia-500/15 via-rose-500/10 to-transparent"
                  : "",
                idx === order.length - 1
                  ? // Position 5 — dimmer to drive home "least"
                    "opacity-80"
                  : "",
              ].join(" ")}
            >
              {/* Position pill */}
              <div
                className={[
                  "shrink-0 inline-flex items-center justify-center rounded-full font-bold tabular-nums",
                  idx === 0
                    ? "size-9 bg-fuchsia-400 text-fuchsia-950 text-base"
                    : "size-8 bg-white/10 text-white text-sm",
                ].join(" ")}
                aria-label={
                  isHe ? `מקום ${idx + 1}` : `Position ${idx + 1}`
                }
              >
                {idx + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className={[
                    "font-semibold text-white",
                    idx === 0 ? "text-lg" : "text-base",
                  ].join(" ")}
                >
                  {labelFor(key)}
                </div>
                <p className="mt-0.5 text-xs leading-snug text-white/65">
                  {descFor(key)}
                </p>
              </div>

              {/* Drag handle — purely decorative; whole card is draggable */}
              <div
                className="shrink-0 self-center text-white/40"
                aria-hidden
              >
                <GripVertical className="size-5" />
              </div>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <p className="text-center text-xs text-white/55">{dragHint}</p>

      <div className="flex justify-center">
        <Button
          type="button"
          onClick={submit}
          disabled={busy}
          className="min-w-[180px]"
        >
          {continueLabel}
        </Button>
      </div>
    </motion.section>
  );
}
