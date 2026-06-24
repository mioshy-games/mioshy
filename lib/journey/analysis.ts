/**
 * lib/journey/analysis.ts
 * Rule-based analysis engine v1.
 *
 * Turns raw `Response[]` into an `Analysis` object (scores, love language,
 * top gap, horsemen flag, bilingual recommendations).
 *
 * No ML, no external calls - deterministic, cheap, auditable. v2 can
 * replace `generateSummary` with an LLM call without touching callers.
 */

import type {
  Analysis,
  AnalysisSummaryBilingual,
  Axis,
  AxisScoreMap,
  AxisWeight,
  CategoryScores,
  CategoryKey,
  LoveLanguage,
  Question,
  Response,
} from "./types";
import { getQuestion } from "./questions";
import { isPriorityKey, type PriorityKey } from "./priorities";

/**
 * Resolves a question definition by its slug (== journey_responses.question_id).
 * Defaults to the bundled questionnaire.json (`getQuestion`); the analyze API
 * route injects a DB-backed resolver (lib/journey/questions-db.ts) so scoring
 * reads admin-editable definitions. This ONLY changes the SOURCE of question
 * defs — the scoring math is identical either way (see F1 identical-result
 * test in tests/journey/scoring-source-parity.test.ts).
 */
export type QuestionResolver = (slug: string) => Question | undefined;
import type { PriorityLabelsBundle } from "@/lib/journey-content/priority-categories";

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

// ---------------------------------------------------------------------------
// 5-category score bundle (2026-06-02) - drives the new bar-chart visual at
// the top of the assessment summary. Each category is a curated mapping
// from axes to a 0..100 score where higher = healthier.
//
// Note: HORSEMEN axes encode bad behaviour (higher = worse), so we invert
// them inside `categoryFromAxes` when they appear in COMMUNICATION_AXES.
// ---------------------------------------------------------------------------

const COMMUNICATION_AXES: Axis[] = [
  "influence",
  "repair",
  "four_horsemen_criticism",
  "four_horsemen_contempt",
  "four_horsemen_defensive",
  "four_horsemen_stonewall",
];

const INTIMACY_AXES: Axis[] = [
  "passion_anticipation",
  "passion_play",
  "love_language_touch",
];

const EMOTIONAL_CONNECTION_AXES: Axis[] = [
  "fondness",
  "love_map",
  "turn_toward",
  "pso",
];

const FRIENDSHIP_CATEGORY_AXES: Axis[] = [
  "love_map",
  "turn_toward",
  "passion_play",
];

const FAMILY_AXES: Axis[] = [
  "shared_meaning",
  "passion_context",
];

/** Inverted axes - higher raw score = unhealthier. We flip to 1-x for scoring. */
const INVERT_FOR_HEALTH: Axis[] = [
  "four_horsemen_criticism",
  "four_horsemen_contempt",
  "four_horsemen_defensive",
  "four_horsemen_stonewall",
];

// --- Core scoring -----------------------------------------------------------

/**
 * Normalize an answer into a scalar in [0..1] per contributing axis.
 * Likert 1..5 → (v-1)/4  (so 1 → 0, 5 → 1).
 * Forced/single choice → option's scores (weight 1 per option).
 * Horsemen questions use the raw Likert score; higher = worse.
 */
export function scoreResponses(
  responses: Response[],
  resolve: QuestionResolver = getQuestion,
): {
  scores: AxisScoreMap;
  counts: Partial<Record<Axis, number>>;
} {
  const accum: Partial<Record<Axis, number>> = {};
  const counts: Partial<Record<Axis, number>> = {};

  for (const r of responses) {
    const q = resolve(r.question_id);
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
      // to the single variant - a callback might (in theory) be called
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

/**
 * Compute a single category score (0..100, higher = healthier) by averaging
 * the listed axes. Inverted axes are flipped before averaging. Missing axes
 * are skipped; if no axis contributes, returns 50 (neutral default).
 */
function categoryFromAxes(scores: AxisScoreMap, axes: Axis[]): number {
  const vals: number[] = [];
  for (const a of axes) {
    const raw = scores[a];
    if (typeof raw !== "number") continue;
    const v = INVERT_FOR_HEALTH.includes(a) ? 1 - raw : raw;
    vals.push(v);
  }
  if (!vals.length) return 50;
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.max(0, Math.min(100, Math.round(avg * 100)));
}

/**
 * Compute the 5-category bundle + identify the lowest-scoring category for
 * the "נקודת ההתחלה שלכם" label.
 *
 * intimacy gets a special q20b override (2026-06-02 new question):
 * if q20b was answered, its raw Likert (1..5) feeds directly into the
 * intimacy score with 60% weight (axes carry the remaining 40%). q20b is
 * the most direct sexual-satisfaction signal in the questionnaire and
 * should dominate the intimacy bar.
 */
function computeCategoryScores(
  scores: AxisScoreMap,
  responses: Response[],
): CategoryScores {
  const communication = categoryFromAxes(scores, COMMUNICATION_AXES);
  const emotional_connection = categoryFromAxes(scores, EMOTIONAL_CONNECTION_AXES);
  const friendship = categoryFromAxes(scores, FRIENDSHIP_CATEGORY_AXES);
  const family = categoryFromAxes(scores, FAMILY_AXES);

  // intimacy with q20b override.
  let intimacy = categoryFromAxes(scores, INTIMACY_AXES);
  const q20b = responses.find((r) => r.question_id === "q20b_intimacy_satisfaction");
  const q20bAnswered = !!q20b && q20b.answer.kind === "likert";
  if (q20b && q20b.answer.kind === "likert") {
    const direct = ((q20b.answer.value - 1) / 4) * 100; // 1..5 -> 0..100
    intimacy = Math.round(direct * 0.6 + intimacy * 0.4);
  }

  // ── Coverage safety net ────────────────────────────────────────────────────
  // A category needs at least MIN_COVERAGE contributing axes for its score to
  // be trustworthy. Below that (e.g. a single reverse item, which an all-"1"
  // answer set would invert to a misleadingly high score) we flag it as
  // insufficient: the UI shows "requires the full assessment" rather than a
  // bar, and it can't be picked as the lowest "starting point". Intimacy counts
  // its direct q20b answer as one covered signal.
  const MIN_COVERAGE = 2;
  const coverage: Record<CategoryKey, number> = {
    communication: coveredAxisCount(scores, COMMUNICATION_AXES),
    intimacy: coveredAxisCount(scores, INTIMACY_AXES) + (q20bAnswered ? 1 : 0),
    emotional_connection: coveredAxisCount(scores, EMOTIONAL_CONNECTION_AXES),
    friendship: coveredAxisCount(scores, FRIENDSHIP_CATEGORY_AXES),
    family: coveredAxisCount(scores, FAMILY_AXES),
  };

  // Identify lowest — among SUFFICIENTLY-covered categories only, so a thin /
  // misleading score never becomes the headline "starting point".
  const entries: Array<[CategoryKey, number]> = [
    ["communication", communication],
    ["intimacy", intimacy],
    ["emotional_connection", emotional_connection],
    ["friendship", friendship],
    ["family", family],
  ];
  const insufficient_keys = entries
    .filter(([k]) => coverage[k] < MIN_COVERAGE)
    .map(([k]) => k);
  const sufficient = entries.filter(([k]) => coverage[k] >= MIN_COVERAGE);
  // Fall back to the full set only if NOTHING is sufficiently covered.
  const ranked = (sufficient.length ? sufficient : entries)
    .slice()
    .sort((a, b) => a[1] - b[1]);
  const lowest_key = ranked[0][0];

  return {
    communication,
    intimacy,
    emotional_connection,
    friendship,
    family,
    lowest_key,
    ...(insufficient_keys.length ? { insufficient_keys } : {}),
  };
}

/** Count how many of the given axes actually have a numeric score (coverage). */
function coveredAxisCount(scores: AxisScoreMap, axes: Axis[]): number {
  let n = 0;
  for (const a of axes) if (typeof scores[a] === "number") n++;
  return n;
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

/**
 * Pulls the user's #1 priority slug out of their `q_priorities` ranking
 * answer. Returns null if the question wasn't answered or the answer is
 * malformed. The validator on /api/journey/answer normally guarantees
 * order is a full permutation of PRIORITY_KEYS - but the analysis layer
 * never trusts that and re-validates here.
 */
function extractTopPriority(responses: Response[]): PriorityKey | null {
  for (const r of responses) {
    if (r.answer.kind !== "ranking") continue;
    const order = r.answer.order;
    if (!Array.isArray(order) || order.length === 0) continue;
    const first = order[0];
    if (typeof first !== "string") continue;
    if (isPriorityKey(first)) {
      return first;
    }
  }
  return null;
}

function generateSummary(params: {
  scores: AxisScoreMap;
  topGap: Axis | null;
  topPriority: PriorityKey | null;
  primary: LoveLanguage | null;
  horsemenFlag: boolean;
  priorityLabels: PriorityLabelsBundle;
}): AnalysisSummaryBilingual {
  // The new narrative leans on the chosen priority + love language
  // instead of leading with raw friendship/conflict/passion scores -
  // those still surface as their own card row in AnalysisSummary.tsx
  // so we don't repeat them in prose. Hence the smaller param surface.
  const { topPriority, primary, horsemenFlag, priorityLabels } = params;

  // Resolve the user's chosen #1 priority into HE/EN labels via the DB
  // labels bundle (was the constant maps PRIORITY_LABELS_HE/EN before
  // v3 slice 1). Falls back to the legacy axis-based topGap when
  // ranking wasn't answered (older sessions / partial diagnostics).
  const focusHe = topPriority
    ? priorityLabels.labelsHe[topPriority]
    : params.topGap ? AXIS_LABEL_HE[params.topGap] : "חיבור כללי";
  const focusEn = topPriority
    ? priorityLabels.labelsEn[topPriority]
    : params.topGap ? AXIS_LABEL_EN[params.topGap] : "connection";
  const focusDescHe = topPriority ? priorityLabels.descsHe[topPriority] : "";
  const focusDescEn = topPriority ? priorityLabels.descsEn[topPriority] : "";

  const primaryHe = primary ? AXIS_LABEL_HE[primary] : null;
  const primaryEn = primary ? AXIS_LABEL_EN[primary] : null;

  // ── Marketing/psychology narrative ──
  // Tone: warm, knowing, never "rate-card" clinical. Avoids leading with
  // raw scores (those have their own card UI further down). Centres the
  // story around the priority the user JUST told us they care about.
  const narrativeHeParts = [
    `אנחנו רואים בתשובות שלכם זוגיות אמיתית - עם היכרות, חום, ורצון להתחבר עוד יותר.`,
    `העדיפות הראשונה שבחרתם היא ${focusHe}${focusDescHe ? ` - ${focusDescHe}` : ""}, ושם אנחנו מתחילים.`,
    primaryHe
      ? `שפת האהבה שמאירה אצלכם הכי חזק היא ${primaryHe} - דרכה אפשר לבן/בת הזוג להרגיש את האהבה שלכם בלי מאמץ.`
      : "",
    horsemenFlag
      ? "זיהינו דפוסי תקשורת שמומחי הזוגיות שלנו יודעים בדיוק איך לעבוד איתם - נתחיל שם, ברוגע ובעדינות."
      : "בסיס התקשורת ביניכם איתן, מה שמאפשר לנו לצלול מיד לעומק החיבור.",
  ].filter(Boolean);

  const narrativeEnParts = [
    `Your answers describe a real, living relationship - with depth, warmth, and a real wish to connect more.`,
    `The #1 priority you chose is ${focusEn}${focusDescEn ? ` - ${focusDescEn}` : ""}, and that's where we begin.`,
    primaryEn
      ? `Your strongest love language is ${primaryEn} - through it, your partner feels your love effortlessly.`
      : "",
    horsemenFlag
      ? "We noticed a few communication patterns our experts know exactly how to soften. We'll start there, gently."
      : "Your communication foundation is solid, which lets us dive straight into deepening the connection.",
  ].filter(Boolean);

  const narrative_he = narrativeHeParts.join(" ");
  const narrative_en = narrativeEnParts.join(" ");

  // ── Recommendations / "How we'll work together" ──
  // Per product direction: do NOT enumerate daily exercises here. Show ONE
  // value-driven block that names the focus area and explains the method.
  // The actual schedule of micro-tasks is something the subscriber sees
  // post-checkout, not a teaser on the result screen.
  const recommendations: AnalysisSummaryBilingual["recommendations"] = [];

  recommendations.push({
    id: topPriority
      ? `rec_priority_${topPriority}`
      : params.topGap ? `rec_topgap_${params.topGap}` : "rec_general",
    axis: params.topGap ?? "shared_meaning",
    priority: 1,
    he:
      `נתחיל בעדיפות ${focusHe} שבחרתם. ` +
      "בעזרת כלים מעולם הפסיכולוגיה הזוגית, הניסיון של מאות זוגות שעברו אצלנו, " +
      "ועם המומחים שלנו בתחום - בנינו תוכן מעמיק שיעבוד בדיוק איפה שאתם רוצים. " +
      "הכי חשוב: השירות אישי לחלוטין. אנחנו לומדים אתכם, " +
      "והמומחים שלנו מתאימים את התוכן עבורכם לאורך כל הדרך. " +
      "עם פרק בשבוע בנושא זוגיות תקבלו כלים, תשוחחו עליהם עם המומחים שלנו, " +
      "תשאלו שאלות, ותשתפרו משבוע לשבוע.",
    en:
      `We'll start with the priority you chose: ${focusEn}. ` +
      "Using tools from couples psychology, the experience of hundreds of couples who walked this path with us, " +
      "and our in-house experts - we've built deep content that works exactly where you want it to. " +
      "Most importantly: this service is fully personal. " +
      "We learn you, and our experts adapt the content for you, every step of the way. " +
      "With a weekly chapter on your relationship, you'll receive tools, discuss them with our experts, " +
      "ask questions, and improve week by week.",
  });

  return {
    narrative_he,
    narrative_en,
    recommendations,
    top_priority: topPriority ?? undefined,
    focus_label_he: topPriority ? priorityLabels.labelsHe[topPriority] ?? null : null,
    focus_label_en: topPriority ? priorityLabels.labelsEn[topPriority] ?? null : null,
  };
}

// --- Public entrypoint ------------------------------------------------------

export function analyze(
  responses: Response[],
  priorityLabels: PriorityLabelsBundle,
  resolve: QuestionResolver = getQuestion,
): Analysis {
  const { scores } = scoreResponses(responses, resolve);
  const friendship = friendshipScore(scores);
  const conflict = conflictHealth(scores);
  const passion = passionRisk(scores);
  const primary = primaryLoveLanguage(scores);
  const secondary = secondaryLoveLanguage(scores, primary);
  const topGap = findTopGap(scores);
  const horsemenFlag = fourHorsemenFlag(scores);
  // The user's #1 chosen priority drives the marketing narrative.
  // Falls back to topGap when ranking wasn't answered.
  const topPriority = extractTopPriority(responses);

  const summary = generateSummary({
    scores,
    topGap,
    topPriority,
    primary,
    horsemenFlag,
    priorityLabels,
  });

  // 2026-06-02: also compute the 5-category bundle for the new bar-chart
  // visual at the top of the assessment summary. Attached to summary so
  // it travels with the existing JSONB blob (no migration needed).
  summary.category_scores = computeCategoryScores(scores, responses);

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

/** For quick debugging / tests - exposed so admin can inspect raw math. */
export const __analysisInternals = {
  FRIENDSHIP_AXES,
  HORSEMEN_AXES,
  PASSION_AXES,
  LOVE_LANGUAGE_AXES,
  AXIS_LABEL_HE,
  AXIS_LABEL_EN,
};
