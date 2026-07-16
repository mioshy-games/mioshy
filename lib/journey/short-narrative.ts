/**
 * lib/journey/short-narrative.ts
 *
 * Deterministic personal paragraph for the SHORT (pre-purchase) assessment —
 * approved spec pull/mioshy-narrative-spec-phase2.md, Part A.
 *
 * The short flow never serves the paid free-text questions (q20c_what_hurts /
 * q22a_success_signal are phase="full"), so the AI narrative can't be grounded
 * in the couple's own words. For short, we skip the AI entirely and render this
 * templated paragraph, built from the couple's weakest (`lowest_key`) and
 * strongest (derived `highest_key`) categories, with names from the single
 * source of truth (lib/journey/categories.ts). Display-only; no scoring.
 *
 * The FULL flow keeps the AI narrative (with its existing deterministic
 * fallback) — this file is not used there.
 */

import type { CategoryScores, CategoryKey } from "./types";
import { CATEGORY_LABELS } from "./categories";

const ALL_KEYS: CategoryKey[] = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
];

/** Constructive next-step direction per category (spec Part A). */
const DIRECTION_HE: Record<CategoryKey, string> = {
  intimacy: "להחזיר לקרבה הפיזית מקום קבוע בשגרה",
  emotional_connection: "לחזק את החיבור הרגשי דרך רגעים קטנים של נוכחות",
  communication: "לבנות דרך לדבר ולהקשיב גם כשקשה",
  friendship: "להחזיר את הצחוק וההנאה מהדברים הקטנים שאתם עושים יחד",
  family: "לשמור על הזוגיות כעדיפות גם מול הלחצים מבחוץ",
};

const DIRECTION_EN: Record<CategoryKey, string> = {
  intimacy: "give physical closeness a steady place in your routine",
  emotional_connection: "strengthen the emotional bond through small moments of presence",
  communication: "build a way to talk and listen even when it's hard",
  friendship: "bring back the laughter and enjoyment of the small things you do together",
  family: "keep the relationship a priority even against outside pressures",
};

/**
 * Highest-scoring category among sufficiently-covered ones, deterministic
 * tie-break via a stable ascending sort over the fixed key order (mirrors how
 * `lowest_key` is chosen in analysis.ts). Falls back to the full set only if
 * nothing is sufficiently covered. Returns null if it can't be resolved.
 */
export function computeHighestKey(scores: CategoryScores): CategoryKey | null {
  const insufficient = new Set(scores.insufficient_keys ?? []);
  const sufficient = ALL_KEYS.filter((k) => !insufficient.has(k));
  const pool = sufficient.length ? sufficient : ALL_KEYS;
  const ranked = pool.slice().sort((a, b) => scores[a] - scores[b]);
  return ranked[ranked.length - 1] ?? null;
}

/**
 * Build the short-assessment paragraph. Uses `lowest_key` (already computed,
 * coverage-guarded) as the weak category and the derived highest as the strong
 * one. When there is no distinct/sufficient strong category, uses the
 * weak-only variant.
 */
export function buildShortNarrative(scores: CategoryScores, isHe: boolean): string {
  const low = scores.lowest_key;
  const high = computeHighestKey(scores);
  const nameLow = isHe ? CATEGORY_LABELS[low].he : CATEGORY_LABELS[low].en;
  const dir = isHe ? DIRECTION_HE[low] : DIRECTION_EN[low];

  // Distinct variant only when the strong category actually scores higher than
  // the weak one (guards the all-equal edge, where calling one "strong" and one
  // "weak" would be misleading — use the weak-only variant there).
  if (high && high !== low && scores[high] > scores[low]) {
    const nameHigh = isHe ? CATEGORY_LABELS[high].he : CATEGORY_LABELS[high].en;
    return isHe
      ? `מהתשובות שלכם עולה תמונה ברורה: ${nameLow} היא כרגע הנקודה שדורשת הכי הרבה תשומת לב, בעוד ש${nameHigh} דווקא חזקה אצלכם. יש בסיס טוב לבנות עליו, והצעד הבא הוא ${dir}.`
      : `A clear picture emerges from your answers: ${nameLow} is the area that needs the most attention right now, while ${nameHigh} is actually a strength for you. There's a good base to build on, and the next step is to ${dir}.`;
  }

  return isHe
    ? `מהתשובות שלכם עולה ש${nameLow} היא הנקודה שדורשת כרגע את מירב תשומת הלב. הצעד הבא הוא ${dir}.`
    : `Your answers show that ${nameLow} is the area that needs the most attention right now. The next step is to ${dir}.`;
}
