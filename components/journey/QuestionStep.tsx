"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Question, QuestionChoice, QuestionReflection, AnswerValue, Locale } from "@/lib/journey/types";
import { likertLabel, promptFor } from "@/lib/journey/questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface QuestionStepProps {
  question: Question;
  locale: Locale;
  onSubmit: (answer: AnswerValue) => Promise<void> | void;
  initial?: AnswerValue | null;
  busy?: boolean;
}

/**
 * Renders a single question and calls `onSubmit` with a validated answer.
 *
 * UX rules:
 * - likert5 / single_choice / forced_choice → click auto-advances (no Continue button)
 * - multi_choice → show "Continue" button after at least one selection
 * - reflection → always show "Continue" button
 */
export function QuestionStep({ question, locale, onSubmit, initial, busy }: QuestionStepProps) {
  const [answer, setAnswer] = useState<AnswerValue | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  const isHe = locale === "he";

  // CMS strings that need a raw string (validation message, busy label).
  const selectAnswerMsg = useCmsText("journeyAssessment.question.selectAnswer").text;
  const savingLabel = useCmsText("journeyAssessment.question.saving").text;

  // Auto-submitting question types
  const isAutoAdvance =
    question.type === "likert5" ||
    question.type === "forced_choice" ||
    question.type === "single_choice";

  const handleAutoSelect = async (value: AnswerValue) => {
    setAnswer(value);
    setError(null);
    await onSubmit(value);
  };

  const submit = async () => {
    if (!answer) {
      setError(selectAnswerMsg);
      return;
    }
    setError(null);
    await onSubmit(answer);
  };

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.09 }}
      className="flex w-full max-w-2xl flex-col gap-6"
      dir={isHe ? "rtl" : "ltr"}
    >
      <h2 className="text-start text-[24px] font-semibold leading-snug text-white drop-shadow-sm">
        {promptFor(question, locale)}
      </h2>

      {question.type === "likert5" ? (
        <LikertControl locale={locale} value={answer} onChange={handleAutoSelect} busy={busy} />
      ) : question.type === "forced_choice" || question.type === "single_choice" ? (
        <SingleChoiceControl
          question={question as QuestionChoice}
          locale={locale}
          value={answer}
          onChange={handleAutoSelect}
          busy={busy}
        />
      ) : question.type === "multi_choice" ? (
        <MultiChoiceControl question={question as QuestionChoice} locale={locale} value={answer} onChange={setAnswer} />
      ) : (
        <ReflectionControl question={question as QuestionReflection} value={answer} onChange={setAnswer} />
      )}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {/* Show Continue button only for non-auto-advance types.
          W2.5 (Itzik #8) — explicit min-height 50px + 18px text so the
          submit button below an open-text/multi-choice field is
          unmistakable on mobile (was getting lost).
          2026-05-28 — restyled per Itzik to match the answer-choice
          cards above (rounded-2xl, border, rose→fuchsia→violet dark
          gradient + selected-state ring) so the assessment flow reads
          as a single unified component instead of a CTA pill stuck
          under a list of cards. Width stays full so it doesn't get
          lost on mobile, and `font-semibold` gives it slightly more
          weight than an unselected option without breaking the
          visual family. */}
      {!isAutoAdvance ? (
        <Button
          onClick={submit}
          disabled={busy}
          size="lg"
          className="min-h-[56px] w-full rounded-2xl border border-rose-400/70 bg-gradient-to-br from-rose-500/40 via-fuchsia-500/30 to-violet-500/30 text-[19px] font-semibold text-white ring-2 ring-rose-400/50 shadow-lg shadow-rose-500/20 transition active:scale-[0.98] hover:from-rose-500/55 hover:via-fuchsia-500/45 hover:to-violet-500/45 hover:border-rose-400/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            savingLabel
          ) : (
            <CmsText cmsKey="journeyAssessment.question.continue" />
          )}
        </Button>
      ) : busy ? (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
          {savingLabel}
        </div>
      ) : null}
    </motion.div>
  );
}

// ─── Subcontrols ─────────────────────────────────────────────────────────────

function LikertControl({
  locale,
  value,
  onChange,
  busy,
}: {
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  busy?: boolean;
}) {
  const current = value?.kind === "likert" ? value.value : null;
  // Layout - UX feedback 2026-05-05: on phones, the 5-col grid was
  // squeezing Hebrew labels like "לעיתים רחוקות" (13 chars) into ~57px
  // cells, wrapping to 3 lines and looking broken. Mobile now stacks the
  // 5 options as full-width buttons (number + label inline, large tap
  // target, no wrapping). From sm breakpoint up the original 5-col grid
  // returns for the compact desktop view.
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => !busy && onChange({ kind: "likert", value: n })}
          disabled={busy}
          className={`flex items-center justify-start gap-3 rounded-2xl border px-4 py-3 transition active:scale-[0.98] sm:flex-col sm:items-center sm:justify-center sm:px-2 ${
            current === n
              ? "border-rose-400/70 bg-gradient-to-br from-rose-500/40 via-fuchsia-500/35 to-violet-500/35 text-white ring-2 ring-rose-400/50 shadow-lg shadow-rose-500/20"
              : "border-rose-300/20 bg-gradient-to-br from-rose-950/40 via-slate-900/85 to-violet-950/40 text-white/85 hover:border-rose-300/45 hover:from-rose-900/45 hover:via-slate-800/85 hover:to-violet-900/45"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {/* Per Itzik 2026-05-07: response text was too small (numbers
              20-22px, labels 14-18px) — bumped numbers to 28px and the
              accompanying label to 17-18px so they read clearly on
              both phone and desktop. Removed the slight transparency
              on the labels too.
              2026-05-28 — mobile RTL fix per Itzik: label is now flush
              right (start in RTL) with the number sitting just to its
              left, instead of label-left / number-right spread by
              `justify-between`. `order-*` classes only apply at the
              base breakpoint; `sm:order-none` restores DOM order
              (number on top of label) for the desktop column layout
              unchanged.
              2026-05-29 — Itzik flipped the mobile order again: number
              FIRST (rightmost in RTL), label after it. Number sits in
              a fixed-width slot (w-7 + text-center) so every row's
              label starts at the same x position — that's the
              "straight line of text" the spec asks for. Label bumped
              to 20px/font-semibold per spec; desktop sm:text-[17px]
              unchanged because the desktop column layout is tighter. */}
          <span className="order-1 sm:order-none w-7 text-center text-[28px] font-semibold sm:w-auto sm:text-[26px]">{n}</span>
          <span className="order-2 sm:order-none text-[20px] font-semibold leading-snug sm:mt-1.5 sm:text-[17px] sm:font-medium">
            {likertLabel(n, locale)}
          </span>
        </button>
      ))}
    </div>
  );
}

function SingleChoiceControl({
  question,
  locale,
  value,
  onChange,
  busy,
}: {
  question: QuestionChoice;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  busy?: boolean;
}) {
  const current = value?.kind === "single" ? value.option : null;
  // mx-0 on mobile (start-aligns the column to the inline-start = right in
  // RTL, per UX feedback 2026-05-05 "ליישר את הכפתורים לימין ולא לאמצע").
  // md:mx-auto preserves the centered layout on tablet/desktop where the
  // question card has slack on both sides.
  // W2.2 (Itzik #5) — bumped mobile text 20→22px and padding 4→5 so the
  // tap targets feel substantial on a phone.
  return (
    <div className="mx-0 md:mx-auto flex w-full max-w-md flex-col gap-2">
      {question.options.map((opt) => {
        const label = locale === "he" ? opt.he : opt.en;
        const classes = `rounded-2xl border px-4 py-5 text-start text-[22px] font-medium leading-snug transition active:scale-[0.98] sm:py-4 sm:text-[20px] ${
          current === opt.id
            ? "border-rose-400/70 bg-gradient-to-br from-rose-500/40 via-fuchsia-500/30 to-violet-500/30 text-white ring-2 ring-rose-400/50 shadow-lg shadow-rose-500/20"
            : "border-rose-300/20 bg-gradient-to-br from-rose-950/40 via-slate-900/85 to-violet-950/40 text-white/90 hover:border-rose-300/45 hover:from-rose-900/45 hover:via-slate-800/85 hover:to-violet-900/45"
        } disabled:cursor-not-allowed disabled:opacity-50`;
        return (
          <button
            type="button"
            key={opt.id}
            onClick={() => !busy && onChange({ kind: "single", option: opt.id })}
            disabled={busy}
            className={classes}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function MultiChoiceControl({
  question,
  locale,
  value,
  onChange,
}: {
  question: QuestionChoice;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
}) {
  const current = value?.kind === "multi" ? value.options : [];
  const toggle = (id: string) => {
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ kind: "multi", options: next });
  };
  // W2.2 (Itzik #5) — same mobile text/padding bump as SingleChoice.
  return (
    <div className="mx-0 md:mx-auto flex w-full max-w-md flex-col gap-2">
      {question.options.map((opt) => {
        const label = locale === "he" ? opt.he : opt.en;
        const classes = `rounded-2xl border px-4 py-5 text-start text-[22px] font-medium leading-snug transition active:scale-[0.98] sm:py-4 sm:text-[20px] ${
          current.includes(opt.id)
            ? "border-rose-400/70 bg-gradient-to-br from-rose-500/40 via-fuchsia-500/30 to-violet-500/30 text-white ring-2 ring-rose-400/40 shadow-lg shadow-rose-500/20"
            : "border-rose-300/20 bg-gradient-to-br from-rose-950/40 via-slate-900/85 to-violet-950/40 text-white/90 hover:border-rose-300/45 hover:from-rose-900/45 hover:via-slate-800/85 hover:to-violet-900/45"
        }`;
        return (
          <button
            type="button"
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={classes}
          >
            <span className={`me-2 inline-block h-4 w-4 rounded border align-middle ${current.includes(opt.id) ? "border-rose-400 bg-gradient-to-br from-rose-500 to-fuchsia-500" : "border-white/35"}`} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ReflectionControl({
  question,
  value,
  onChange,
}: {
  question: QuestionReflection;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
}) {
  const text = value?.kind === "text" ? value.text : "";
  const placeholder = useCmsText("journeyAssessment.question.reflectionPlaceholder").text;
  return (
    <Textarea
      value={text}
      onChange={(e) => onChange({ kind: "text", text: e.target.value })}
      maxLength={question.max_length ?? 600}
      rows={5}
      placeholder={placeholder}
      className="bg-slate-800/70 border-white/12 text-white placeholder:text-white/40 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/20"
    />
  );
}
