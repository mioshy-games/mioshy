/**
 * lib/assessments/catalog.ts
 *
 * Registry of the standalone assessments. Each is a separate product.
 * Only `live: true` assessments are startable on the hub; others render as
 * "בקרוב" (coming soon).
 *
 * v1 (2026-06-07): only `intimacy` is live. communication / compatibility /
 * family banks land after intimacy is approved.
 */

import type { AssessmentDef, AssessmentQuestion, Locale } from "./types";
import { INTIMACY_ASSESSMENT } from "./banks/intimacy";

export const ASSESSMENTS: AssessmentDef[] = [INTIMACY_ASSESSMENT];

export function listAssessments(): AssessmentDef[] {
  return ASSESSMENTS;
}

export function getAssessment(id: string): AssessmentDef | undefined {
  return ASSESSMENTS.find((a) => a.id === id);
}

export function getAssessmentQuestion(
  assessmentId: string,
  questionId: string,
): AssessmentQuestion | undefined {
  return getAssessment(assessmentId)?.questions.find((q) => q.id === questionId);
}

export function totalQuestions(assessmentId: string): number {
  return getAssessment(assessmentId)?.total ?? 0;
}

/** Prompt text in a locale (likert uses he/en; reflection uses *_prompt). */
export function promptFor(q: AssessmentQuestion, locale: Locale): string {
  if (q.type === "likert5") return locale === "he" ? q.he : q.en;
  return locale === "he" ? q.he_prompt : q.en_prompt;
}
