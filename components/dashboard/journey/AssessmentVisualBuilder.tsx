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
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  JourneyAssessmentPayload,
  JourneyAssessmentQuestion,
  JourneyAssessmentQuestionKind,
} from "@/lib/journey-content/types";

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
      {/* Intro / outro meta */}
      <div className="space-y-3 rounded-md border border-border bg-card/30 p-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Intro (Hebrew)
          </label>
          <textarea
            value={current.intro_he ?? ""}
            onChange={(e) => updateMeta({ intro_he: e.target.value || null })}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            placeholder="טקסט פתיחה - אופציונלי"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Outro (Hebrew)
          </label>
          <textarea
            value={current.outro_he ?? ""}
            onChange={(e) => updateMeta({ outro_he: e.target.value || null })}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
            placeholder="טקסט סיום - אופציונלי"
          />
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

      {/* Prompt */}
      <div className="mt-3">
        <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${idIn}-prompt`}>
          Prompt (Hebrew, required)
        </label>
        <textarea
          id={`${idIn}-prompt`}
          value={q.prompt_he}
          onChange={(e) => setField("prompt_he", e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
          placeholder="...באיזו תדירות"
        />
      </div>

      {/* Required toggle */}
      <div className="mt-2">
        <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
          <input
            type="checkbox"
            checked={q.required !== false}
            onChange={(e) => setField("required", e.target.checked)}
          />
          Required
        </label>
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
              className="w-24 rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px]"
            />
            <input
              type="text"
              value={opt.label_he}
              onChange={(e) => updateAt(idx, { label_he: e.target.value })}
              placeholder="תווית"
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
          className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
      </div>
    </div>
  );
}
