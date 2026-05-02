"use client";

/**
 * AssessmentItemForm — renders a structured questionnaire for an
 * assessment-kind journey item and handles submission. Phase 3 step 2.
 *
 * Supported question kinds:
 *   - single_choice    (radio buttons)
 *   - multiple_choice  (checkboxes)
 *   - scale            (1..N number with min/max labels)
 *   - open_text        (textarea)
 *   - ranking          (drag-or-arrow-reorder list)
 *
 * UX choices:
 *   - One-page form. Long assessments scroll. We do NOT paginate —
 *     completion rate goes up when the user can see "how much is left".
 *   - Live progress indicator on top: X / Y answered.
 *   - "פרטי" checkbox at the bottom (matches ResponseBox).
 *   - Inline validation only on submit; no nags while typing.
 *   - Optimistic state: on success we show a calm "שאלון נשלח" line
 *     and disable further edits unless the user clicks "עריכה".
 *
 * Tone: same calm-clinical voice as the rest of the surface. No
 * progress bars with celebratory animations, no streak counters.
 */

import { useMemo, useState, useTransition } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type {
  JourneyAssessmentPayload,
  JourneyAssessmentQuestion,
} from "@/lib/journey-content/types";
import {
  submitAssessmentResponse,
  type AssessmentSubmitResult,
} from "@/lib/journey-content/assessment-actions";
import { track } from "@/lib/analytics";

export function AssessmentItemForm({
  isHe,
  scheduledItemId,
  payload,
  /** Pre-fill from a previous submission so the user can revise. */
  initialAnswers,
  initialSummary,
  initialPrivate,
}: {
  isHe: boolean;
  scheduledItemId: string;
  payload: JourneyAssessmentPayload;
  initialAnswers?: Record<string, unknown>;
  initialSummary?: string;
  initialPrivate?: boolean;
}) {
  const questions = useMemo(
    () => payload.questions ?? [],
    [payload.questions],
  );
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    initialAnswers ?? {},
  );
  const [summary, setSummary] = useState(initialSummary ?? "");
  const [isPrivate, setIsPrivate] = useState(
    initialPrivate === undefined ? true : initialPrivate,
  );
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { kind: "saved" }
    | { kind: "error"; message: string }
    | { kind: "validation"; missing: string[] }
    | null
  >(null);
  const [locked, setLocked] = useState(!!initialAnswers);

  const intro = isHe ? payload.intro_he : payload.intro_en ?? payload.intro_he;
  const outro = isHe ? payload.outro_he : payload.outro_en ?? payload.outro_he;

  const totalAnswered = useMemo(
    () =>
      questions.reduce((acc, q) => {
        return acc + (isAnswered(answers[q.id], q.kind) ? 1 : 0);
      }, 0),
    [answers, questions],
  );

  const handleSubmit = () => {
    if (locked || pending) return;

    // Validation: every required question must be answered.
    const missing = questions
      .filter((q) => q.required !== false)
      .filter((q) => !isAnswered(answers[q.id], q.kind))
      .map((q) => q.id);
    if (missing.length > 0) {
      setFeedback({ kind: "validation", missing });
      return;
    }

    startTransition(async () => {
      const res: AssessmentSubmitResult = await submitAssessmentResponse({
        scheduledItemId,
        answers,
        summaryText: summary,
        isPrivate,
      });
      if (res.ok) {
        setFeedback({ kind: "saved" });
        setLocked(true);
        track("journey_assessment_submitted", {
          scheduled_item_id: scheduledItemId,
          question_count: questions.length,
          answered_count: totalAnswered,
          has_summary: summary.trim().length > 0,
          is_private: isPrivate,
        });
      } else {
        setFeedback({
          kind: "error",
          message:
            res.message ??
            (isHe ? "אירעה תקלה. נסו שוב." : "Something went wrong. Try again."),
        });
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-300/[0.08] bg-slate-950/40 p-5 backdrop-blur-md">
      {/* Header */}
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-white">
          {isHe ? "אבחון אישי" : "Personal assessment"}
        </h3>
        <span className="text-[11px] text-white/55">
          {totalAnswered}/{questions.length}{" "}
          {isHe ? "שאלות" : "answered"}
        </span>
      </header>

      {intro ? (
        <p className="mt-2 text-sm leading-relaxed text-white/70">{intro}</p>
      ) : null}

      {/* Questions */}
      <ol className="mt-5 flex flex-col gap-5">
        {questions.map((q, idx) => {
          const isMissing =
            feedback?.kind === "validation" && feedback.missing.includes(q.id);
          return (
            <li
              key={q.id}
              className={[
                "rounded-xl border p-4",
                isMissing
                  ? "border-rose-400/40 bg-rose-500/[0.04]"
                  : "border-white/[0.08] bg-white/[0.02]",
              ].join(" ")}
            >
              <p className="text-sm font-medium text-white">
                <span className="me-2 text-white/45">{idx + 1}.</span>
                {isHe
                  ? q.prompt_he
                  : q.prompt_en ?? q.prompt_he}
                {q.required !== false ? (
                  <span className="ms-1 text-rose-300/70">*</span>
                ) : null}
              </p>

              <div className="mt-3">
                <QuestionInput
                  question={q}
                  value={answers[q.id]}
                  isHe={isHe}
                  disabled={locked || pending}
                  onChange={(v) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: v }))
                  }
                />
              </div>
            </li>
          );
        })}
      </ol>

      {outro ? (
        <p className="mt-5 text-sm leading-relaxed text-white/70">{outro}</p>
      ) : null}

      {/* Optional summary */}
      <div className="mt-5">
        <label
          htmlFor={`summary-${scheduledItemId}`}
          className="block text-xs font-semibold text-white/65"
        >
          {isHe
            ? "משהו נוסף שרציתם להוסיף? (לא חובה)"
            : "Anything you'd like to add? (optional)"}
        </label>
        <textarea
          id={`summary-${scheduledItemId}`}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          disabled={locked || pending}
          maxLength={2000}
          className="mt-2 w-full resize-y rounded-md border border-white/10 bg-slate-950/60 p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
          placeholder={
            isHe ? "כתבו כאן..." : "Write here..."
          }
        />
      </div>

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-[12px] text-white/65">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            disabled={locked || pending}
            className="h-3.5 w-3.5 rounded border-white/20 bg-slate-950/40 accent-emerald-400 disabled:opacity-60"
          />
          {isHe
            ? "פרטי — רק אני והמלווה"
            : "Private — only the clinician and I"}
        </label>

        {feedback?.kind === "validation" ? (
          <span className="text-[12px] text-rose-300">
            {isHe
              ? `יש להשלים ${feedback.missing.length} שאלות חובה`
              : `${feedback.missing.length} required question(s) missing`}
          </span>
        ) : feedback?.kind === "error" ? (
          <span className="text-[12px] text-rose-300">{feedback.message}</span>
        ) : feedback?.kind === "saved" ? (
          <span className="text-[12px] text-emerald-300">
            {isHe ? "השאלון נשלח" : "Submitted"}
          </span>
        ) : null}

        <div className="flex shrink-0 gap-2">
          {locked ? (
            <button
              type="button"
              onClick={() => {
                setLocked(false);
                setFeedback(null);
              }}
              className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-white/85 hover:border-white/30 hover:text-white"
            >
              {isHe ? "עריכה" : "Edit"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={locked || pending}
            className={[
              "rounded-full px-4 py-1.5 text-xs font-semibold",
              locked || pending
                ? "cursor-not-allowed bg-white/10 text-white/40"
                : "bg-white text-slate-950 hover:bg-white/90",
            ].join(" ")}
          >
            {pending
              ? isHe ? "שולחים..." : "Sending..."
              : initialAnswers
                ? isHe ? "עדכון" : "Update"
                : isHe ? "לשליחה" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// QuestionInput — kind-aware atomic renderer
// ─────────────────────────────────────────────────────────────────────

function QuestionInput({
  question,
  value,
  isHe,
  disabled,
  onChange,
}: {
  question: JourneyAssessmentQuestion;
  value: unknown;
  isHe: boolean;
  disabled: boolean;
  onChange: (v: unknown) => void;
}) {
  switch (question.kind) {
    case "single_choice":
      return (
        <SingleChoice
          question={question}
          value={typeof value === "string" ? value : undefined}
          isHe={isHe}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case "multiple_choice":
      return (
        <MultipleChoice
          question={question}
          value={Array.isArray(value) ? (value as string[]) : []}
          isHe={isHe}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case "scale":
      return (
        <ScaleInput
          question={question}
          value={typeof value === "number" ? value : undefined}
          isHe={isHe}
          disabled={disabled}
          onChange={onChange}
        />
      );
    case "open_text":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          maxLength={4000}
          className="w-full resize-y rounded-md border border-white/10 bg-slate-950/60 p-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
          placeholder={isHe ? "כתבו כאן..." : "Write here..."}
        />
      );
    case "ranking":
      return (
        <RankingInput
          question={question}
          value={Array.isArray(value) ? (value as string[]) : null}
          isHe={isHe}
          disabled={disabled}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

function SingleChoice({
  question,
  value,
  isHe,
  disabled,
  onChange,
}: {
  question: JourneyAssessmentQuestion;
  value: string | undefined;
  isHe: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const options = question.options ?? [];
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const checked = value === opt.key;
        return (
          <label
            key={opt.key}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
              checked
                ? "border-white/30 bg-white/[0.06] text-white"
                : "border-white/[0.08] bg-white/[0.015] text-white/75 hover:border-white/15",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="radio"
              name={question.id}
              value={opt.key}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(opt.key)}
              className="h-3.5 w-3.5 accent-white"
            />
            {isHe ? opt.label_he : opt.label_en ?? opt.label_he}
          </label>
        );
      })}
    </div>
  );
}

function MultipleChoice({
  question,
  value,
  isHe,
  disabled,
  onChange,
}: {
  question: JourneyAssessmentQuestion;
  value: string[];
  isHe: boolean;
  disabled: boolean;
  onChange: (v: string[]) => void;
}) {
  const options = question.options ?? [];
  const toggle = (key: string) => {
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else onChange([...value, key]);
  };
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const checked = value.includes(opt.key);
        return (
          <label
            key={opt.key}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
              checked
                ? "border-white/30 bg-white/[0.06] text-white"
                : "border-white/[0.08] bg-white/[0.015] text-white/75 hover:border-white/15",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(opt.key)}
              className="h-3.5 w-3.5 accent-emerald-400"
            />
            {isHe ? opt.label_he : opt.label_en ?? opt.label_he}
          </label>
        );
      })}
    </div>
  );
}

function ScaleInput({
  question,
  value,
  isHe,
  disabled,
  onChange,
}: {
  question: JourneyAssessmentQuestion;
  value: number | undefined;
  isHe: boolean;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const min = question.scale_min ?? 1;
  const max = question.scale_max ?? 7;
  const minLabel =
    isHe ? question.scale_min_label_he : question.scale_min_label_en;
  const maxLabel =
    isHe ? question.scale_max_label_he : question.scale_max_label_en;
  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {range.map((n) => {
          const checked = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              disabled={disabled}
              className={[
                "h-9 w-9 rounded-full border text-sm font-semibold transition",
                checked
                  ? "border-white/40 bg-white/[0.1] text-white"
                  : "border-white/10 bg-white/[0.02] text-white/65 hover:border-white/25",
                disabled ? "cursor-not-allowed opacity-50" : "",
              ].join(" ")}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(minLabel || maxLabel) ? (
        <div className="mt-2 flex justify-between text-[11px] text-white/45">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function RankingInput({
  question,
  value,
  isHe,
  disabled,
  onChange,
}: {
  question: JourneyAssessmentQuestion;
  value: string[] | null;
  isHe: boolean;
  disabled: boolean;
  onChange: (v: string[]) => void;
}) {
  const options = question.options ?? [];
  // First render: seed value with the option-key order
  const order = value ?? options.map((o) => o.key);

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    onChange(next);
  };

  const labelByKey = new Map(
    options.map((o) => [
      o.key,
      isHe ? o.label_he : o.label_en ?? o.label_he,
    ]),
  );

  return (
    <ol className="flex flex-col gap-2">
      {order.map((key, idx) => (
        <li
          key={key}
          className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm text-white/85">
            <span className="text-[11px] tabular-nums text-white/40">
              {idx + 1}.
            </span>
            <span className="truncate">{labelByKey.get(key) ?? key}</span>
          </span>
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => move(idx, -1)}
              disabled={disabled || idx === 0}
              aria-label={isHe ? "העלה למעלה" : "Move up"}
              className="rounded border border-white/10 p-1 text-white/65 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(idx, 1)}
              disabled={disabled || idx === order.length - 1}
              aria-label={isHe ? "הורד למטה" : "Move down"}
              className="rounded border border-white/10 p-1 text-white/65 hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────────────

function isAnswered(value: unknown, kind: JourneyAssessmentQuestion["kind"]): boolean {
  if (value === null || value === undefined) return false;
  switch (kind) {
    case "single_choice":
    case "open_text":
      return typeof value === "string" && value.trim().length > 0;
    case "multiple_choice":
      return Array.isArray(value) && value.length > 0;
    case "scale":
      return typeof value === "number" && Number.isFinite(value);
    case "ranking":
      return Array.isArray(value) && value.length > 0;
    default:
      return false;
  }
}
