/**
 * lib/journey/analysis.ts
 * Rule-based analysis engine v1.
 *
 * Turns raw `Response[]` into an `Analysis` object (scores, love language,
 * top gap, horsemen flag, bilingual recommendations).
 *
 * No ML, no external calls — deterministic, cheap, auditable. v2 can
 * replace `generateSummary` with an LLM call without touching callers.
 */

import type {
  Analysis,
  AnalysisSummaryBilingual,
  Axis,
  AxisScoreMap,
  AxisWeight,
  LoveLanguage,
  Response,
} from "./types";
import { getQuestion } from "./questions";

// Axis labels (bilingual) for narrative rendering ----------------------------

const AXIS_LABEL_HE: Record<Axis, string> = {
  love_map: "היכרות עמוקה",
  fondness: "הערכה וחיבה",
  turn_toward: "היענות לרגעים קטנים",
  pso: "מבט חיובי",
  influence: "שיתוף בהחלטות",
  repair: "יכולת התאוששות מוויכוח",
  shared_meaning: "משמעות משותפת",
  four_horsemen_criticism: "ביקורת",
  four_horsemen_contempt: "זלזול",
  four_horsemen_defensive: "התגוננות",
  four_horsemen_stonewall: "ניתוק",
  love_language_words: "מילים טובות",
  love_language_time: "זמן איכות",
  love_language_service: "מעשי שירות",
  love_language_touch: "מגע פיזי",
  love_language_gifts: "מתנות קטנות",
  passion_autonomy: "אוטונומיה בזוגיות",
  passion_anticipation: "ציפייה ורעננות",
  passion_play: "שובבות ומשחק",
  passion_context: "זמן חופשי מלו\"ז",
};

const AXIS_LABEL_EN: Record<Axis, string> = {
  love_map: "Deep knowing",
  fondness: "Admiration",
  turn_toward: "Responding to small bids",
  pso: "Positive lens",
  influence: "Shared decisions",
  repair: "Recovery after conflict",
  shared_meaning: "Shared meaning",
  four_horsemen_criticism: "Criticism",
  four_horsemen_contempt: "Contempt",
  four_horsemen_defensive: "Defensiveness",
  four_horsemen_stonewall: "Stonewalling",
  love_language_words: "Words of affirmation",
  love_language_time: "Quality time",
  love_language_service: "Acts of service",
  love_language_touch: "Physical touch",
  love_language_gifts: "Thoughtful gifts",
  passion_autonomy: "Autonomy",
  passion_anticipation: "Anticipation",
  passion_play: "Playfulness",
  passion_context: "Time free of logistics",
};

const LOVE_LANGUAGE_AXES: LoveLanguage[] = [
  "love_language_words",
  "love_language_time",
  "love_language_service",
  "love_language_touch",
  "love_language_gifts",
];

const FRIENDSHIP_AXES: Axis[] = [
  "love_map",
  "fondness",
  "turn_toward",
  "pso",
];

const HORSEMEN_AXES: Axis[] = [
  "four_horsemen_criticism",
  "four_horsemen_contempt",
  "four_horsemen_defensive",
  "four_horsemen_stonewall",
];

const PASSION_AXES: Axis[] = [
  "passion_autonomy",
  "passion_anticipation",
  "passion_play",
  "passion_context",
];

// --- Core scoring -----------------------------------------------------------

/**
 * Normalize an answer into a scalar in [0..1] per contributing axis.
 * Likert 1..5 → (v-1)/4  (so 1 → 0, 5 → 1).
 * Forced/single choice → option's scores (weight 1 per option).
 * Horsemen questions use the raw Likert score; higher = worse.
 */
export function scoreResponses(responses: Response[]): {
  scores: AxisScoreMap;
  counts: Partial<Record<Axis, number>>;
} {
  const accum: Partial<Record<Axis, number>> = {};
  const counts: Partial<Record<Axis, number>> = {};

  for (const r of responses) {
    const q = getQuestion(r.question_id);
    if (!q) continue;

    // LIKERT → one value applied to every axis listed on the question,
    // multiplied by the axis weight (can be negative, as on q17).
    if (q.type === "likert5" && r.answer.kind === "likert") {
      const normalized = (r.answer.value - 1) / 4; // 0..1
      for (const { axis, weight } of q.axes as AxisWeight[]) {
        const contribution = weight >= 0 ? normalized * weight : (1 - normalized) * Math.abs(weight);
        accum[axis] = (accum[axis] ?? 0) + contribution;
        counts[axis] = (counts[axis] ?? 0) + Math.abs(weight);
      }
      continue;
    }

    // FORCED / SINGLE CHOICE → pull scores from the selected option.
    if ((q.type === "forced_choice" || q.type === "single_choice") && r.answer.kind === "single") {
      // Extract the option id BEFORE the find() callback. Inside the
      // callback, TypeScript can't preserve the narrowing of `r.answer`
      // to the single variant — a callback might (in theory) be called
      // after `r.answer` has changed type, so TS forbids `.option`
      // access there. Pulling it out into a local const captures the
      // narrowed value at this point and the callback only sees a string.
      const optionId = r.answer.option;
      const option = q.options.find((o) => o.id === optionId);
      if (!option) continue;
      for (const { axis, weight } of option.scores) {
        accum[axis] = (accum[axis] ?? 0) + weight;
        counts[axis] = (counts[axis] ?? 0) + 1;
      }
      continue;
    }

    // MULTI CHOICE → sum scores from all selected options.
    if (q.type === "multi_choice" && r.answer.kind === "multi") {
      for (const optId of r.answer.options) {
        const option = q.options.find((o) => o.id === optId);
        if (!option) continue;
        for (const { axis, weight } of option.scores) {
          accum[axis] = (accum[axis] ?? 0) + weight;
          counts[axis] = (counts[axis] ?? 0) + 1;
        }
      }
      continue;
    }

    // REFLECTION → no axis contribution, but stored for coach.
  }

  const scores: AxisScoreMap = {};
  for (const axis in accum) {
    const c = counts[axis as Axis] ?? 0;
    if (c > 0) scores[axis as Axis] = (accum[axis as Axis] as number) / c;
  }
  return { scores, counts };
}

// --- Derived metrics --------------------------------------------------------

function avgOf(scores: AxisScoreMap, axes: Axis[]): number {
  const vals = axes.map((a) => scores[a]).filter((v): v is number => typeof v === "number");
  if (!vals.length) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function friendshipScore(scores: AxisScoreMap): number {
  return Math.round(avgOf(scores, FRIENDSHIP_AXES) * 100);
}

/**
 * Horsemen axes are scored 0..1 where HIGHER = WORSE behaviour.
 * conflict_health = 100 - (avg horsemen × 100), bounded [0..100].
 */
function conflictHealth(scores: AxisScoreMap): number {
  const horsemenAvg = avgOf(scores, HORSEMEN_AXES);
  return Math.max(0, Math.min(100, Math.round(100 - horsemenAvg * 100)));
}

function passionRisk(scores: AxisScoreMap): number {
  // passion_context is already negatively-weighted in the JSON, so higher = better.
  const passionAvg = avgOf(scores, PASSION_AXES);
  return Math.max(0, Math.min(100, Math.round((1 - passionAvg) * 100)));
}

function primaryLoveLanguage(scores: AxisScoreMap): LoveLanguage | null {
  const ranked = LOVE_LANGUAGE_AXES
    .map((a) => [a, scores[a] ?? 0] as const)
    .sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] === 0) return null;
  return ranked[0][0];
}

function secondaryLoveLanguage(scores: AxisScoreMap, primary: LoveLanguage | null): LoveLanguage | null {
  const ranked = LOVE_LANGUAGE_AXES
    .filter((a) => a !== primary)
    .map((a) => [a, scores[a] ?? 0] as const)
    .sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] === 0) return null;
  return ranked[0][0];
}

/** Top gap = friendship/passion axis with lowest score. */
function findTopGap(scores: AxisScoreMap): Axis | null {
  const candidateAxes: Axis[] = [...FRIENDSHIP_AXES, ...PASSION_AXES, "influence", "repair", "shared_meaning"];
  let worst: { axis: Axis; score: number } | null = null;
  for (const axis of candidateAxes) {
    const s = scores[axis];
    if (typeof s !== "number") continue;
    if (!worst || s < worst.score) worst = { axis, score: s };
  }
  return worst?.axis ?? null;
}

function fourHorsemenFlag(scores: AxisScoreMap): boolean {
  // Flag if any single horseman axis is above 0.5 OR average is above 0.4.
  const anyHigh = HORSEMEN_AXES.some((a) => (scores[a] ?? 0) >= 0.5);
  const avgHigh = avgOf(scores, HORSEMEN_AXES) >= 0.4;
  return anyHigh || avgHigh;
}

// --- Narrative / recommendations (deterministic copy) -----------------------

function generateSummary(params: {
  scores: AxisScoreMap;
  topGap: Axis | null;
  primary: LoveLanguage | null;
  friendship: number;
  conflict: number;
  passion: number;
  horsemenFlag: boolean;
}): AnalysisSummaryBilingual {
  const { topGap, primary, friendship, conflict, passion, horsemenFlag } = params;

  const topGapHe = topGap ? AXIS_LABEL_HE[topGap] : "חיבור כללי";
  const topGapEn = topGap ? AXIS_LABEL_EN[topGap] : "connection";
  const primaryHe = primary ? AXIS_LABEL_HE[primary] : "מגע אישי";
  const primaryEn = primary ? AXIS_LABEL_EN[primary] : "personal touch";

  const narrative_he =
    `על פי התשובות שלך, הציון החברי (friendship) שלכם הוא ${friendship}/100, ` +
    `רמת השקט בוויכוחים ${conflict}/100, והפוטנציאל לתשוקה מתגעגע ב-${passion}/100. ` +
    `האזור שהכי ישתלם לעבוד עליו קודם הוא ${topGapHe}. ` +
    `בן/בת הזוג שלך כנראה יגיב/תגיב הכי חזק כשאת/ה מביא/ה יותר ${primaryHe}. ` +
    (horsemenFlag
      ? "זיהינו סימנים ששווה להתייחס אליהם בתקשורת שלכם — נתחיל שם לפני כל דבר אחר."
      : "בסיס התקשורת ביניכם סביר; אפשר לצלול מייד לעבודה על הקשר.");

  const narrative_en =
    `Based on your answers, your friendship score is ${friendship}/100, ` +
    `conflict health is ${conflict}/100, and your passion is at risk by ${passion}/100. ` +
    `The highest-leverage area to work on first is ${topGapEn}. ` +
    `Your partner will likely respond most strongly when you offer more ${primaryEn}. ` +
    (horsemenFlag
      ? "We noticed communication patterns worth addressing — we'll start there before anything else."
      : "Your communication foundation is solid; we can move straight into deepening connection.");

  // Top-3 recommendations, selected by priority tree.
  const recommendations: AnalysisSummaryBilingual["recommendations"] = [];

  if (horsemenFlag) {
    recommendations.push({
      id: "rec_horsemen",
      axis: "repair",
      priority: 1,
      he:
        "נתחיל עם תרגיל 7-ימים של 'פנייה רכה' — במקום 'אתה תמיד…', תנסו 'אני מרגיש/ה כש…'. נשלח לכם ניסוח מוכן כל יום.",
      en:
        "We'll start with a 7-day 'soft start-up' exercise — instead of 'you always…', try 'I feel when…'. We'll send you a ready-made phrase every day.",
    });
  }

  if (topGap) {
    recommendations.push({
      id: `rec_topgap_${topGap}`,
      axis: topGap,
      priority: horsemenFlag ? 2 : 1,
      he: `המוקד שלנו בחודש הראשון: ${AXIS_LABEL_HE[topGap]}. שלושה מיקרו-תרגולים, חמש דקות כל אחד, פרוסים לאורך השבוע.`,
      en: `Our focus in the first month: ${AXIS_LABEL_EN[topGap]}. Three micro-exercises, five minutes each, spread through the week.`,
    });
  }

  if (primary) {
    recommendations.push({
      id: `rec_love_lang_${primary}`,
      axis: primary,
      priority: horsemenFlag ? 3 : 2,
      he: `נלמד אותך לדייק בשפת האהבה של בן/בת הזוג: ${AXIS_LABEL_HE[primary]}. שלושה ניסויים קצרים לקבלת משוב אמיתי ממנו/ה.`,
      en: `We'll help you target your partner's love language: ${AXIS_LABEL_EN[primary]}. Three short experiments to get real feedback from them.`,
    });
  }

  return { narrative_he, narrative_en, recommendations };
}

// --- Public entrypoint ------------------------------------------------------

export function analyze(responses: Response[]): Analysis {
  const { scores } = scoreResponses(responses);
  const friendship = friendshipScore(scores);
  const conflict = conflictHealth(scores);
  const passion = passionRisk(scores);
  const primary = primaryLoveLanguage(scores);
  const secondary = secondaryLoveLanguage(scores, primary);
  const topGap = findTopGap(scores);
  const horsemenFlag = fourHorsemenFlag(scores);

  const summary = generateSummary({
    scores,
    topGap,
    primary,
    friendship,
    conflict,
    passion,
    horsemenFlag,
  });

  return {
    axis_scores: scores,
    friendship_score: friendship,
    conflict_health: conflict,
    passion_risk: passion,
    primary_love_language: primary,
    secondary_love_language: secondary,
    top_gap: topGap,
    four_horsemen_flag: horsemenFlag,
    summary,
  };
}

/** Rendering helpers for admin UI. */
export function axisLabel(axis: Axis, locale: "he" | "en"): string {
  return locale === "he" ? AXIS_LABEL_HE[axis] : AXIS_LABEL_EN[axis];
}

/** For quick debugging / tests — exposed so admin can inspect raw math. */
export const __analysisInternals = {
  FRIENDSHIP_AXES,
  HORSEMEN_AXES,
  PASSION_AXES,
  LOVE_LANGUAGE_AXES,
  AXIS_LABEL_HE,
  AXIS_LABEL_EN,
};
