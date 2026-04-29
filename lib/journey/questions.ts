/**
 * lib/journey/questions.ts
 * Loads the questionnaire bank. The JSON is the source of truth — edit
 * journey/questionnaire.json, not this file.
 */

import rawQuestionnaire from "@/journey/questionnaire.json";
import type { Question, Questionnaire, Locale } from "./types";

export const QUESTIONNAIRE: Questionnaire = rawQuestionnaire as Questionnaire;

export const QUESTIONS: Question[] = QUESTIONNAIRE.questions;

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id);
}

export function getQuestionAt(index: number): Question | undefined {
  return QUESTIONS[index];
}

export function totalQuestions(): number {
  return QUESTIONS.length;
}

/** Translate helper: returns the prompt text of a question in a given locale. */
export function promptFor(q: Question, locale: Locale): string {
  if (q.type === "likert5") {
    return locale === "he" ? q.he : q.en;
  }
  return locale === "he" ? q.he_prompt : q.en_prompt;
}

/** Translate helper: Likert label (e.g. "Often") for a value 1..5. */
export function likertLabel(value: 1 | 2 | 3 | 4 | 5, locale: Locale): string {
  const labels = QUESTIONNAIRE.likert_labels[locale];
  return labels[value - 1] ?? String(value);
}

/** Does the given zero-based index require auth BEFORE answering? */
export function requiresAuthAt(index: number): boolean {
  return index > QUESTIONNAIRE.gating.auth_after_index;
}

/** Does the given zero-based index require an active subscription BEFORE answering? */
export function requiresPaywallAt(index: number): boolean {
  return index > QUESTIONNAIRE.gating.paywall_after_index;
}
