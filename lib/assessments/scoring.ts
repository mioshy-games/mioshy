/**
 * lib/assessments/scoring.ts
 *
 * Deterministic dimension scoring for the assessments product line.
 * No ML, no network — auditable and cheap. The AI hero (ai-hero.ts) is layered
 * on top in the analyze route and never blocks this computation.
 *
 * Per dimension: average the answered Likert values (1..5), flipping
 * reverse-scored items (value → 6 - value), then map to 0..100:
 *   score = round(((avg - 1) / 4) * 100)   // 1 → 0, 5 → 100, higher = stronger
 */

import type {
  AssessmentDef,
  AssessmentAnalysis,
  AssessmentQuestion,
  AssessmentResponse,
  DimensionScore,
} from "./types";

export function scoreAssessment(
  def: AssessmentDef,
  questions: AssessmentQuestion[],
  responses: AssessmentResponse[],
): AssessmentAnalysis {
  const byId = new Map(responses.map((r) => [r.question_id, r]));

  const dimension_scores: DimensionScore[] = def.dimensions.map((dim) => {
    const items = questions.filter(
      (qq) => qq.type === "likert5" && qq.dimension === dim.key,
    );
    const values: number[] = [];
    for (const item of items) {
      const r = byId.get(item.id);
      if (!r || r.answer.kind !== "likert") continue;
      const raw = r.answer.value; // 1..5
      const reverse = item.type === "likert5" && item.reverse === true;
      values.push(reverse ? 6 - raw : raw);
    }
    const avg = values.length
      ? values.reduce((s, v) => s + v, 0) / values.length
      : 1; // no answers → floor (shouldn't happen once complete)
    const score = Math.max(0, Math.min(100, Math.round(((avg - 1) / 4) * 100)));
    return { key: dim.key, he: dim.he, en: dim.en, score };
  });

  // 3 weakest dimensions (ascending score).
  const weakest_keys = [...dimension_scores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((d) => d.key);

  // Open reflection (Q21) — authentic free text for the coaching team + AI.
  const openQ = questions.find(
    (qq) => qq.type === "reflection" && qq.isOpen === true,
  );
  const openRow = openQ ? byId.get(openQ.id) : undefined;
  const open_answer =
    openRow && openRow.answer.kind === "text"
      ? openRow.answer.text.trim()
      : "";

  return {
    assessment_id: def.id,
    dimension_scores,
    weakest_keys,
    open_answer,
    summary: {
      dimension_scores,
      weakest_keys,
      open_answer,
      ai_hero: null,
    },
  };
}
