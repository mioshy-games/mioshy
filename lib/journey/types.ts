/**
 * lib/journey/types.ts
 * Shared types for the Seven Principles journey questionnaire + analysis engine.
 */

export type Locale = "he" | "en";

export type Axis =
  | "love_map"
  | "fondness"
  | "turn_toward"
  | "pso"
  | "influence"
  | "repair"
  | "shared_meaning"
  | "four_horsemen_criticism"
  | "four_horsemen_contempt"
  | "four_horsemen_defensive"
  | "four_horsemen_stonewall"
  | "love_language_words"
  | "love_language_time"
  | "love_language_service"
  | "love_language_touch"
  | "love_language_gifts"
  | "passion_autonomy"
  | "passion_anticipation"
  | "passion_play"
  | "passion_context";

export type LoveLanguage =
  | "love_language_words"
  | "love_language_time"
  | "love_language_service"
  | "love_language_touch"
  | "love_language_gifts";

export type QuestionCategory = "free" | "registered" | "paid";

export type QuestionType =
  | "likert5"
  | "forced_choice"
  | "single_choice"
  | "multi_choice"
  | "reflection";

export interface AxisWeight {
  axis: Axis;
  weight: number;
}

export interface QuestionOption {
  id: string;
  he: string;
  en: string;
  scores: AxisWeight[];
}

export interface QuestionLikert {
  id: string;
  category: QuestionCategory;
  type: "likert5";
  axes: AxisWeight[];
  purpose: string;
  insight?: string;
  he: string;
  en: string;
}

export interface QuestionChoice {
  id: string;
  category: QuestionCategory;
  type: "forced_choice" | "single_choice" | "multi_choice";
  axes: AxisWeight[];
  purpose: string;
  insight?: string;
  he_prompt: string;
  en_prompt: string;
  options: QuestionOption[];
}

export interface QuestionReflection {
  id: string;
  category: QuestionCategory;
  type: "reflection";
  axes: AxisWeight[];
  purpose: string;
  insight?: string;
  he_prompt: string;
  en_prompt: string;
  max_length?: number;
}

export type Question = QuestionLikert | QuestionChoice | QuestionReflection;

export interface QuestionnaireGating {
  auth_after_index: number; // zero-based index after which auth is required
  paywall_after_index: number; // zero-based index after which paywall is required
}

export interface Questionnaire {
  version: number;
  gating: QuestionnaireGating;
  total_questions: number;
  locales: Locale[];
  likert_labels: Record<Locale, string[]>;
  questions: Question[];
}

// --- Answer shapes stored in journey_responses.answer JSONB -----------------

export type AnswerValue =
  | { kind: "likert"; value: 1 | 2 | 3 | 4 | 5 }
  | { kind: "single"; option: string }
  | { kind: "multi"; options: string[] }
  | { kind: "text"; text: string };

export interface Response {
  question_id: string;
  answer: AnswerValue;
  locale: Locale;
}

// --- Analysis output --------------------------------------------------------

export type AxisScoreMap = Partial<Record<Axis, number>>;

export interface AnalysisSummaryBilingual {
  narrative_he: string;
  narrative_en: string;
  recommendations: Array<{
    id: string;
    axis: Axis;
    priority: 1 | 2 | 3;
    he: string;
    en: string;
  }>;
}

export interface Analysis {
  axis_scores: AxisScoreMap;
  friendship_score: number; // 0..100
  conflict_health: number; // 0..100
  passion_risk: number; // 0..100 (higher = more at risk)
  primary_love_language: LoveLanguage | null;
  secondary_love_language: LoveLanguage | null;
  top_gap: Axis | null;
  four_horsemen_flag: boolean;
  summary: AnalysisSummaryBilingual;
}
