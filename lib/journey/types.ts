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

/**
 * Product-level domain a question belongs to. Used by the assessment UI
 * to present results grouped by relationship area, and by the analysis
 * layer to compute per-domain scores. The 5 keys mirror the categories
 * already seeded in journey_categories (see q_priorities.categories in
 * questionnaire.json) - keeping a single namespace across the system.
 *
 * A question MAY be `domain: null` when it doesn't fit a single area -
 * e.g. demographic context (gender, relationship duration), meta
 * questions (priority ranking, perceived gap), or open reflections.
 * `null` keeps these questions in the flow without forcing an
 * artificial categorization.
 */
export type Domain =
  | "communication"
  | "intimacy"
  | "emotional_connection"
  | "friendship"
  | "family";

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
  | "reflection"
  | "ranking";

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
  domain: Domain | null;
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
  domain: Domain | null;
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
  domain: Domain | null;
  axes: AxisWeight[];
  purpose: string;
  insight?: string;
  he_prompt: string;
  en_prompt: string;
  max_length?: number;
}

/**
 * Ranking question - user reorders a fixed set of 5 categories by personal
 * priority. Each category has a stable English `key` that is what gets
 * stored in the answer; HE/EN labels and short descriptions live alongside
 * for the renderer. Doesn't drive any axis (`axes: []`).
 *
 * The `key`s here MUST match the seeded
 * journey_categories.assessment_priority_key values (see migration
 * 055) - and the PriorityKey literal-union in lib/journey/priorities.ts.
 * The validator on /api/journey/answer enforces that the answer is
 * exactly a permutation of those keys.
 */
export interface QuestionRankingCategory {
  key: string;
  he: string;
  en: string;
  he_desc: string;
  en_desc: string;
}

export interface QuestionRanking {
  id: string;
  category: QuestionCategory;
  type: "ranking";
  domain: Domain | null;
  axes: AxisWeight[]; // always [] for ranking - kept for shape-compatibility
  purpose: string;
  insight?: string;
  he_prompt: string;
  en_prompt: string;
  he_subline?: string;
  en_subline?: string;
  categories: QuestionRankingCategory[];
}

export type Question =
  | QuestionLikert
  | QuestionChoice
  | QuestionReflection
  | QuestionRanking;

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
  | { kind: "text"; text: string }
  /** Ordered list of stable category slugs; index 0 = highest priority.
   *  The server validator enforces it's a permutation of the
   *  PriorityKey literal-union in lib/journey/priorities.ts (which in
   *  turn is kept in sync with the DB seed in migration 055). */
  | { kind: "ranking"; order: string[] };

export interface Response {
  question_id: string;
  answer: AnswerValue;
  locale: Locale;
}

// --- Analysis output --------------------------------------------------------

export type AxisScoreMap = Partial<Record<Axis, number>>;

/**
 * Five-category scoring bundle (2026-06-02). Computed deterministically
 * alongside the legacy 3 scores (friendship/conflict/passion) to drive the
 * new bar-chart visualisation at the top of /journey/assessment. Each
 * value is 0..100 where higher = healthier. The lowest of the five is
 * tagged in `lowest_key` so the UI can render the "נקודת ההתחלה שלכם"
 * label next to it. Stored inside `summary` JSONB (no migration needed).
 */
export interface CategoryScores {
  communication: number;
  intimacy: number;
  emotional_connection: number;
  friendship: number;
  family: number;
  /** Lowest-scoring category, surfaced as the "starting point" in the UI. */
  lowest_key: "communication" | "intimacy" | "emotional_connection" | "friendship" | "family";
}

/**
 * AI-generated hero block (2026-06-02). Filled by Claude Sonnet 4.6 in
 * lib/ai/analyze-assessment.ts. Stored inside `summary` JSONB. When the
 * AI call fails or ANTHROPIC_API_KEY is missing this field is `null` and
 * the UI falls back to the deterministic narrative/recommendations.
 *
 * Voice rules baked into the prompt:
 *   - Benefit-stack only ("תקבלו / תרגישו / תתאהבו"), no process talk.
 *   - No em-dash, no foreign-feel ("אנחנו רואים", "מסע", "טרנספורמציה").
 *   - Vague time promises only ("מהר מאוד") - never N days/weeks.
 *   - Expert mention conditional on `expert_mentioned`.
 *   - Name + gender-correct pronouns when supplied.
 */
export interface AiHeroBlock {
  hero_he: string;
  hero_en: string;
  recommendations_he: string[];
  recommendations_en: string[];
  /** Whether the model chose to reference the in-chat expert ("מומחה
   *  צמוד זמין בצ'אט") - tracked for analytics and to let the expert
   *  dashboard show "this user was promised expert support". */
  expert_mentioned: boolean;
  /** Where the AI sourced the pain signal from. */
  pain_signal: "reflection" | "top_priority" | "horsemen" | "scores";
  model: string;
  generated_at: string;
  latency_ms: number;
}

export interface AnalysisSummaryBilingual {
  narrative_he: string;
  narrative_en: string;
  /** User's #1 chosen priority slug (PriorityKey) from the ranking step.
   *  Stored INSIDE `summary` JSONB so adding the field needs no DB
   *  migration. Older rows without it render the legacy top_gap fallback. */
  top_priority?: string;
  /** Resolved priority label in Hebrew, baked at compute time so the
   *  client component never needs to fetch it. v3 slice 1: replaces
   *  the dropped PRIORITY_LABELS_HE constant lookup. Null when no
   *  ranking was answered. */
  focus_label_he?: string | null;
  /** Resolved priority label in English. Same rules as focus_label_he. */
  focus_label_en?: string | null;
  recommendations: Array<{
    id: string;
    axis: Axis;
    priority: 1 | 2 | 3;
    he: string;
    en: string;
  }>;
  /** 5-category deterministic scoring bundle (2026-06-02). Always present. */
  category_scores?: CategoryScores;
  /** AI-generated hero block (2026-06-02). Null on AI failure -> UI falls
   *  back to narrative + deterministic recommendations. */
  ai_hero?: AiHeroBlock | null;
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
