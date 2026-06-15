/**
 * F3.1 render-from-DB parity (GATE — touches the live funnel render).
 *
 * Proves the questionnaire RENDER input is byte-identical to today when the DB
 * equals the F1 seed, and that the JSON fallback path is preserved.
 *
 * What the render actually consumes per question (JourneyClient + QuestionStep):
 *   id, type, domain, the prompt text (he/en for likert5; he_prompt/en_prompt
 *   otherwise), options (id/he/en for choice types), max_length + placeholders
 *   (reflection), categories (ranking), and ORDER. `category` is NOT read by
 *   render (verified), so it's excluded from the projection.
 *
 * DB side is simulated by projecting the static questions into the migration-118
 * row shape, JSON round-tripping (mimics Postgres jsonb), then mapping back
 * through the REAL loader mapper (rowToJourneyQuestion).
 */

import { describe, it, expect } from "vitest";
import { QUESTIONS as STATIC_QUESTIONS } from "@/lib/journey/questions";
import {
  rowToJourneyQuestion,
  loadJourneyQuestions,
  type JourneyQuestionRow,
} from "@/lib/journey/questions-db";
import type { Question } from "@/lib/journey/types";

// Project a static Question into the migration-118 row shape (what the seed
// stores), then jsonb round-trip.
function questionToRow(q: Question, position: number): JourneyQuestionRow {
  const isLikert = q.type === "likert5";
  const he_text = isLikert ? q.he : q.he_prompt;
  const en_text = isLikert ? q.en : q.en_prompt;

  const meta: Record<string, unknown> = { purpose: q.purpose };
  if (q.insight !== undefined) meta.insight = q.insight;
  if (q.type === "reflection") {
    if (q.max_length !== undefined) meta.max_length = q.max_length;
    if (q.placeholder_he !== undefined) meta.placeholder_he = q.placeholder_he;
    if (q.placeholder_en !== undefined) meta.placeholder_en = q.placeholder_en;
  }
  if (q.type === "ranking") {
    if (q.he_subline !== undefined) meta.he_subline = q.he_subline;
    if (q.en_subline !== undefined) meta.en_subline = q.en_subline;
    meta.categories = q.categories;
  }

  const options =
    q.type === "forced_choice" || q.type === "single_choice" || q.type === "multi_choice"
      ? q.options
      : null;

  const row: JourneyQuestionRow = {
    slug: q.id,
    position,
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
  return JSON.parse(JSON.stringify(row)) as JourneyQuestionRow;
}

// Pick exactly the fields the RENDER uses (excludes `category`, axes/scores).
function renderProjection(q: Question) {
  const base = { id: q.id, type: q.type, domain: q.domain };
  if (q.type === "likert5") return { ...base, he: q.he, en: q.en };
  if (q.type === "reflection")
    return {
      ...base,
      he_prompt: q.he_prompt,
      en_prompt: q.en_prompt,
      max_length: q.max_length,
      placeholder_he: q.placeholder_he,
      placeholder_en: q.placeholder_en,
    };
  if (q.type === "ranking")
    return {
      ...base,
      he_prompt: q.he_prompt,
      en_prompt: q.en_prompt,
      he_subline: q.he_subline,
      en_subline: q.en_subline,
      categories: q.categories,
    };
  // choice types
  return {
    ...base,
    he_prompt: q.he_prompt,
    en_prompt: q.en_prompt,
    options: q.options.map((o) => ({ id: o.id, he: o.he, en: o.en })),
  };
}

// Minimal chainable loader-client mock (mirrors the F2 cms test).
function loaderClient(rows: JourneyQuestionRow[] | null, error: { message: string } | null = null) {
  const b: Record<string, unknown> = {};
  Object.assign(b, {
    select: () => b,
    eq: () => b,
    order: () => b,
    then: (resolve: (v: { data: JourneyQuestionRow[] | null; error: unknown }) => void) =>
      resolve({ data: rows, error }),
  });
  return { from: () => b } as never;
}

describe("F3.1 render-from-DB parity", () => {
  it("DB == seed → render input is byte-identical to questionnaire.json (same set, order, prompts, options)", () => {
    const rows = STATIC_QUESTIONS.map((q, i) => questionToRow(q, i));
    const mapped = rows.map(rowToJourneyQuestion);

    // Same count + same order of ids.
    expect(mapped.map((q) => q.id)).toEqual(STATIC_QUESTIONS.map((q) => q.id));

    // Field-level render parity, per question, in order.
    for (let i = 0; i < STATIC_QUESTIONS.length; i++) {
      expect(renderProjection(mapped[i])).toStrictEqual(
        renderProjection(STATIC_QUESTIONS[i]),
      );
    }
  });

  it("JSON fallback: empty table → returns the full static set (today's behaviour)", async () => {
    const out = await loadJourneyQuestions(loaderClient([]));
    expect(out.map((q) => q.id)).toEqual(STATIC_QUESTIONS.map((q) => q.id));
    expect(out).toBe(STATIC_QUESTIONS); // identity — the bundled fallback
  });

  it("JSON fallback: read error → returns the full static set (no funnel breakage)", async () => {
    const out = await loadJourneyQuestions(loaderClient(null, { message: "boom" }));
    expect(out.map((q) => q.id)).toEqual(STATIC_QUESTIONS.map((q) => q.id));
    expect(out).toBe(STATIC_QUESTIONS);
  });

  it("per-question reflection placeholder threads from meta → QuestionReflection", () => {
    const row: JourneyQuestionRow = {
      slug: "q20c_what_hurts",
      position: 22,
      phase: "full",
      type: "reflection",
      domain: null,
      axes: [],
      reverse: false,
      he_text: "מה הכי כואב?",
      en_text: "What hurts most?",
      options: null,
      meta: { purpose: "p", max_length: 600, placeholder_he: "כתבו כאן…", placeholder_en: "Write…" },
      is_active: true,
    };
    const q = rowToJourneyQuestion(row);
    expect(q.type).toBe("reflection");
    if (q.type === "reflection") {
      expect(q.placeholder_he).toBe("כתבו כאן…");
      expect(q.placeholder_en).toBe("Write…");
    }
  });

  it("no per-question placeholder → field absent (falls back to global CMS key at render)", () => {
    const row: JourneyQuestionRow = {
      slug: "q22a_success_signal",
      position: 23,
      phase: "short",
      type: "reflection",
      domain: null,
      axes: [],
      reverse: false,
      he_text: "מה חסר?",
      en_text: "What's missing?",
      options: null,
      meta: { purpose: "p", max_length: 600 },
      is_active: true,
    };
    const q = rowToJourneyQuestion(row);
    if (q.type === "reflection") {
      expect(q.placeholder_he).toBeUndefined();
      expect(q.placeholder_en).toBeUndefined();
    }
  });
});
