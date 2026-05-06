/**
 * lib/journey/questions.ts
 * Loads the questionnaire bank. The JSON is the source of truth - edit
 * journey/questionnaire.json, not this file.
 */

import rawQuestionnaire from "@/journey/questionnaire.json";
import type { Domain, Question, Questionnaire, Locale } from "./types";

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

// --- Domain helpers ---------------------------------------------------------
//
// Phase 2 grouping layer: every question carries a `domain` (or `null` for
// demographics / meta / open reflections). The 5 product domains mirror the
// keys already seeded for q_priorities.categories, so the assessment UI,
// the priority ranking, and the future domain-aware analysis layer all
// share one namespace.
//
// `getQuestionsByDomain` returns ALL questions in a domain - including
// demographic context items mapped into `family`, which don't carry axes.
// Use `getDiagnosticQuestionsByDomain` when you need only the items that
// contribute to scoring.

const DOMAINS: Domain[] = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
];

/** All questions tagged with the given domain (diagnostic + non-diagnostic). */
export function getQuestionsByDomain(domain: Domain): Question[] {
  return QUESTIONS.filter((q) => q.domain === domain);
}

/** Questions in a domain that actually feed an axis score. Excludes the
 *  demographic family/work items that share `domain: "family"` but have
 *  empty `axes`. */
export function getDiagnosticQuestionsByDomain(domain: Domain): Question[] {
  return QUESTIONS.filter(
    (q) => q.domain === domain && q.axes && q.axes.length > 0,
  );
}

/** Total question count per domain (incl. non-diagnostic). Used by tests
 *  and the build-time assertion below. */
export function getDomainCount(): Record<Domain, number> {
  const out = {} as Record<Domain, number>;
  for (const d of DOMAINS) out[d] = 0;
  for (const q of QUESTIONS) {
    if (q.domain !== null) out[q.domain] += 1;
  }
  return out;
}

/** Diagnostic-only count per domain (axes.length > 0). */
export function getDiagnosticDomainCount(): Record<Domain, number> {
  const out = {} as Record<Domain, number>;
  for (const d of DOMAINS) out[d] = 0;
  for (const q of QUESTIONS) {
    if (q.domain !== null && q.axes && q.axes.length > 0) out[q.domain] += 1;
  }
  return out;
}

// --- Build-time assertion ---------------------------------------------------
//
// Locks in the current distribution. As of 2026-05-05 the flow is
// 32 questions (down from 35 - the three forced-choice love-language
// pairs q04/q05/q06 were removed when the love-language card was
// dropped from the analysis summary; see
// docs/journey-ux-followups-2026-05-05.md).
//
// The breakdown remains uneven by design (Gottman's 4-Horsemen + repair
// + influence + pso fill `communication` with 7 items, while `family`
// reaches 7 by folding in demographic context - kids count, kids age,
// household employment, work field). Other domains now land at 3.
//
// If a future edit to questionnaire.json reshuffles the distribution,
// this throws at module load so the mismatch surfaces in dev/build
// instead of silently rendering a wrong domain breakdown in the UI.
const EXPECTED_DOMAIN_COUNTS: Record<Domain, number> = {
  communication: 7,
  intimacy: 3,
  emotional_connection: 3,
  friendship: 5,
  family: 7,
};
const EXPECTED_NULL_COUNT = 7;

(function assertDomainDistribution() {
  const actual = getDomainCount();
  const nullCount = QUESTIONS.filter((q) => q.domain === null).length;
  const mismatches: string[] = [];
  for (const d of DOMAINS) {
    if (actual[d] !== EXPECTED_DOMAIN_COUNTS[d]) {
      mismatches.push(`${d}: expected ${EXPECTED_DOMAIN_COUNTS[d]}, got ${actual[d]}`);
    }
  }
  if (nullCount !== EXPECTED_NULL_COUNT) {
    mismatches.push(`null: expected ${EXPECTED_NULL_COUNT}, got ${nullCount}`);
  }
  if (mismatches.length > 0) {
    throw new Error(
      `[questionnaire] domain distribution mismatch:\n  ${mismatches.join("\n  ")}`,
    );
  }
})();
