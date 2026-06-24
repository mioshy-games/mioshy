/**
 * lib/journey/hero-fallback.ts
 *
 * Stage 1 (2026-06-14) — deterministic hero fallback for the journey
 * assessment results, used when the Claude hero call ultimately fails
 * (missing key, rate-limit, timeout, parse error). Without this the
 * results page lost BOTH the hero and the "מה תקבלו בליווי" recommendation
 * bullets (AnalysisSummary gates both on the AI block), collapsing to a
 * much weaker page. The fallback produces a real AiHeroBlock so the
 * existing UI renders unchanged.
 *
 * FAIRNESS GUARD (Itzik, hard requirement): the templated copy states
 * GENERIC benefits only — no invented moments, vague time ("מהר מאוד"),
 * no escalation. The optional reflection echo quotes the user VERBATIM
 * (no paraphrase, no interpretation) behind a quality gate so we never
 * quote empty/garbage input, and bridges with fixed neutral copy.
 *
 * Hardcoded constants (mirrors lib/journey/category-feedback.ts). Can move
 * to CMS later if non-dev editing is needed.
 */
import "server-only";
import { stripEmDash } from "@/lib/text/sanitize-dashes";
import type {
  AiHeroBlock,
  CategoryScores,
  Locale,
  Response,
} from "@/lib/journey/types";

type CategoryKey = CategoryScores["lowest_key"];

interface FallbackCopy {
  hero_he: string;
  hero_en: string;
  recs_he: [string, string, string];
  recs_en: [string, string, string];
}

// Voice matches the AI prompt's benefit vocabulary: future-benefit verbs,
// vague time, no em-dash, no invented specifics, no negative comparisons.
const FALLBACK: Record<CategoryKey, FallbackCopy> = {
  communication: {
    hero_he:
      "מהר מאוד תלמדו לדבר בלי שזה יהפוך לויכוח, והחיבור ביניכם יתחזק.",
    hero_en:
      "Very quickly you'll learn to talk without it turning into a fight, and your connection will grow stronger.",
    recs_he: [
      "תלמדו להתווכח בלי שזה יהיה נטל.",
      "שיחות אמיתיות יחזרו ביניכם.",
      "תקשיבו ותרגישו מובנים שוב.",
    ],
    recs_en: [
      "You'll learn to argue without it being a burden.",
      "Real conversations will return between you.",
      "You'll listen and feel understood again.",
    ],
  },
  intimacy: {
    hero_he:
      "מהר מאוד תחזירו את הקרבה והתשוקה, והאינטימיות ביניכם תתחדש.",
    hero_en:
      "Very quickly you'll bring back closeness and passion, and your intimacy will renew.",
    recs_he: [
      "תחזירו את הפרפרים בבטן.",
      "תתאהבו מחדש.",
      "יותר אינטימיות אמיתית ביניכם.",
    ],
    recs_en: [
      "The butterflies will come back.",
      "You'll fall in love again.",
      "More real intimacy between you.",
    ],
  },
  emotional_connection: {
    hero_he:
      "מהר מאוד תחזרו להרגיש קרובים ומחוברים, והקשר הרגשי ביניכם יתעצם.",
    hero_en:
      "Very quickly you'll feel close and connected again, and your emotional bond will deepen.",
    recs_he: [
      "תרגישו שוב קרובים אחד לשני.",
      "תחזרו לראות אחד את השני באמת.",
      "הקשר הרגשי ביניכם יתחזק.",
    ],
    recs_en: [
      "You'll feel close to each other again.",
      "You'll truly see each other again.",
      "Your emotional bond will strengthen.",
    ],
  },
  friendship: {
    hero_he:
      "מהר מאוד החברות והכיף ביניכם יחזרו, ותהיו שוב 'אנחנו'.",
    hero_en:
      "Very quickly your friendship and fun will return, and you'll be 'us' again.",
    recs_he: [
      "החברות והכיף ביניכם יחזרו.",
      "תחזרו לחכות לסוף היום ביחד.",
      "תהיו שוב 'אנחנו'.",
    ],
    recs_en: [
      "Friendship and fun will return.",
      "You'll look forward to the end of the day together.",
      "You'll be 'us' again.",
    ],
  },
  family: {
    hero_he:
      "מהר מאוד תמצאו שפה משותפת בבית, והשותפות ביניכם תתחזק.",
    hero_en:
      "Very quickly you'll find a shared language at home, and your partnership will grow stronger.",
    recs_he: [
      "תמצאו שפה משותפת בבית.",
      "תתנהלו כצוות אחד.",
      "השותפות ביניכם תתחזק.",
    ],
    recs_en: [
      "You'll find a shared language at home.",
      "You'll act as one team.",
      "Your partnership will strengthen.",
    ],
  },
};

const ECHO_MAX = 180;

/** Collapse whitespace + trim. The source is a plain textarea value, so no
 *  HTML handling is needed; React escapes it on render. */
function plain(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Quality gate — only echo text that looks like a real sentence, so we
 * never quote "bcnvbnvbn" / "שדגשדג" / "" back at the user. Heuristic:
 * ≥12 chars AND either contains a space (multi-word) or has ≥2 separate
 * letter-runs. Imperfect (a long spaced gibberish can pass) but cheap and
 * catches the common junk seen in the DB.
 */
function isRealReflection(t: string): boolean {
  if (t.length < 12) return false;
  if (/\s/.test(t)) return true;
  const runs = t.match(/[\p{L}]{2,}/gu) ?? [];
  return runs.length >= 2;
}

/** Pick the reflection to quote: q20c (the pain) preferred, else q22a. */
function pickReflection(responses: Response[]): string | null {
  const textOf = (id: string): string => {
    const r = responses.find((x) => x.question_id === id);
    return r && r.answer.kind === "text" ? plain(r.answer.text) : "";
  };
  const q20c = textOf("q20c_what_hurts");
  if (isRealReflection(q20c)) return q20c;
  const q22a = textOf("q22a_success_signal");
  if (isRealReflection(q22a)) return q22a;
  return null;
}

/** Build the verbatim, neutral-bridge echo line for a given UI locale.
 *  The quoted text stays in the language the user wrote it (usually
 *  Hebrew) regardless of UI locale — same convention as the AI few-shot. */
function buildEcho(src: string, locale: Locale): string {
  const quote =
    src.length > ECHO_MAX ? `${src.slice(0, ECHO_MAX).trimEnd()}…` : src;
  return locale === "he"
    ? `כתבתם: “${quote}”. נתחיל בדיוק משם.`
    : `You wrote: “${quote}”. That's exactly where we'll begin.`;
}

/**
 * Deterministic fallback AiHeroBlock keyed off the lowest category score,
 * with an optional verbatim reflection echo. `model: "fallback-template"`
 * marks it so the admin panel and `ai_hero_status.source` can tell it
 * apart from real AI output.
 */
export function buildFallbackHero(
  lowestKey: CategoryKey | null | undefined,
  responses: Response[],
  nowIso: string,
): AiHeroBlock {
  const key: CategoryKey = lowestKey ?? "communication";
  const tpl = FALLBACK[key];
  const src = pickReflection(responses);

  return {
    // Display-layer em-dash sanitiser. The templates are clean, but
    // reflection_echo_* echoes the USER's own reflection text, which can carry
    // a typed em-dash — strip it here so the fallback hero is clean too.
    hero_he: stripEmDash(tpl.hero_he),
    hero_en: stripEmDash(tpl.hero_en),
    recommendations_he: tpl.recs_he.map(stripEmDash),
    recommendations_en: tpl.recs_en.map(stripEmDash),
    reflection_echo_he: src ? stripEmDash(buildEcho(src, "he")) : null,
    reflection_echo_en: src ? stripEmDash(buildEcho(src, "en")) : null,
    expert_mentioned: false,
    pain_signal: "scores",
    model: "fallback-template",
    generated_at: nowIso,
    latency_ms: 0,
  };
}
