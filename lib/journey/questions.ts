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
// Locks in the current distribution. As of 2026-05-21 the flow is
// 26 questions. Recent trims (per Itzik 2026-05-21):
//   - q18_shared_meaning_goals (family domain) removed
//   - q23_time_together (family domain) removed — quality-time question
//     was redundant with q17_passion_context / q19_rituals.
//   - q27_commitment_willingness (null domain) removed — explicit
//     "willing to invest 15-20 min/week?" question dropped to keep the
//     end of the flow focused on the priority ranking.
// Earlier trim (32→29 on 2026-05-07) removed q_kids_age,
// q_household_employment, and q_work_field; see B7.3 /journey/assessment
// overhaul.
//
// The breakdown remains uneven by design (Gottman's 4-Horsemen + repair
// + influence + pso fill `communication` with 7 items). `family` now
// has 2 items (kids count + 1 demographic item). Other domains land at 3-5.
//
// If a future edit to questionnaire.json reshuffles the distribution,
// this throws at module load so the mismatch surfaces in dev/build
// instead of silently rendering a wrong domain breakdown in the UI.
const EXPECTED_DOMAIN_COUNTS: Record<Domain, number> = {
  communication: 7,
  intimacy: 3,
  emotional_connection: 3,
  friendship: 4,
  family: 2,
};
// 2026-06-02 (Itzik) — q21_reflect_strength + q22_reflect_friction removed
// (the "closest moment / furthest moment" pair). q22a_success_signal
// rewritten ("מה חסר שתפתרו…"). Net: total 28 questions, null bucket = 9.
const EXPECTED_NULL_COUNT = 9;

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
