/**
 * lib/assessments/types.ts
 *
 * Types for the standalone "Assessments" product line. Each assessment is a
 * separate product (intimacy, communication, compatibility, family) with its
 * own bank of 21 questions: 20 closed Likert in 5 dimensions × 4, plus one
 * open reflection (Q21) handed to the coaching team.
 *
 * We deliberately reuse the Journey question shapes (`Question`, `AnswerValue`,
 * `Locale`, `AiHeroBlock`) so the proven QuestionStep / answer-shape / AI hero
 * pieces work unchanged. The SCORING is new (dimension-based, see scoring.ts).
 */

import type {
  AnswerValue,
  Locale,
  AiHeroBlock,
  QuestionLikert,
  QuestionReflection,
} from "@/lib/journey/types";

export type { AnswerValue, Locale, AiHeroBlock };

/**
 * A dimension (ממד) groups 4 Likert questions. Score is 0..100, higher =
 * stronger. `key` is stable (English slug) and written to the DB.
 */
export interface DimensionDef {
  key: string;
  he: string;
  en: string;
}

/**
 * A closed Likert question, structurally compatible with QuestionLikert so it
 * renders through the shared QuestionStep. Adds `dimension` (which ממד it
 * feeds) and `reverse` (reverse-scored — value 5↔1 — for `[הפוך]` items).
 */
export type AssessmentLikert = QuestionLikert & {
  dimension: string;
  reverse?: boolean;
};

/** The single open reflection (Q21). Not scored; sent to the coaching team. */
export type AssessmentReflection = QuestionReflection & {
  /** Marks the open question so scoring/AI can find it without a hard id. */
  isOpen: true;
};

export type AssessmentQuestion = AssessmentLikert | AssessmentReflection;

export interface AssessmentDef {
  /** Stable slug; written to assessment_sessions.assessment_id and the URL. */
  id: string;
  he_title: string;
  en_title: string;
  he_tagline: string;
  en_tagline: string;
  /** Whether this assessment is live (shown as startable on the hub). */
  live: boolean;
  dimensions: DimensionDef[];
  questions: AssessmentQuestion[];
  /** Total questions incl. the open one (always 21 for v1). */
  total: number;
}

// --- Analysis output ---------------------------------------------------------

export interface DimensionScore {
  key: string;
  he: string;
  en: string;
  /** 0..100, higher = stronger foundation. */
  score: number;
}

/** Stored in assessment_results.summary (JSONB). */
export interface AssessmentSummary {
  dimension_scores: DimensionScore[];
  /** 3 lowest-scoring dimension keys, in ascending score order. */
  weakest_keys: string[];
  open_answer: string;
  /** AI benefit-stack hero. Null on AI failure → UI falls back to a
   *  deterministic recommendation built from the weakest dimension. */
  ai_hero: AiHeroBlock | null;
}

export interface AssessmentAnalysis {
  assessment_id: string;
  dimension_scores: DimensionScore[];
  weakest_keys: string[];
  open_answer: string;
  summary: AssessmentSummary;
}

// --- Admin question editing --------------------------------------------------

/** Shape the admin sends to upsert a question. Lives here (not in the
 *  "use server" actions file) so it can be imported by client components. */
export interface QuestionInput {
  assessment_id: string;
  slug: string;
  position: number;
  dimension_key: string | null;
  type: "likert5" | "reflection";
  reverse: boolean;
  is_open: boolean;
  text_he: string;
  text_en: string;
  source_slugs: string;
  is_active: boolean;
}

// --- Stored answer rows (from assessment_responses) --------------------------

export interface AssessmentResponse {
  question_id: string;
  answer: AnswerValue;
  locale: Locale;
}
