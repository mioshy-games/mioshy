"use client";

import { useMemo, useState } from "react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";

import { isValidOrder, type PriorityKey } from "@/lib/journey/priorities";
import type {
  AnswerValue,
  Locale,
  QuestionRanking,
  QuestionRankingCategory,
} from "@/lib/journey/types";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface Props {
  question: QuestionRanking;
  locale: Locale;
  onSubmit: (answer: AnswerValue) => Promise<void> | void;
  initial?: AnswerValue | null;
  busy?: boolean;
  /** Light variant only — when true the Continue button reads "סיום". */
  isLast?: boolean;
}

// ── Light-theme tokens (shared with QuestionStep / v6 mockup) ────────────────
const ASSISTANT = "var(--font-assistant), sans-serif";
const BRAND_GRADIENT =
  "linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)";
const GAP = "clamp(38px,7.5vh,78px)";

/**
 * Reorder the 5 relationship priority categories.
 *
 * Journey light-theme redesign (2026-07-01,
 * docs/journey-assessment-redesign-workorder.md): per Itzik the primary
 * interaction is DRAG (the subline copy says "ניתן לגרור"). Drag is wired via
 * framer-motion `Reorder` with a dedicated GRIP HANDLE only
 * (`dragListener={false}` + `useDragControls`), so the row body — and the page
 * — keep scrolling normally on mobile. This is the fix for the old scroll-lock
 * (UX feedback 2026-05-05): the previous `Reorder.Group` set `touch-action:none`
 * on the whole row, so a finger anywhere on a card blocked page scroll. Now
 * `touch-action:none` sits ONLY on the small handle. As a mitigation the list is
 * also centered at 70% width on mobile (spec §5) so there is side room to scroll.
 *
 * Accessibility (kept per Itzik): each row also exposes ↑/↓ buttons — real
 * <button>s with aria-labels — so keyboard and assistive-tech users can reorder
 * without dragging. Drag is primary; arrows are the equivalent alternative.
 *
 * Submission shape is unchanged: `{ kind: 'ranking', order: PriorityKey[] }`.
 */
export function PriorityRankingStep({
  question,
  locale,
  onSubmit,
  initial,
  busy = false,
  isLast = false,
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
  const savingLabel = useCmsText("journeyAssessment.question.saving").text;

  const submit = async () => {
    if (!isValidOrder(order)) return;
    await onSubmit({ kind: "ranking", order });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex w-full flex-col items-center text-center"
      dir={isHe ? "rtl" : "ltr"}
    >
      <h2
        className="mx-auto max-w-[32ch] text-center font-semibold leading-[1.4] text-[#2E2622] md:max-w-[42ch]"
        style={{ fontFamily: ASSISTANT, fontSize: "clamp(23px,5vw,30px)" }}
      >
        {headline}
      </h2>
      {subline ? (
        <p className="mx-auto mt-3 max-w-[34ch] text-center text-[15px] font-semibold text-[#a2917f]">
          {subline}
        </p>
      ) : null}

      <Reorder.Group
        axis="y"
        values={order}
        onReorder={(next) => {
          const arr = next as PriorityKey[];
          if (isValidOrder(arr)) setOrder(arr);
        }}
        as="ul"
        aria-roledescription={isHe ? "רשימה הניתנת לגרירה" : "reorderable list"}
        className="mx-auto flex w-[70%] flex-col gap-[10px] md:w-full md:max-w-[780px]"
        style={{ marginTop: GAP, listStyle: "none" }}
      >
        {order.map((key, idx) => (
          <RankRow
            key={key}
            value={key}
            index={idx}
            total={order.length}
            label={labelFor(key)}
            desc={descFor(key)}
            busy={busy}
            positionLabel={positionTpl.replace("{n}", String(idx + 1))}
            upLabel={moveUpTpl.replace("{label}", labelFor(key))}
            downLabel={moveDownTpl.replace("{label}", labelFor(key))}
            grabLabel={isHe ? `גרור את ${labelFor(key)}` : `Drag ${labelFor(key)}`}
            onMoveUp={() => moveUp(idx)}
            onMoveDown={() => moveDown(idx)}
          />
        ))}
      </Reorder.Group>

      {/* Continue — elegant dark ink pill (spec §5). "סיום" on the last step. */}
      <div className="flex w-full justify-center" style={{ marginTop: GAP }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-[9px] rounded-full bg-[#2E2622] px-7 py-3 text-[16px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(33,26,23,.5)] transition hover:-translate-y-px hover:shadow-[0_12px_24px_-10px_rgba(33,26,23,.55)] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ fontFamily: ASSISTANT }}
        >
          {busy ? (
            <span>{savingLabel}</span>
          ) : (
            <>
              <CmsText
                cmsKey={isLast ? "journeyAssessment.question.finish" : "journeyAssessment.question.continue"}
              />
              <span aria-hidden className="text-[15px] opacity-70">
                {isHe ? "←" : "→"}
              </span>
            </>
          )}
        </button>
      </div>
    </motion.section>
  );
}

/**
 * A single reorderable row. Owns its own `useDragControls` (hooks can't run in
 * a map body) and starts a drag only when the grip handle is pressed
 * (`dragListener={false}`), leaving the rest of the row / page scrollable.
 */
function RankRow({
  value,
  index,
  total,
  label,
  desc,
  busy,
  positionLabel,
  upLabel,
  downLabel,
  grabLabel,
  onMoveUp,
  onMoveDown,
}: {
  value: PriorityKey;
  index: number;
  total: number;
  label: string;
  desc: string;
  busy: boolean;
  positionLabel: string;
  upLabel: string;
  downLabel: string;
  grabLabel: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const controls = useDragControls();
  const upDisabled = index === 0 || busy;
  const downDisabled = index === total - 1 || busy;

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="flex items-center gap-[14px] rounded-2xl border-[1.5px] border-[#efe7da] bg-white px-4 py-[14px] text-start shadow-[0_4px_14px_-12px_rgba(80,50,35,.3)]"
    >
      {/* Position pill (gradient) */}
      <span
        aria-label={positionLabel}
        className="grid size-7 flex-none place-items-center rounded-[9px] text-[14px] font-extrabold tabular-nums text-white"
        style={{ background: BRAND_GRADIENT }}
      >
        {index + 1}
      </span>

      {/* Title + description */}
      <div className="min-w-0 flex-1">
        <div className="text-[17.5px] font-bold leading-snug text-[#2E2622]">{label}</div>
        {desc ? (
          <p className="mt-0.5 text-[13px] leading-snug text-[#a2917f]">{desc}</p>
        ) : null}
      </div>

      {/* a11y keyboard alternative: ↑/↓ buttons */}
      <div className="flex flex-none flex-col items-center gap-1 self-center">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={upDisabled}
          aria-label={upLabel}
          className="inline-flex size-7 items-center justify-center rounded-lg border border-[#efe7da] text-[#a2917f] transition hover:border-[#e6d5c4] hover:text-[#4a4441] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={downDisabled}
          aria-label={downLabel}
          className="inline-flex size-7 items-center justify-center rounded-lg border border-[#efe7da] text-[#a2917f] transition hover:border-[#e6d5c4] hover:text-[#4a4441] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>

      {/* Drag handle — primary interaction. Only this element starts a drag
          and carries touch-action:none, so the page keeps scrolling. */}
      <button
        type="button"
        aria-label={grabLabel}
        onPointerDown={(e) => controls.start(e)}
        className="flex-none cursor-grab text-[#d8c8b3] transition hover:text-[#a2917f] active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
    </Reorder.Item>
  );
}
