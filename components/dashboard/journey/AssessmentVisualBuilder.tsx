"use client";

/**
 * AssessmentVisualBuilder - drag-free WYSIWYG editor for the
 * questions inside an assessment_payload. Phase 3 step 5.
 *
 * Why drag-free: drag-and-drop on the web has cross-browser quirks
 * and requires a library. Up/down arrow buttons are robust, accessible,
 * and good enough for the 90th-percentile assessment (≤15 questions).
 *
 * Props/state model:
 *   - Receives the current `payload` (or null for blank slate).
 *   - On every change, emits the FULL updated payload via `onChange`.
 *     The parent (AssessmentEditor) decides when to save.
 *
 * Keeps the existing JSON editor as a power-user fallback in
 * AssessmentEditor - this component is the friendly default.
 */

import { useId } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  JourneyAssessmentPayload,
  JourneyAssessmentQuestion,
  JourneyAssessmentQuestionKind,
  JourneyAudience,
} from "@/lib/journey-content/types";

// ─────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────

export interface AssessmentValidationIssue {
  questionIdx: number | null;  // null = payload-level
  message: string;
}

/**
 * Validate the assessment payload. Returns list of issues (empty when
 * valid). Caller (AssessmentEditor) renders a summary + blocks save
 * when issues.length > 0.
 */
export function validateAssessmentPayload(
  p: JourneyAssessmentPayload | null,
): AssessmentValidationIssue[] {
  if (!p) return [{ questionIdx: null, message: "Payload is empty" }];
  const issues: AssessmentValidationIssue[] = [];
  const questions = p.questions ?? [];
  if (questions.length === 0) {
    issues.push({ questionIdx: null, message: "No questions defined" });
  }
  // Duplicate ids
  const seenIds = new Map<string, number>();
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.id || !q.id.trim()) {
      issues.push({ questionIdx: i, message: `Question ${i + 1}: missing id` });
    } else if (seenIds.has(q.id)) {
      issues.push({
        questionIdx: i,
        message: `Question ${i + 1}: duplicate id "${q.id}" (also #${seenIds.get(q.id)! + 1})`,
      });
    } else {
      seenIds.set(q.id, i);
    }
    if (!q.prompt_he || !q.prompt_he.trim()) {
      issues.push({
        questionIdx: i,
        message: `Question ${i + 1}: prompt_he is empty`,
      });
    }
    if (
      (q.kind === "single_choice" ||
        q.kind === "multiple_choice" ||
        q.kind === "ranking") &&
      (!q.options || q.options.length < 2)
    ) {
      issues.push({
        questionIdx: i,
        message: `Question ${i + 1}: ${q.kind} needs at least 2 options`,
      });
    }
    if (q.kind === "scale") {
      const min = q.scale_min ?? 1;
      const max = q.scale_max ?? 7;
      if (min >= max) {
        issues.push({
          questionIdx: i,
          message: `Question ${i + 1}: scale min (${min}) must be less than max (${max})`,
        });
      }
    }
  }
  return issues;
}

const QUESTION_KINDS: Array<{
  value: JourneyAssessmentQuestionKind;
  label: string;
}> = [
  { value: "single_choice", label: "Single choice (radio)" },
  { value: "multiple_choice", label: "Multiple choice (checkbox)" },
  { value: "scale", label: "Scale (1..N)" },
  { value: "open_text", label: "Open text" },
  { value: "ranking", label: "Ranking (drag-style)" },
];

const EMPTY_PAYLOAD: JourneyAssessmentPayload = {
  version: 1,
  questions: [],
};

export function AssessmentVisualBuilder({
  payload,
  onChange,
}: {
  payload: JourneyAssessmentPayload | null;
  onChange: (next: JourneyAssessmentPayload) => void;
}) {
  const current = payload ?? EMPTY_PAYLOAD;
  const questions = current.questions ?? [];

  const updateMeta = (patch: Partial<JourneyAssessmentPayload>) => {
    onChange({ ...current, ...patch });
  };

  const updateQuestions = (next: JourneyAssessmentQuestion[]) => {
    onChange({ ...current, questions: next });
  };

  const addQuestion = () => {
    const newQ: JourneyAssessmentQuestion = {
      id: `q${questions.length + 1}_${Math.random().toString(36).slice(2, 6)}`,
      kind: "single_choice",
      prompt_he: "",
      required: true,
      options: [
        { key: "yes", label_he: "כן" },
        { key: "no", label_he: "לא" },
      ],
    };
    updateQuestions([...questions, newQ]);
  };

  const removeQuestion = (idx: number) => {
    if (!confirm("Delete this question?")) return;
    updateQuestions(questions.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateQuestions(next);
  };

  const updateAt = (idx: number, q: JourneyAssessmentQuestion) => {
    const next = [...questions];
    next[idx] = q;
    updateQuestions(next);
  };

  return (
    <div className="space-y-4">
      {/* Intro / outro meta — bilingual */}
      <div className="space-y-3 rounded-md border border-border bg-card/30 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Intro (Hebrew)
            </label>
            <textarea
              value={current.intro_he ?? ""}
              onChange={(e) => updateMeta({ intro_he: e.target.value || null })}
              rows={2}
              dir="rtl"
              className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="טקסט פתיחה - אופציונלי"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Intro (English)
            </label>
            <textarea
              value={current.intro_en ?? ""}
              onChange={(e) => updateMeta({ intro_en: e.target.value || null })}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="Optional intro"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Outro (Hebrew)
            </label>
            <textarea
              value={current.outro_he ?? ""}
              onChange={(e) => updateMeta({ outro_he: e.target.value || null })}
              rows={2}
              dir="rtl"
              className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="טקסט סיום - אופציונלי"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Outro (English)
            </label>
            <textarea
              value={current.outro_en ?? ""}
              onChange={(e) => updateMeta({ outro_en: e.target.value || null })}
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
              placeholder="Optional outro"
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      <ol className="space-y-3">
        {questions.map((q, idx) => (
          <li key={q.id}>
            <QuestionCard
              q={q}
              idx={idx}
              total={questions.length}
              onChange={(next) => updateAt(idx, next)}
              onRemove={() => removeQuestion(idx)}
              onMove={(dir) => move(idx, dir)}
            />
          </li>
        ))}
      </ol>

      {/* Add question */}
      <button
        type="button"
        onClick={addQuestion}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add question
      </button>

      {questions.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          No questions yet. Click &ldquo;Add question&rdquo; to begin.
        </p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function QuestionCard({
  q,
  idx,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  q: JourneyAssessmentQuestion;
  idx: number;
  total: number;
  onChange: (next: JourneyAssessmentQuestion) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const idIn = useId();
  const setField = <K extends keyof JourneyAssessmentQuestion>(
    key: K,
    value: JourneyAssessmentQuestion[K],
  ) => {
    onChange({ ...q, [key]: value });
  };

  const onKindChange = (next: JourneyAssessmentQuestionKind) => {
    // When switching kinds, drop incompatible fields
    const base: JourneyAssessmentQuestion = {
      id: q.id,
      kind: next,
      prompt_he: q.prompt_he,
      prompt_en: q.prompt_en,
      required: q.required,
      audience: q.audience,
    };
    if (next === "single_choice" || next === "multiple_choice" || next === "ranking") {
      base.options = q.options ?? [
        { key: "opt1", label_he: "אפשרות 1" },
        { key: "opt2", label_he: "אפשרות 2" },
      ];
    }
    if (next === "scale") {
      base.scale_min = q.scale_min ?? 1;
      base.scale_max = q.scale_max ?? 7;
      base.scale_min_label_he = q.scale_min_label_he;
      base.scale_max_label_he = q.scale_max_label_he;
    }
    onChange(base);
  };

  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <header className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          Question {idx + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={idx === 0}
            aria-label="Move up"
            className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={idx === total - 1}
            aria-label="Move down"
            className="rounded p-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Delete"
            className="rounded p-1 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ID + kind row */}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${idIn}-id`}>
            Question id (stable, no spaces)
          </label>
          <input
            id={`${idIn}-id`}
            type="text"
            value={q.id}
            onChange={(e) => setField("id", e.target.value.trim())}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-[12px]"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${idIn}-kind`}>
            Kind
          </label>
          <select
            id={`${idIn}-kind`}
            value={q.kind}
            onChange={(e) =>
              onKindChange(e.target.value as JourneyAssessmentQuestionKind)
            }
            className="mt-1 rounded-md border border-border bg-background px-2 py-1 text-[12px]"
          >
            {QUESTION_KINDS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Prompts — HE + EN side-by-side */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${idIn}-prompt-he`}>
            Prompt (Hebrew, required)
          </label>
          <textarea
            id={`${idIn}-prompt-he`}
            value={q.prompt_he}
            onChange={(e) => setField("prompt_he", e.target.value)}
            rows={2}
            dir="rtl"
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            placeholder="...באיזו תדירות"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${idIn}-prompt-en`}>
            Prompt (English, optional)
          </label>
          <textarea
            id={`${idIn}-prompt-en`}
            value={q.prompt_en ?? ""}
            onChange={(e) => setField("prompt_en", e.target.value || null)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            placeholder="How often do you..."
          />
        </div>
      </div>

      {/* Required + Audience row */}
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
          <input
            type="checkbox"
            checked={q.required !== false}
            onChange={(e) => setField("required", e.target.checked)}
          />
          Required
        </label>
        <div className="inline-flex items-center gap-1.5">
          <label
            className="text-[11px] font-semibold text-muted-foreground"
            htmlFor={`${idIn}-audience`}
          >
            Audience
          </label>
          <select
            id={`${idIn}-audience`}
            value={q.audience ?? "both"}
            onChange={(e) =>
              setField("audience", e.target.value as JourneyAudience)
            }
            className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px]"
          >
            <option value="both">Both partners</option>
            <option value="owner">Owner only</option>
            <option value="partner">Partner only</option>
          </select>
        </div>
      </div>

      {/* Kind-specific fields */}
      {q.kind === "single_choice" || q.kind === "multiple_choice" || q.kind === "ranking" ? (
        <OptionsEditor
          options={q.options ?? []}
          onChange={(next) => setField("options", next)}
        />
      ) : null}

      {q.kind === "scale" ? (
        <ScaleEditor
          q={q}
          onChange={(patch) => onChange({ ...q, ...patch })}
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function OptionsEditor({
  options,
  onChange,
}: {
  options: NonNullable<JourneyAssessmentQuestion["options"]>;
  onChange: (next: NonNullable<JourneyAssessmentQuestion["options"]>) => void;
}) {
  const addOption = () => {
    const nextKey = `opt${options.length + 1}`;
    onChange([...options, { key: nextKey, label_he: "" }]);
  };
  const updateAt = (
    idx: number,
    patch: Partial<NonNullable<JourneyAssessmentQuestion["options"]>[number]>,
  ) => {
    const next = [...options];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const removeAt = (idx: number) => {
    onChange(options.filter((_, i) => i !== idx));
  };

  return (
    <div className="mt-3 space-y-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground">
        Options
      </label>
      {options.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">
          No options yet.
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {options.map((opt, idx) => (
          <li key={`${idx}-${opt.key}`} className="flex items-center gap-2">
            <input
              type="text"
              value={opt.key}
              onChange={(e) => updateAt(idx, { key: e.target.value.trim() })}
              placeholder="key"
              className="w-20 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px]"
            />
            <input
              type="text"
              value={opt.label_he}
              onChange={(e) => updateAt(idx, { label_he: e.target.value })}
              placeholder="תווית בעברית"
              dir="rtl"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <input
              type="text"
              value={opt.label_en ?? ""}
              onChange={(e) => updateAt(idx, { label_en: e.target.value || null })}
              placeholder="English label"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              aria-label="Remove option"
              className="rounded p-1 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addOption}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        Add option
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function ScaleEditor({
  q,
  onChange,
}: {
  q: JourneyAssessmentQuestion;
  onChange: (patch: Partial<JourneyAssessmentQuestion>) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground">
          Min value
        </label>
        <input
          type="number"
          value={q.scale_min ?? 1}
          onChange={(e) => onChange({ scale_min: Number(e.target.value) })}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground">
          Max value
        </label>
        <input
          type="number"
          value={q.scale_max ?? 7}
          onChange={(e) => onChange({ scale_max: Number(e.target.value) })}
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground">
          Min label (Hebrew)
        </label>
        <input
          type="text"
          value={q.scale_min_label_he ?? ""}
          onChange={(e) =>
            onChange({ scale_min_label_he: e.target.value || null })
          }
          placeholder="כלל לא"
          dir="rtl"
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground">
          Max label (Hebrew)
        </label>
        <input
          type="text"
          value={q.scale_max_label_he ?? ""}
          onChange={(e) =>
            onChange({ scale_max_label_he: e.target.value || null })
          }
          placeholder="מאוד"
          dir="rtl"
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground">
          Min label (English)
        </label>
        <input
          type="text"
          value={q.scale_min_label_en ?? ""}
          onChange={(e) =>
            onChange({ scale_min_label_en: e.target.value || null })
          }
          placeholder="Not at all"
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-muted-foreground">
          Max label (English)
        </label>
        <input
          type="text"
          value={q.scale_max_label_en ?? ""}
          onChange={(e) =>
            onChange({ scale_max_label_en: e.target.value || null })
          }
          placeholder="Very much"
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Validation summary — exported for AssessmentEditor to render
// ─────────────────────────────────────────────────────────────────────

export function ValidationSummary({
  issues,
}: {
  issues: AssessmentValidationIssue[];
}) {
  if (issues.length === 0) {
    return (
      <div className="rounded-md border border-emerald-300/30 bg-emerald-500/[0.06] p-3 text-xs text-emerald-700 dark:text-emerald-200">
        ✓ Assessment is valid — ready to save.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-amber-300/40 bg-amber-500/[0.06] p-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-100">
        <AlertCircle className="h-3.5 w-3.5" />
        {issues.length} issue{issues.length === 1 ? "" : "s"} — fix before save
      </div>
      <ul className="mt-2 space-y-1 text-[11px] text-amber-800 dark:text-amber-100/90">
        {issues.map((iss, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span aria-hidden>•</span>
            <span>{iss.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
