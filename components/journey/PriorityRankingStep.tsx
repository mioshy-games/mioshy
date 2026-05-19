"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

import { isValidOrder, type PriorityKey } from "@/lib/journey/priorities";
import type {
  AnswerValue,
  Locale,
  QuestionRanking,
  QuestionRankingCategory,
} from "@/lib/journey/types";
import { Button } from "@/components/ui/button";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface Props {
  question: QuestionRanking;
  locale: Locale;
  onSubmit: (answer: AnswerValue) => Promise<void> | void;
  initial?: AnswerValue | null;
  busy?: boolean;
}

/**
 * Reorder the 5 relationship priority categories using ↑/↓ arrow buttons
 * on each row.
 *
 * Why arrows instead of drag (UX feedback 2026-05-05): the previous
 * framer-motion `Reorder.Group` implementation set `touch-action: none`
 * on every row so the page wouldn't try to scroll while the user was
 * dragging. The side effect was that the page couldn't scroll AT ALL
 * while a finger was on a card - and on phones the cards take up the
 * full visible area, so the user got stuck unable to scroll down to the
 * Continue button. Replacing drag with explicit arrow buttons fixes the
 * scroll lock and is also a more discoverable interaction for a
 * non-developer audience.
 *
 * Submission shape stays: `{ kind: 'ranking', order: PriorityKey[] }`.
 * Server validator on /api/journey/answer enforces it's a permutation of
 * PRIORITY_KEYS - unchanged.
 *
 * Animation: framer-motion `<motion.li layout>` animates the position
 * swap so the user sees the cards trade places instead of teleporting.
 *
 * Accessibility:
 *  - Each ↑/↓ button has an aria-label with the category and direction.
 *  - The buttons are real <button> elements, so keyboard users get
 *    Enter/Space activation for free.
 *  - Disabled at the boundaries (↑ on idx 0, ↓ on idx N-1).
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
  // the questionnaire.
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
    return declared as PriorityKey[];
  }, [initial, question.categories]);

  const [order, setOrder] = useState<PriorityKey[]>(initialOrder);

  // O(1) lookup tables for category labels/descriptions.
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

  // Swap helpers - splice immutably so React re-renders cleanly.
  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const next = [...order];
    [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
    if (isValidOrder(next)) setOrder(next);
  };
  const moveDown = (idx: number) => {
    if (idx >= order.length - 1) return;
    const next = [...order];
    [next[idx + 1], next[idx]] = [next[idx]!, next[idx + 1]!];
    if (isValidOrder(next)) setOrder(next);
  };

  const headline = isHe ? question.he_prompt : question.en_prompt;
  const subline = isHe ? question.he_subline : question.en_subline;

  // Aria-label templates with {label}/{n} placeholders — interpolated per row.
  const moveUpTpl = useCmsText("journeyAssessment.priorityRanking.moveUp").text;
  const moveDownTpl = useCmsText("journeyAssessment.priorityRanking.moveDown").text;
  const positionTpl = useCmsText("journeyAssessment.priorityRanking.position").text;

  const submit = async () => {
    if (!isValidOrder(order)) return;
    await onSubmit({ kind: "ranking", order });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
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

      {/* Arrows hint — moved here ABOVE the list 2026-05-19 per Itzik.
          The instruction "use the arrows to change order" wasn't being
          read because it sat at the bottom of the list, AFTER the user
          had already tried (and possibly failed) to figure out the
          interaction. Reading it before the list lets the user
          interpret the up/down chevrons correctly on first sight. */}
      <CmsText
        cmsKey="journeyAssessment.priorityRanking.arrowsHint"
        as="p"
        className="text-center text-[15px] font-medium text-white/85"
      />

      <ul
        role="list"
        aria-roledescription="reorderable list"
        className="flex flex-col gap-2.5"
      >
        {order.map((key, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === order.length - 1;
          const upDisabled = isFirst || busy;
          const downDisabled = isLast || busy;
          const upLabel = moveUpTpl.replace("{label}", labelFor(key));
          const downLabel = moveDownTpl.replace("{label}", labelFor(key));
          return (
            <motion.li
              key={key}
              layout
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            >
              <div
                className={[
                  "relative flex items-start gap-3 rounded-2xl border p-4",
                  "border-white/10 bg-white/5 backdrop-blur-sm",
                  isFirst
                    ? "ring-1 ring-fuchsia-300/40 bg-gradient-to-r from-fuchsia-500/15 via-rose-500/10 to-transparent"
                    : "",
                  isLast ? "opacity-80" : "",
                ].join(" ")}
              >
                {/* Position pill */}
                <div
                  className={[
                    "shrink-0 inline-flex items-center justify-center rounded-full font-bold tabular-nums",
                    isFirst
                      ? "size-9 bg-fuchsia-400 text-fuchsia-950 text-base"
                      : "size-8 bg-white/10 text-white text-sm",
                  ].join(" ")}
                  aria-label={positionTpl.replace("{n}", String(idx + 1))}
                >
                  {idx + 1}
                </div>

                {/* Title + description */}
                <div className="min-w-0 flex-1">
                  <div
                    className={[
                      "font-semibold text-white",
                      isFirst ? "text-lg" : "text-base",
                    ].join(" ")}
                  >
                    {labelFor(key)}
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-white/65">
                    {descFor(key)}
                  </p>
                </div>

                {/* Up/down arrow controls. Stacked vertically - 44px tap
                    target each, comfortably hittable on a phone, and they
                    don't fight scroll because they're plain buttons (no
                    touch-action overrides). */}
                <div className="flex shrink-0 flex-col items-center gap-1 self-center">
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={upDisabled}
                    aria-label={upLabel}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/85 transition active:scale-95 hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronUp className="size-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={downDisabled}
                    aria-label={downLabel}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/85 transition active:scale-95 hover:border-white/30 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronDown className="size-5" aria-hidden />
                  </button>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      {/* Hint was here previously (2026-05-07 bump to 15px / white/85).
          Moved above the list 2026-05-19 — see the comment up there.
          Continue button stays here as the user's next step. */}
      <div className="flex justify-center">
        <Button
          type="button"
          onClick={submit}
          disabled={busy}
          className="min-w-[220px] min-h-[56px] text-[18px] font-semibold shadow-xl shadow-fuchsia-500/30"
        >
          <CmsText cmsKey="journeyAssessment.question.continue" />
        </Button>
      </div>
    </motion.section>
  );
}
