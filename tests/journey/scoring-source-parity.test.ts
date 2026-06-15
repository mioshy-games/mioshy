/**
 * F1 identical-result test (CONTINUITY PROOF).
 *
 * journey scoring is a LIVE path. F1 lets analyze() resolve question
 * definitions from the DB (journey_questions) instead of the bundled
 * questionnaire.json — WITHOUT changing the scoring math. This test proves the
 * switch is behaviour-preserving: running analyze() on a FIXED set of sample
 * responses yields a BYTE-IDENTICAL Analysis whether the question defs come
 * from the JSON (default getQuestion) or from the DB-mapped loader.
 *
 * How the "DB" side is simulated without a database:
 *   1. Take the real static questions for the sampled slugs.
 *   2. Project each into the exact row shape migration 118 stores
 *      (he/en → he_text/en_text, axes/options verbatim, purpose/insight/
 *      max_length/sublines/categories → meta), then JSON round-trip it to
 *      mimic Postgres jsonb (which also normalises 1.0 → 1, -1.0 → -1).
 *   3. Feed those rows through the REAL loader mapper (rowToJourneyQuestion)
 *      and build the resolver the route uses (buildQuestionResolver).
 *
 * The sample deliberately includes:
 *   - q17_context_logistics — NEGATIVE weight (passion_context, -1.0)
 *   - q24_physical_closeness — MULTI-AXIS (love_language_touch + passion_play)
 *   - a single_choice with option-level scores (q20_biggest_gap)
 *   - a ranking (q_priorities) so top_priority/focus labels are exercised
 *   - coverage across all 5 domains + several love languages.
 */

import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/journey/analysis";
import { getQuestion } from "@/lib/journey/questions";
import {
  rowToJourneyQuestion,
  buildQuestionResolver,
  type JourneyQuestionRow,
} from "@/lib/journey/questions-db";
import type {
  Question,
  QuestionOption,
  Response,
} from "@/lib/journey/types";
import type {
  PriorityKey,
} from "@/lib/journey/priorities";
import type { PriorityLabelsBundle } from "@/lib/journey-content/priority-categories";

// ── Fixed sample responses ───────────────────────────────────────────────────
// Each referenced slug must exist in questionnaire.json. Values are arbitrary
// but fixed so both runs see identical input.
const SAMPLE_RESPONSES: Response[] = [
  { question_id: "q01_knowledge_world", answer: { kind: "likert", value: 4 }, locale: "he" }, // love_map (emotional_connection)
  { question_id: "q02_admiration_see_good", answer: { kind: "likert", value: 2 }, locale: "he" }, // fondness
  { question_id: "q03_bids_turn_toward", answer: { kind: "likert", value: 5 }, locale: "he" }, // turn_toward (friendship)
  { question_id: "q09_repair_recovery", answer: { kind: "likert", value: 2 }, locale: "he" }, // repair (communication)
  { question_id: "q11_contempt", answer: { kind: "likert", value: 4 }, locale: "he" }, // horseman_contempt
  { question_id: "q13_stonewall", answer: { kind: "likert", value: 3 }, locale: "he" }, // horseman_stonewall
  { question_id: "q15_anticipation", answer: { kind: "likert", value: 1 }, locale: "he" }, // passion_anticipation (intimacy)
  { question_id: "q16_play", answer: { kind: "likert", value: 3 }, locale: "he" }, // passion_play (friendship)
  { question_id: "q17_context_logistics", answer: { kind: "likert", value: 5 }, locale: "he" }, // passion_context NEGATIVE weight
  { question_id: "q19_rituals", answer: { kind: "likert", value: 2 }, locale: "he" }, // shared_meaning (weight 0.5)
  { question_id: "q24_physical_closeness", answer: { kind: "likert", value: 4 }, locale: "he" }, // MULTI-AXIS: touch + play
  { question_id: "q25_gratitude_expressed", answer: { kind: "likert", value: 3 }, locale: "he" }, // MULTI-AXIS: fondness + words
  { question_id: "q20_biggest_gap", answer: { kind: "single", option: "passion" }, locale: "he" }, // single_choice w/ option scores
  { question_id: "q_priorities", answer: { kind: "ranking", order: ["intimacy", "communication", "friendship", "emotional_connection", "family"] }, locale: "he" },
];

// ── Fixed priority labels bundle (identical for both runs) ────────────────────
const KEYS: PriorityKey[] = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
];
function rec(suffix: string): Record<PriorityKey, string> {
  return Object.fromEntries(KEYS.map((k) => [k, `${k}_${suffix}`])) as Record<
    PriorityKey,
    string
  >;
}
const PRIORITY_LABELS: PriorityLabelsBundle = {
  labelsHe: rec("he"),
  labelsEn: rec("en"),
  descsHe: rec("desc_he"),
  descsEn: rec("desc_en"),
  canonicalOrder: KEYS,
};

// ── Project a static Question into the migration-118 row shape ────────────────
// Mirrors what the seed stores, then JSON round-trips to mimic jsonb storage
// (numeric normalisation, key reordering, etc.).
function questionToRow(q: Question): JourneyQuestionRow {
  const isLikert = q.type === "likert5";
  const he_text = isLikert ? q.he : q.he_prompt;
  const en_text = isLikert ? q.en : q.en_prompt;

  const meta: Record<string, unknown> = { purpose: q.purpose };
  if (q.insight !== undefined) meta.insight = q.insight;
  if (q.type === "reflection" && q.max_length !== undefined) {
    meta.max_length = q.max_length;
  }
  if (q.type === "ranking") {
    if (q.he_subline !== undefined) meta.he_subline = q.he_subline;
    if (q.en_subline !== undefined) meta.en_subline = q.en_subline;
    meta.categories = q.categories;
  }

  const options: QuestionOption[] | null =
    q.type === "forced_choice" ||
    q.type === "single_choice" ||
    q.type === "multi_choice"
      ? q.options
      : null;

  const row: JourneyQuestionRow = {
    slug: q.id,
    position: 0, // order is irrelevant to scoring; resolver is keyed by slug
    phase: "full",
    type: q.type,
    domain: q.domain,
    axes: q.axes,
    reverse: false,
    he_text,
    en_text,
    options,
    meta: meta as JourneyQuestionRow["meta"],
    is_active: true,
  };

  // Simulate a Postgres jsonb store/load round-trip on the JSON-bearing fields.
  return JSON.parse(JSON.stringify(row)) as JourneyQuestionRow;
}

describe("F1 scoring-source parity (JSON vs DB-mapped loader)", () => {
  it("analyze() is byte-identical from JSON and from DB-mapped questions", () => {
    // DB side: build rows for exactly the sampled slugs, map via the REAL
    // loader mapper, build the resolver the route uses.
    const slugs = Array.from(new Set(SAMPLE_RESPONSES.map((r) => r.question_id)));
    const rows = slugs.map((slug) => {
      const q = getQuestion(slug);
      if (!q) throw new Error(`sample references unknown slug: ${slug}`);
      return questionToRow(q);
    });
    const dbQuestions = rows.map(rowToJourneyQuestion);
    const resolveFromDb = buildQuestionResolver(dbQuestions);

    const fromJson = analyze(SAMPLE_RESPONSES, PRIORITY_LABELS); // default getQuestion
    const fromDb = analyze(SAMPLE_RESPONSES, PRIORITY_LABELS, resolveFromDb);

    // Full structural equality across the ENTIRE Analysis: axis_scores, all
    // derived metrics, top_gap, love languages, summary incl. category_scores
    // + lowest_key.
    expect(fromDb).toStrictEqual(fromJson);

    // Spot-checks so a regression names the broken sub-result.
    expect(fromDb.axis_scores).toStrictEqual(fromJson.axis_scores);
    expect(fromDb.top_gap).toBe(fromJson.top_gap);
    expect(fromDb.summary.category_scores).toStrictEqual(
      fromJson.summary.category_scores,
    );
    expect(fromDb.summary.category_scores?.lowest_key).toBe(
      fromJson.summary.category_scores?.lowest_key,
    );
    expect(fromDb.summary.top_priority).toBe(fromJson.summary.top_priority);
  });

  it("negative-weight (q17) and multi-axis (q24) axes are present and equal", () => {
    const slugs = Array.from(new Set(SAMPLE_RESPONSES.map((r) => r.question_id)));
    const rows = slugs.map((slug) => questionToRow(getQuestion(slug)!));
    const resolveFromDb = buildQuestionResolver(rows.map(rowToJourneyQuestion));

    const fromJson = analyze(SAMPLE_RESPONSES, PRIORITY_LABELS);
    const fromDb = analyze(SAMPLE_RESPONSES, PRIORITY_LABELS, resolveFromDb);

    // q17 → passion_context (negative weight path), q24 → touch + play.
    for (const axis of [
      "passion_context",
      "love_language_touch",
      "passion_play",
    ] as const) {
      expect(fromDb.axis_scores[axis]).toBeTypeOf("number");
      expect(fromDb.axis_scores[axis]).toBe(fromJson.axis_scores[axis]);
    }
  });
});
