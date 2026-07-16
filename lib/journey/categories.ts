/**
 * lib/journey/categories.ts
 *
 * SINGLE SOURCE OF TRUTH for the 5 relationship categories' DISPLAY —
 * canonical keys, Hebrew/English names, and render order. Approved spec:
 * pull/mioshy-categories-spec.md (phase 1).
 *
 * The 5 KEYS are canonical and MUST NOT change — journey scores are keyed by
 * them (lib/journey/types.ts `CategoryScores`, lib/journey/analysis.ts). Names
 * here are DISPLAY-ONLY; renaming a label never remaps a score.
 *
 *   `he` / `en`           — full canonical label (cards, lists, #1 priority).
 *   `shortHe` / `shortEn` — compact label for tight layouts (bar charts, the
 *                           marketing "5 areas" strip). Same source, one place.
 *
 * `CATEGORY_DISPLAY_ORDER` is the canonical order for every screen and graph.
 */

import type { CategoryKey } from "./types";
export type { CategoryKey };

/** Canonical render order — applies to every screen and graph. */
export const CATEGORY_DISPLAY_ORDER: CategoryKey[] = [
  "intimacy",
  "emotional_connection",
  "communication",
  "friendship",
  "family",
];

export interface CategoryLabel {
  he: string;
  en: string;
  /** Compact label for bar charts / tight marketing strips. */
  shortHe: string;
  shortEn: string;
}

export const CATEGORY_LABELS: Record<CategoryKey, CategoryLabel> = {
  intimacy: {
    he: "מיניות ואינטימיות",
    en: "Sexuality & intimacy",
    shortHe: "אינטימיות",
    shortEn: "Intimacy",
  },
  emotional_connection: {
    he: "אהבה וחיבור רגשי",
    en: "Love & emotional connection",
    shortHe: "חיבור רגשי",
    shortEn: "Emotional",
  },
  communication: {
    he: "תקשורת זוגית",
    en: "Couple communication",
    shortHe: "תקשורת",
    shortEn: "Communication",
  },
  friendship: {
    he: "חברות ושותפות יומיומית",
    en: "Friendship & daily partnership",
    shortHe: "חברות",
    shortEn: "Friendship",
  },
  family: {
    he: "משפחה, הורות ולחצים חיצוניים",
    en: "Family, parenting & outside pressures",
    shortHe: "משפחה",
    shortEn: "Family",
  },
};

/**
 * 3-band split by score. Thresholds per the approved spec:
 *   < 50 = weak · 50–79 = medium · 80+ = strong. Display-only.
 */
export type CategoryBand = "weak" | "medium" | "strong";

export function categoryBand(score: number): CategoryBand {
  if (score < 50) return "weak";
  if (score < 80) return "medium";
  return "strong";
}

/** Level label shown next to the score (`.ar-sexp`). */
export const BAND_LABEL: Record<CategoryBand, { he: string; en: string }> = {
  weak: { he: "מקום לחיזוק", en: "room to strengthen" },
  medium: { he: "יש בסיס טוב", en: "a good base" },
  strong: { he: "נקודת חוזק", en: "a strength" },
};
