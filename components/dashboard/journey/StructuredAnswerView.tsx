/**
 * StructuredAnswerView — renders a user's answers to an assessment
 * item in a clinician-friendly format. Phase 3 step 4.
 *
 * For each question in the assessment_payload, we look up the user's
 * answer (by question id) and render it in a kind-aware way:
 *   - single_choice  → option label
 *   - multiple_choice → list of option labels
 *   - scale          → "5 / 7" + min/max labels
 *   - open_text      → quoted text
 *   - ranking        → ordered list with positions
 *
 * Read-only. No editing. The clinician acts via the Reply form on the
 * row (Phase 2D); this view is just to make the answers legible.
 */

import type {
  JourneyAssessmentPayload,
  JourneyAssessmentQuestion,
} from "@/lib/journey-content/types";

export function StructuredAnswerView({
  payload,
  answers,
  isHe,
}: {
  payload: JourneyAssessmentPayload;
  answers: Record<string, unknown>;
  isHe: boolean;
}) {
  const questions = payload.questions ?? [];

  return (
    <div className="rounded-lg border border-white/[0.08] bg-slate-950/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
        {isHe ? "תשובות לשאלון" : "Assessment answers"}
      </p>
      <ol className="mt-2 flex flex-col gap-3">
        {questions.map((q, idx) => (
          <li key={q.id} className="border-t border-white/[0.04] pt-2 first:border-t-0 first:pt-0">
            <p className="text-[12px] text-white/60">
              <span className="me-1.5 text-white/40">{idx + 1}.</span>
              {isHe ? q.prompt_he : q.prompt_en ?? q.prompt_he}
            </p>
            <div className="mt-1 text-sm text-white/85">
              <AnswerCell question={q} answer={answers[q.id]} isHe={isHe} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function AnswerCell({
  question,
  answer,
  isHe,
}: {
  question: JourneyAssessmentQuestion;
  answer: unknown;
  isHe: boolean;
}) {
  if (answer === undefined || answer === null) {
    return (
      <span className="italic text-white/40">
        {isHe ? "לא נענה" : "Not answered"}
      </span>
    );
  }

  switch (question.kind) {
    case "single_choice": {
      if (typeof answer !== "string") return <UnknownCell />;
      const opt = question.options?.find((o) => o.key === answer);
      if (!opt) {
        return <code className="text-[12px] text-white/65">{answer}</code>;
      }
      return <span>{isHe ? opt.label_he : opt.label_en ?? opt.label_he}</span>;
    }

    case "multiple_choice": {
      if (!Array.isArray(answer)) return <UnknownCell />;
      const arr = answer as string[];
      if (arr.length === 0) {
        return (
          <span className="italic text-white/40">
            {isHe ? "אין בחירה" : "No selection"}
          </span>
        );
      }
      return (
        <ul className="flex flex-wrap gap-1.5">
          {arr.map((key) => {
            const opt = question.options?.find((o) => o.key === key);
            const label = opt
              ? isHe
                ? opt.label_he
                : opt.label_en ?? opt.label_he
              : key;
            return (
              <li
                key={key}
                className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[12px] text-white/85"
              >
                {label}
              </li>
            );
          })}
        </ul>
      );
    }

    case "scale": {
      if (typeof answer !== "number") return <UnknownCell />;
      const min = question.scale_min ?? 1;
      const max = question.scale_max ?? 7;
      const minLabel = isHe ? question.scale_min_label_he : question.scale_min_label_en;
      const maxLabel = isHe ? question.scale_max_label_he : question.scale_max_label_en;
      return (
        <span className="inline-flex items-baseline gap-2">
          <span className="font-bold tabular-nums text-white">
            {answer} <span className="text-white/45">/ {max}</span>
          </span>
          {(minLabel || maxLabel) && (
            <span className="text-[11px] text-white/45">
              ({min}={minLabel ?? "—"}, {max}={maxLabel ?? "—"})
            </span>
          )}
        </span>
      );
    }

    case "open_text": {
      if (typeof answer !== "string" || answer.trim().length === 0) {
        return (
          <span className="italic text-white/40">
            {isHe ? "ללא טקסט" : "Empty"}
          </span>
        );
      }
      return (
        <blockquote className="border-s-2 border-white/10 ps-2 text-sm text-white/85">
          {answer}
        </blockquote>
      );
    }

    case "ranking": {
      if (!Array.isArray(answer)) return <UnknownCell />;
      const arr = answer as string[];
      return (
        <ol className="flex flex-col gap-1">
          {arr.map((key, idx) => {
            const opt = question.options?.find((o) => o.key === key);
            const label = opt
              ? isHe
                ? opt.label_he
                : opt.label_en ?? opt.label_he
              : key;
            return (
              <li key={key} className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[11px] tabular-nums text-white/65">
                  {idx + 1}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      );
    }

    default:
      return <UnknownCell />;
  }
}

function UnknownCell() {
  return <span className="italic text-white/40">unknown shape</span>;
}
