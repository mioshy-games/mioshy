/**
 * lib/journey/comparison.ts
 *
 * Synchronizes two partners' journey responses into a single
 * "question matrix" - one row per question, with each partner's
 * answer side-by-side and a divergence indicator.
 *
 * Why this is a separate file from analysis.ts:
 *
 *   analysis.ts produces an ANALYSIS object per individual user
 *   (scores, top gap, narrative). It cares about one person at
 *   a time.
 *
 *   This file produces a COMPARISON between two people. It cares
 *   about question-level divergence - the clinical "where do they
 *   see things differently" view that powers the side-by-side
 *   couple workspace.
 *
 * The output is intentionally render-ready: each row already has
 * the bilingual question prompt, both answers as display strings,
 * and a divergence score the UI can map directly to a colour.
 */

import { QUESTIONS } from "@/lib/journey/questions";
import { isPriorityKey, type PriorityKey } from "@/lib/journey/priorities";
import type { PriorityLabelsBundle } from "@/lib/journey-content/priority-categories";
import type { AnswerValue, Locale, Question, Response } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DivergenceLevel =
  | "match" //  identical or near-identical answers
  | "minor" //  small gap, expected variation
  | "moderate" //   meaningful gap worth noting
  | "major"; // significant gap - flag in clinical view

export interface ComparisonRow {
  /** Stable question id from QUESTIONS catalog. */
  question_id: string;
  /** Bilingual question prompt for display. */
  question_he: string;
  question_en: string;
  /** Question shape (likert / single / multi / ranking / reflection). */
  type: Question["type"];
  /** Display strings - formatted exactly as the admin should read them. */
  answer_a_display: string | null;
  answer_b_display: string | null;
  /** Raw values, kept for advanced UI affordances (charts, badges). */
  answer_a: AnswerValue | null;
  answer_b: AnswerValue | null;
  /** Numeric divergence score 0..1 (1 = max disagreement). */
  divergence: number;
  /** Coarse bucket, friendlier for UI badges. */
  divergence_level: DivergenceLevel;
  /** True when only one partner answered this question. */
  one_sided: boolean;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

/**
 * Collapses a divergence score (0..1) into the four-level bucket the
 * UI consumes. Thresholds picked by clinical heuristic - tuned so
 * "major" only fires for genuinely meaningful gaps, not for minor
 * Likert noise (a 1-point gap on a 5-point scale is 0.25, "minor").
 */
export function divergenceLevel(score: number): DivergenceLevel {
  if (score < 0.15) return "match";
  if (score < 0.35) return "minor";
  if (score < 0.6) return "moderate";
  return "major";
}

function likertDivergence(a: AnswerValue, b: AnswerValue): number {
  if (a.kind !== "likert" || b.kind !== "likert") return 0;
  // 1..5 → 0..4 absolute distance, normalised to 0..1
  return Math.abs(a.value - b.value) / 4;
}

function singleDivergence(a: AnswerValue, b: AnswerValue): number {
  if (a.kind !== "single" || b.kind !== "single") return 0;
  return a.option === b.option ? 0 : 1;
}

function multiDivergence(a: AnswerValue, b: AnswerValue): number {
  if (a.kind !== "multi" || b.kind !== "multi") return 0;
  // Jaccard distance: 1 - |intersection| / |union|
  const setA = new Set(a.options);
  const setB = new Set(b.options);
  const inter = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;
  return 1 - inter / union;
}

function rankingDivergence(a: AnswerValue, b: AnswerValue): number {
  if (a.kind !== "ranking" || b.kind !== "ranking") return 0;
  // Spearman-ish footrule normalised. Sum of |posA - posB| over all keys.
  const positions = (order: string[]): Map<string, number> => {
    const m = new Map<string, number>();
    order.forEach((k, i) => m.set(k, i));
    return m;
  };
  const posA = positions(a.order);
  const posB = positions(b.order);
  const allKeys = new Set([...a.order, ...b.order]);
  let total = 0;
  let n = 0;
  for (const k of allKeys) {
    const ai = posA.get(k);
    const bi = posB.get(k);
    if (ai === undefined || bi === undefined) continue;
    total += Math.abs(ai - bi);
    n += 1;
  }
  if (n === 0) return 0;
  // Max possible distance for n items = floor(n^2 / 2)
  const maxDist = Math.floor((n * n) / 2);
  return maxDist > 0 ? Math.min(1, total / maxDist) : 0;
}

/** Routes to the right metric based on the question type. */
function computeDivergence(
  q: Question,
  a: AnswerValue,
  b: AnswerValue,
): number {
  if (q.type === "likert5") return likertDivergence(a, b);
  if (q.type === "forced_choice" || q.type === "single_choice")
    return singleDivergence(a, b);
  if (q.type === "multi_choice") return multiDivergence(a, b);
  if (q.type === "ranking") return rankingDivergence(a, b);
  // Reflection (free text) - we don't auto-score; treat as "minor"
  // by default. Admin can override via journey_feedback annotations.
  return 0.2;
}

// ─── Display formatting ───────────────────────────────────────────────────────

/**
 * Turns a stored answer into a human-readable string for the admin
 * comparison table. Keeps the Hebrew / English label dictionaries
 * close to where they're used so a missing label here can be spotted
 * in code review.
 */
function formatAnswer(
  q: Question,
  ans: AnswerValue | null,
  locale: Locale,
  priorityLabels: PriorityLabelsBundle,
): string | null {
  if (!ans) return null;
  const isHe = locale === "he";

  if (ans.kind === "likert") {
    // We render the bare Likert number, keeping it compact for the
    // matrix view. The admin already knows the 1–5 scale.
    return `${ans.value}/5`;
  }

  if (ans.kind === "single") {
    if (q.type === "forced_choice" || q.type === "single_choice") {
      const opt = q.options.find((o) => o.id === ans.option);
      if (!opt) return ans.option;
      return isHe ? opt.he : opt.en;
    }
    return ans.option;
  }

  if (ans.kind === "multi") {
    if (q.type !== "multi_choice") return ans.options.join(", ");
    const labels = ans.options.map((id) => {
      const opt = q.options.find((o) => o.id === id);
      if (!opt) return id;
      return isHe ? opt.he : opt.en;
    });
    return labels.join(" · ");
  }

  if (ans.kind === "ranking") {
    const labels = ans.order.map((k, i) => {
      const idx = i + 1;
      const validKey: PriorityKey | null = isPriorityKey(k) ? k : null;
      const lbl = validKey
        ? isHe
          ? priorityLabels.labelsHe[validKey]
          : priorityLabels.labelsEn[validKey]
        : k;
      return `${idx}. ${lbl}`;
    });
    return labels.join("  ");
  }

  if (ans.kind === "text") {
    // Free-text reflection - truncate aggressively for the matrix
    // cell. Admin opens the row to see full text.
    const t = ans.text.trim();
    return t.length > 90 ? `${t.slice(0, 90)}…` : t;
  }

  return null;
}

/**
 * Bilingual prompt extractor - handles the schema asymmetry between
 * Likert questions (which expose plain `he`/`en` fields) and every
 * other type (which uses `he_prompt`/`en_prompt`). The runtime check
 * is needed because TypeScript's discriminated union narrows on
 * `q.type`, but we don't want to enumerate every type just to read
 * the prompt - there are 6 of them.
 */
function readPrompt(q: Question): { he: string; en: string } {
  const anyQ = q as unknown as Record<string, unknown>;
  if (typeof anyQ.he_prompt === "string" && typeof anyQ.en_prompt === "string") {
    return { he: anyQ.he_prompt, en: anyQ.en_prompt };
  }
  if (typeof anyQ.he === "string" && typeof anyQ.en === "string") {
    return { he: anyQ.he, en: anyQ.en };
  }
  return { he: "", en: "" };
}

// ─── Public entrypoint ───────────────────────────────────────────────────────

/**
 * Builds the question matrix for two partners.
 *
 * `responsesA` / `responsesB` are the arrays as returned from the
 * journey_responses table for each partner. Order doesn't matter -
 * we index by question_id.
 *
 * Returns rows in the canonical question order (the order they were
 * authored in lib/journey/questions.ts), filtered to questions where
 * AT LEAST ONE partner answered. Questions both partners skipped
 * are dropped - they'd just be noise in the matrix.
 *
 * The output is sorted with highest-divergence rows first when
 * `sortBy = "divergence"`. Default is canonical question order so
 * the admin can scan top-to-bottom like a clinician would.
 */
export function buildComparisonMatrix(
  responsesA: Response[],
  responsesB: Response[],
  priorityLabels: PriorityLabelsBundle,
  options: {
    locale?: Locale;
    sortBy?: "question_order" | "divergence";
  } = {},
): ComparisonRow[] {
  const locale: Locale = options.locale ?? "he";
  const sortBy = options.sortBy ?? "question_order";

  // Index responses by question_id for O(1) lookup.
  const mapA = new Map<string, Response>();
  for (const r of responsesA) mapA.set(r.question_id, r);
  const mapB = new Map<string, Response>();
  for (const r of responsesB) mapB.set(r.question_id, r);

  const rows: ComparisonRow[] = [];

  for (const q of QUESTIONS) {
    const ra = mapA.get(q.id) ?? null;
    const rb = mapB.get(q.id) ?? null;

    // Skip questions neither partner touched.
    if (!ra && !rb) continue;

    const aVal = ra?.answer ?? null;
    const bVal = rb?.answer ?? null;

    let divergence = 0;
    let one_sided = false;
    if (aVal && bVal) {
      divergence = computeDivergence(q, aVal, bVal);
    } else {
      one_sided = true;
      // Only one side answered - render with its own divergence band so
      // the row is visually distinct in the UI but doesn't dominate the
      // sort-by-divergence ordering.
      divergence = 0.5;
    }

    // QUESTIONS catalog has TWO prompt shapes (the schema is asymmetric):
    //   - QuestionLikert       → fields are `he` and `en`
    //   - QuestionChoice       → fields are `he_prompt` and `en_prompt`
    //   - QuestionReflection   → fields are `he_prompt` and `en_prompt`
    //   - QuestionRanking      → fields are `he_prompt` and `en_prompt`
    // Likert is the odd one out. We pull from whichever exists rather
    // than over-narrowing the union with discriminator checks.
    const { he: question_he, en: question_en } = readPrompt(q);

    rows.push({
      question_id: q.id,
      question_he,
      question_en,
      type: q.type,
      answer_a: aVal,
      answer_b: bVal,
      answer_a_display: formatAnswer(q, aVal, locale, priorityLabels),
      answer_b_display: formatAnswer(q, bVal, locale, priorityLabels),
      divergence,
      divergence_level: divergenceLevel(divergence),
      one_sided,
    });
  }

  if (sortBy === "divergence") {
    rows.sort((a, b) => b.divergence - a.divergence);
  }

  return rows;
}

/**
 * Quick aggregate stats for the matrix - used in the header strip
 * of the comparison view (e.g. "23 questions · 4 major · 9 match").
 */
export function summarizeMatrix(rows: ComparisonRow[]) {
  const buckets: Record<DivergenceLevel, number> = {
    match: 0,
    minor: 0,
    moderate: 0,
    major: 0,
  };
  let oneSided = 0;
  for (const r of rows) {
    buckets[r.divergence_level] += 1;
    if (r.one_sided) oneSided += 1;
  }
  return {
    total: rows.length,
    one_sided: oneSided,
    ...buckets,
  };
}
