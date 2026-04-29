"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Question, QuestionChoice, QuestionReflection, AnswerValue, Locale } from "@/lib/journey/types";
import { likertLabel, promptFor } from "@/lib/journey/questions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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
      setError(isHe ? "בחר/י תשובה כדי להמשיך" : "Select an answer to continue");
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
      transition={{ duration: 0.18 }}
      className="flex w-full max-w-2xl flex-col gap-6"
      dir={isHe ? "rtl" : "ltr"}
    >
      <h2 className="text-xl font-semibold leading-snug text-white md:text-2xl drop-shadow-sm">
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
        <ReflectionControl question={question as QuestionReflection} locale={locale} value={answer} onChange={setAnswer} />
      )}

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {/* Show Continue button only for non-auto-advance types */}
      {!isAutoAdvance ? (
        <Button onClick={submit} disabled={busy} size="lg" className="w-full md:w-auto">
          {busy
            ? isHe ? "שומר/ת…" : "Saving…"
            : isHe ? "המשך" : "Continue"}
        </Button>
      ) : busy ? (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
          {isHe ? "שומר/ת…" : "Saving…"}
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
  return (
    <div className="grid grid-cols-5 gap-2">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          type="button"
          key={n}
          onClick={() => !busy && onChange({ kind: "likert", value: n })}
          disabled={busy}
          className={`flex flex-col items-center rounded-2xl border px-2 py-3 text-sm transition active:scale-95 ${
            current === n
              ? "border-fuchsia-400/70 bg-fuchsia-500/25 text-white ring-2 ring-fuchsia-400/50"
              : "border-white/12 bg-slate-800/70 text-white/80 hover:bg-slate-700/70 hover:border-white/20"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <span className="text-lg font-semibold">{n}</span>
          <span className="mt-1 text-sm leading-tight">{likertLabel(n, locale)}</span>
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
  return (
    <div className="flex flex-col gap-2">
      {question.options.map((opt) => (
        <button
          type="button"
          key={opt.id}
          onClick={() => !busy && onChange({ kind: "single", option: opt.id })}
          disabled={busy}
          className={`rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] ${
            current === opt.id
              ? "border-fuchsia-400/70 bg-fuchsia-500/20 text-white ring-2 ring-fuchsia-400/50"
              : "border-white/12 bg-slate-800/70 text-white/85 hover:bg-slate-700/70 hover:border-white/20"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {locale === "he" ? opt.he : opt.en}
        </button>
      ))}
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
  return (
    <div className="flex flex-col gap-2">
      {question.options.map((opt) => (
        <button
          type="button"
          key={opt.id}
          onClick={() => toggle(opt.id)}
          className={`rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] ${
            current.includes(opt.id)
              ? "border-fuchsia-400/70 bg-fuchsia-500/20 text-white"
              : "border-white/12 bg-slate-800/70 text-white/85 hover:bg-slate-700/70 hover:border-white/20"
          }`}
        >
          <span className={`me-2 inline-block h-4 w-4 rounded border align-middle ${current.includes(opt.id) ? "border-fuchsia-400 bg-fuchsia-500" : "border-white/30"}`} />
          {locale === "he" ? opt.he : opt.en}
        </button>
      ))}
    </div>
  );
}

function ReflectionControl({
  question,
  locale,
  value,
  onChange,
}: {
  question: QuestionReflection;
  locale: Locale;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
}) {
  const text = value?.kind === "text" ? value.text : "";
  return (
    <Textarea
      value={text}
      onChange={(e) => onChange({ kind: "text", text: e.target.value })}
      maxLength={question.max_length ?? 600}
      rows={5}
      placeholder={locale === "he" ? "כתוב/י בחופשיות…" : "Write freely…"}
      className="bg-slate-800/70 border-white/12 text-white placeholder:text-white/40 focus-visible:border-fuchsia-400/60 focus-visible:ring-fuchsia-400/20"
    />
  );
}
