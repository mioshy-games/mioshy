"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Question, QuestionChoice, QuestionReflection, AnswerValue, Locale } from "@/lib/journey/types";
import { promptFor, QUESTIONNAIRE } from "@/lib/journey/questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCmsText } from "@/hooks/useCmsText";
import { CmsText } from "@/components/cms/CmsText";

interface QuestionStepProps {
  question: Question;
  locale: Locale;
  /** F3.1 — likert labels carried as a prop (sourced from JSON in the page)
   *  for the journey render path. Optional: the shared assessments flow
   *  (intimacy/friendship) doesn't pass it and falls back to the static
   *  questionnaire labels — its behaviour is unchanged. */
  likertLabels?: Record<Locale, string[]>;
  onSubmit: (answer: AnswerValue) => Promise<void> | void;
  initial?: AnswerValue | null;
  busy?: boolean;
  /** Journey light-theme redesign (2026-07-01,
   *  docs/journey-assessment-redesign-workorder.md). "dark" (default) keeps
   *  the legacy styling used by components/assessments/AssessmentClient
   *  (intimacy/friendship) UNCHANGED. "light" renders the clean light theme
   *  from the approved v6 mockup. */
  variant?: "light" | "dark";
  /** Light variant only — when true the manual-submit Continue button reads
   *  "סיום" (finish) instead of "המשך". */
  isLast?: boolean;
}

// ── Light-theme tokens (v6 mockup / workorder §5) ────────────────────────────
const ASSISTANT = "var(--font-assistant), sans-serif";
const BRAND_GRADIENT =
  "linear-gradient(95deg,#6C5CE7 0%,#D6409F 52%,#F79154 100%)";
// Hairline gradient contour: white fill (padding-box) + gradient edge
// (border-box). Paired with a hair-thin transparent border on the element.
const GRAD_RING_BG = `linear-gradient(#fff,#fff) padding-box, ${BRAND_GRADIENT} border-box`;
// Single vertical-rhythm token between question ↔ answer ↔ nav.
const GAP = "clamp(38px,7.5vh,78px)";

/**
 * Renders a single question and calls `onSubmit` with a validated answer.
 *
 * UX rules:
 * - likert5 / single_choice / forced_choice → click auto-advances (no Continue button)
 * - multi_choice → show "Continue" button after at least one selection
 * - reflection → always show "Continue" button
 */
export function QuestionStep({ question, locale, likertLabels, onSubmit, initial, busy, variant = "dark", isLast = false }: QuestionStepProps) {
  const [answer, setAnswer] = useState<AnswerValue | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  const isHe = locale === "he";
  const isLight = variant === "light";

  // CMS strings that need a raw string (validation message, busy label).
  const selectAnswerMsg = useCmsText("journeyAssessment.question.selectAnswer").text;
  const savingLabel = useCmsText("journeyAssessment.question.saving").text;

  // a11y (B1/M9): the question text labels every option group; the validation
  // error is announced (role=alert) and linked to the group via aria-describedby.
  const labelledById = `q-label-${question.id}`;
  const errorId = `q-error-${question.id}`;
  const describedById = error ? errorId : undefined;

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

  const labels = likertLabels ?? QUESTIONNAIRE.likert_labels;

  // ── Light variant (journey redesign) ─────────────────────────────────────
  if (isLight) {
    return (
      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.09 }}
        className="flex w-full flex-col items-center text-center"
        dir={isHe ? "rtl" : "ltr"}
      >
        <h2
          id={labelledById}
          className="mx-auto max-w-[32ch] text-center font-semibold leading-[1.4] text-[#2E2622] md:max-w-[42ch]"
          style={{ fontFamily: ASSISTANT, fontSize: "clamp(23px,5vw,30px)", marginBottom: GAP }}
        >
          {promptFor(question, locale)}
        </h2>

        {question.type === "likert5" ? (
          <LikertControlLight locale={locale} likertLabels={labels} value={answer} onChange={handleAutoSelect} busy={busy} labelledById={labelledById} />
        ) : question.type === "forced_choice" || question.type === "single_choice" ? (
          <SingleChoiceControlLight question={question as QuestionChoice} locale={locale} value={answer} onChange={handleAutoSelect} busy={busy} labelledById={labelledById} />
        ) : question.type === "multi_choice" ? (
          <MultiChoiceControlLight question={question as QuestionChoice} locale={locale} value={answer} onChange={setAnswer} labelledById={labelledById} describedById={describedById} />
        ) : (
          <ReflectionControlLight question={question as QuestionReflection} locale={locale} value={answer} onChange={setAnswer} labelledById={labelledById} describedById={describedById} />
        )}

        {error ? (
          <p id={errorId} role="alert" className="mt-4 text-[14px] font-semibold text-rose-600">
            {error}
          </p>
        ) : null}

        {/* Continue button — only for non-auto-advance types (multi / reflection).
            Elegant dark ink pill per spec §5 (not the heavy gradient). */}
        {!isAutoAdvance ? (
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
        ) : null}
      </motion.div>
    );
  }

  // ── Dark variant (unchanged — assessments flow) ──────────────────────────
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
      <h2 id={labelledById} className="text-start text-[24px] font-semibold leading-snug text-white drop-shadow-sm">
        {promptFor(question, locale)}
      </h2>

      {question.type === "likert5" ? (
        <LikertControl locale={locale} likertLabels={labels} value={answer} onChange={handleAutoSelect} busy={busy} labelledById={labelledById} />
      ) : question.type === "forced_choice" || question.type === "single_choice" ? (
        <SingleChoiceControl
          question={question as QuestionChoice}
          locale={locale}
          value={answer}
          onChange={handleAutoSelect}
          busy={busy}
          labelledById={labelledById}
        />
      ) : question.type === "multi_choice" ? (
        <MultiChoiceControl question={question as QuestionChoice} locale={locale} value={answer} onChange={setAnswer} labelledById={labelledById} describedById={describedById} />
      ) : (
        <ReflectionControl question={question as QuestionReflection} locale={locale} value={answer} onChange={setAnswer} labelledById={labelledById} describedById={describedById} />
      )}

      {error ? <p id={errorId} role="alert" className="text-sm text-rose-300">{error}</p> : null}

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

// ─── Light subcontrols (journey redesign) ────────────────────────────────────

function LikertControlLight({
  locale,
  likertLabels,
  value,
  onChange,
  busy,
  labelledById,
}: {
  locale: Locale;
  likertLabels: Record<Locale, string[]>;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  busy?: boolean;
  labelledById?: string;
}) {
  const current = value?.kind === "likert" ? value.value : null;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledById}
      className="mx-auto flex w-full max-w-[340px] items-start md:max-w-[440px]"
    >
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const on = current === n;
        const label = likertLabels[locale][n - 1] ?? String(n);
        // Whole column is ONE button (number + label) so clicking the LABEL
        // selects and auto-advances too, not just the numbered circle.
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${n} — ${label}`}
            onClick={() => !busy && onChange({ kind: "likert", value: n })}
            disabled={busy}
            className={`flex min-w-0 flex-1 flex-col items-center gap-[9px] bg-transparent transition disabled:cursor-not-allowed ${
              on ? "" : "hover:-translate-y-0.5"
            }`}
          >
            <span
              aria-hidden
              className={`grid aspect-square w-[clamp(46px,11vw,54px)] place-items-center rounded-full text-[17px] font-extrabold ${
                on
                  ? "scale-[1.14] text-white shadow-[0_12px_22px_-8px_rgba(150,60,150,.5)]"
                  : "text-[#141414]"
              }`}
              style={{
                background: on ? BRAND_GRADIENT : GRAD_RING_BG,
                border: "0.4px solid transparent",
              }}
            >
              {n}
            </span>
            <span className="px-0.5 text-center text-[12.5px] font-bold leading-[1.22] text-[#4a4441]">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SingleChoiceControlLight({
  question,
  locale,
  value,
  onChange,
  busy,
  labelledById,
}: {
  question: QuestionChoice;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  busy?: boolean;
  labelledById?: string;
}) {
  const current = value?.kind === "single" ? value.option : null;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledById}
      className="mx-auto flex w-full max-w-[440px] flex-col gap-[11px] text-start md:max-w-[780px]"
    >
      {question.options.map((opt) => {
        const label = locale === "he" ? opt.he : opt.en;
        const on = current === opt.id;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={on}
            key={opt.id}
            onClick={() => !busy && onChange({ kind: "single", option: opt.id })}
            disabled={busy}
            className={`flex items-center gap-[14px] rounded-2xl px-[17px] py-[15px] text-start transition disabled:cursor-not-allowed ${
              on
                ? "shadow-[0_12px_26px_-14px_rgba(150,60,150,.4)]"
                : "border-[1.5px] border-[#efe7da] bg-white shadow-[0_4px_16px_-12px_rgba(80,50,35,.35)] hover:-translate-y-px hover:border-[#e6d5c4]"
            }`}
            style={on ? { background: GRAD_RING_BG, border: "2px solid transparent" } : undefined}
          >
            <ChoiceTick on={on} />
            <span className={`text-[18.5px] leading-[1.3] text-[#2E2622] ${on ? "font-extrabold" : "font-semibold"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MultiChoiceControlLight({
  question,
  locale,
  value,
  onChange,
  labelledById,
  describedById,
}: {
  question: QuestionChoice;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  labelledById?: string;
  describedById?: string;
}) {
  const current = value?.kind === "multi" ? value.options : [];
  const toggle = (id: string) => {
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ kind: "multi", options: next });
  };
  return (
    <div
      role="group"
      aria-labelledby={labelledById}
      aria-describedby={describedById}
      className="mx-auto flex w-full max-w-[440px] flex-col gap-[11px] text-start md:max-w-[780px]"
    >
      {question.options.map((opt) => {
        const label = locale === "he" ? opt.he : opt.en;
        const on = current.includes(opt.id);
        return (
          <button
            type="button"
            role="checkbox"
            aria-checked={on}
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={`flex items-center gap-[14px] rounded-2xl px-[17px] py-[15px] text-start transition ${
              on
                ? "shadow-[0_12px_26px_-14px_rgba(150,60,150,.4)]"
                : "border-[1.5px] border-[#efe7da] bg-white shadow-[0_4px_16px_-12px_rgba(80,50,35,.35)] hover:-translate-y-px hover:border-[#e6d5c4]"
            }`}
            style={on ? { background: GRAD_RING_BG, border: "2px solid transparent" } : undefined}
          >
            <ChoiceTick on={on} square />
            <span className={`text-[18.5px] leading-[1.3] text-[#2E2622] ${on ? "font-extrabold" : "font-semibold"}`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Shared light tick — round (single) or squared (multi). Gradient fill + white
 *  ✓ when selected; hairline neutral ring when not. */
function ChoiceTick({ on, square }: { on: boolean; square?: boolean }) {
  return (
    <span
      className={`relative h-[23px] w-[23px] flex-none transition ${square ? "rounded-md" : "rounded-full"}`}
      style={on ? { background: BRAND_GRADIENT } : { border: "2px solid #d8c8b3" }}
    >
      {on ? (
        <span className="absolute inset-0 grid place-items-center text-[13px] font-black text-white">
          ✓
        </span>
      ) : null}
    </span>
  );
}

function ReflectionControlLight({
  question,
  locale,
  value,
  onChange,
  labelledById,
  describedById,
}: {
  question: QuestionReflection;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  labelledById?: string;
  describedById?: string;
}) {
  const text = value?.kind === "text" ? value.text : "";
  const cmsPlaceholder = useCmsText("journeyAssessment.question.reflectionPlaceholder").text;
  const perQuestion = locale === "he" ? question.placeholder_he : question.placeholder_en;
  const placeholder = perQuestion && perQuestion.trim() !== "" ? perQuestion : cmsPlaceholder;
  return (
    <textarea
      value={text}
      onChange={(e) => onChange({ kind: "text", text: e.target.value })}
      maxLength={question.max_length ?? 600}
      rows={3}
      placeholder={placeholder}
      aria-labelledby={labelledById}
      aria-describedby={describedById}
      className="mx-auto block min-h-[72px] w-full max-w-[470px] resize-none border-0 border-b-2 border-[#efe7da] bg-transparent px-1 py-[14px] text-center font-medium leading-[1.5] text-[#2E2622] outline-none transition placeholder:font-normal placeholder:text-[#cbbaa5] focus:border-[#d6409f] md:max-w-[760px]"
      style={{ fontFamily: ASSISTANT, fontSize: "clamp(19px,4.5vw,22px)" }}
    />
  );
}

// ─── Dark subcontrols (unchanged — assessments flow) ─────────────────────────

function LikertControl({
  locale,
  likertLabels,
  value,
  onChange,
  busy,
  labelledById,
}: {
  locale: Locale;
  likertLabels: Record<Locale, string[]>;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  busy?: boolean;
  labelledById?: string;
}) {
  const current = value?.kind === "likert" ? value.value : null;
  // Layout - UX feedback 2026-05-05: on phones, the 5-col grid was
  // squeezing Hebrew labels like "לעיתים רחוקות" (13 chars) into ~57px
  // cells, wrapping to 3 lines and looking broken. Mobile now stacks the
  // 5 options as full-width buttons (number + label inline, large tap
  // target, no wrapping). From sm breakpoint up the original 5-col grid
  // returns for the compact desktop view.
  return (
    <div role="radiogroup" aria-labelledby={labelledById} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          type="button"
          role="radio"
          aria-checked={current === n}
          aria-label={`${n} — ${likertLabels[locale][n - 1] ?? String(n)}`}
          key={n}
          onClick={() => !busy && onChange({ kind: "likert", value: n })}
          disabled={busy}
          className={`flex min-h-[44px] items-center justify-start gap-3 rounded-2xl border px-4 py-3 transition active:scale-[0.98] sm:flex-col sm:items-center sm:justify-center sm:px-2 ${
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
            {likertLabels[locale][n - 1] ?? String(n)}
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
  labelledById,
}: {
  question: QuestionChoice;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  busy?: boolean;
  labelledById?: string;
}) {
  const current = value?.kind === "single" ? value.option : null;
  // mx-0 on mobile (start-aligns the column to the inline-start = right in
  // RTL, per UX feedback 2026-05-05 "ליישר את הכפתורים לימין ולא לאמצע").
  // md:mx-auto preserves the centered layout on tablet/desktop where the
  // question card has slack on both sides.
  // W2.2 (Itzik #5) — bumped mobile text 20→22px and padding 4→5 so the
  // tap targets feel substantial on a phone.
  return (
    <div role="radiogroup" aria-labelledby={labelledById} className="mx-0 md:mx-auto flex w-full max-w-md flex-col gap-2">
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
            role="radio"
            aria-checked={current === opt.id}
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
  labelledById,
  describedById,
}: {
  question: QuestionChoice;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  labelledById?: string;
  describedById?: string;
}) {
  const current = value?.kind === "multi" ? value.options : [];
  const toggle = (id: string) => {
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ kind: "multi", options: next });
  };
  // W2.2 (Itzik #5) — same mobile text/padding bump as SingleChoice.
  return (
    <div role="group" aria-labelledby={labelledById} aria-describedby={describedById} className="mx-0 md:mx-auto flex w-full max-w-md flex-col gap-2">
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
            role="checkbox"
            aria-checked={current.includes(opt.id)}
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
  locale,
  value,
  onChange,
  labelledById,
  describedById,
}: {
  question: QuestionReflection;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  labelledById?: string;
  describedById?: string;
}) {
  const text = value?.kind === "text" ? value.text : "";
  // F3.1 — prefer the per-question placeholder (admin-set via F2, stored in
  // journey_questions.meta) when present; otherwise fall back to the global
  // CMS key (today's behaviour).
  const cmsPlaceholder = useCmsText("journeyAssessment.question.reflectionPlaceholder").text;
  const perQuestion = locale === "he" ? question.placeholder_he : question.placeholder_en;
  const placeholder = perQuestion && perQuestion.trim() !== "" ? perQuestion : cmsPlaceholder;
  return (
    <Textarea
      value={text}
      onChange={(e) => onChange({ kind: "text", text: e.target.value })}
      maxLength={question.max_length ?? 600}
      rows={5}
      placeholder={placeholder}
      aria-labelledby={labelledById}
      aria-describedby={describedById}
      className="bg-slate-800/70 border-white/12 text-white placeholder:text-white/40 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/20"
    />
  );
}
