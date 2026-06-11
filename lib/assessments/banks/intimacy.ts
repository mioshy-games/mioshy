/**
 * lib/assessments/banks/intimacy.ts
 *
 * Assessment 1 — מיניות ותשוקה (Intimacy & Desire).
 * 5 dimensions × 4 Likert questions + 1 open reflection (Q21).
 * Hebrew copy is the source of truth (per Itzik's spec, 2026-06-07);
 * English is a parallel translation. No reverse-scored items in this bank.
 *
 * Likert scale (shared with Journey, identical labels):
 *   5 כמעט תמיד · 4 לעיתים קרובות · 3 לפעמים · 2 לעיתים רחוקות · 1 בכלל לא
 */

import type { AssessmentDef, AssessmentLikert, AssessmentReflection } from "../types";

const DIM = {
  frequency: "frequency_availability",
  physical: "physical_satisfaction",
  communication: "sexual_communication",
  desire: "mystery_desire",
  emotional: "emotional_intimacy",
} as const;

/** Compact builder for a closed Likert item. `reverse` defaults to false. */
function q(
  id: string,
  dimension: string,
  he: string,
  en: string,
  reverse = false,
): AssessmentLikert {
  return {
    id,
    category: "free",
    type: "likert5",
    domain: null,
    axes: [],
    purpose: "",
    dimension,
    reverse,
    he,
    en,
  };
}

// Final approved wording (Itzik, 2026-06-07): gendered slash phrasing,
// grounded in the Hebrew content items (book/items-cleaned.csv, intimacy).
// This static array is the SEED-of-record + runtime fallback; the live
// questions are managed in the DB table assessment_questions (migration 109)
// and edited from the admin. Keep this in sync when the canonical text changes.
const QUESTIONS: AssessmentLikert[] = [
  // ── ממד א — תדירות וזמינות ──
  q("q01", DIM.frequency, "תדירות הסקס שלנו מספקת אותי", "The frequency of our sex satisfies me"),
  q("q02", DIM.frequency, "כשבן/בת הזוג שלי יוזם/ת סקס, אני נענה/ית ברצון", "When my partner initiates sex, I respond willingly"),
  q("q03", DIM.frequency, "בדרך כלל אני זה/זאת שיוזם/ת סקס", "I'm usually the one who initiates sex"),
  q("q04", DIM.frequency, "אני מצליח/ה לפנות מקום לסקס גם בחיים העמוסים שלנו", "I manage to make room for sex even in our busy life"),

  // ── ממד ב — שביעות רצון גופנית ──
  q("q05", DIM.physical, "אני מסופק/ת גופנית מהסקס שלנו", "I'm physically satisfied with our sex"),
  q("q06", DIM.physical, "אני יודע/ת מה מסב לי הנאה גופנית, וקשוב/ה לאותות הגוף בסקס", "I know what gives me physical pleasure, and I'm attuned to my body's signals during sex"),
  q("q07", DIM.physical, "אני מרגיש/ה שהסקס שלנו מתנהל בקצב שמתאים לי", "I feel our sex moves at a pace that suits me"),
  q("q08", DIM.physical, "אני מרגיש/ה נינוח/ה גופנית בסקס שלנו", "I feel physically at ease during our sex"),

  // ── ממד ג — תקשורת מינית ──
  q("q09", DIM.communication, "אני מצליח/ה לדבר על הסקס שלנו בלי בושה ובלי שזה הופך לריב", "I can talk about our sex without shame and without it turning into a fight"),
  q("q10", DIM.communication, "אני יכול/ה לבקש בנוחות מבן/בת הזוג שלי משהו חדש במיטה, ולהרגיש בנוח עם זה", "I can comfortably ask my partner for something new in bed, and feel at ease with it"),
  q("q11", DIM.communication, "אני מחזר/ת אחרי בן/בת הזוג שלי גם מחוץ למיטה", "I court my partner outside the bedroom too"),
  q("q12", DIM.communication, "אני יודע/ת בוודאות מה בן/בת הזוג שלי אוהב/ת", "I know for sure what my partner likes"),

  // ── ממד ד — מסתורין ותשוקה ──
  q("q13", DIM.desire, "אני מרגיש/ה משיכה לבן/בת הזוג שלי", "I feel attracted to my partner"),
  q("q14", DIM.desire, "הסקס שלנו מרגיש כחוויה חדשה, לא חזרה", "Our sex feels like a new experience, not a repeat"),
  q("q15", DIM.desire, "אני מגלה צדדים מפתיעים בבן/בת הזוג שלי", "I discover surprising sides of my partner"),
  q("q16", DIM.desire, "בן/בת הזוג שלי רואה אותי כאדם נחשק/ת - לא רק כהורה או שותף/ה", "My partner sees me as desirable - not just as a parent or a partner"),

  // ── ממד ה — חיבור רגשי בסקס ──
  q("q17", DIM.emotional, "אני חש/ה שהסקס שלנו אינטימי ולא רק טכני", "I sense our sex is intimate, not just technical"),
  q("q18", DIM.emotional, "אחרי סקס אני מרגיש/ה קרוב/ה רגשית לבן/בת הזוג", "After sex I feel emotionally close to my partner"),
  q("q19", DIM.emotional, "אני מרשה לעצמי להיות פגיע/ה בסקס", "I allow myself to be vulnerable during sex"),
  q("q20", DIM.emotional, "הסקס מרגיש לי כחלק טבעי מהזוגיות, לא משימה", "Sex feels to me like a natural part of the relationship, not a chore"),
];

const OPEN: AssessmentReflection = {
  id: "q21_open",
  category: "free",
  type: "reflection",
  domain: null,
  axes: [],
  purpose: "Authentic open signal for the coaching team + AI pain detection.",
  isOpen: true,
  max_length: 600,
  he_prompt: "מה הדבר שהכי היית רוצה שיהיה שונה בחיי המין שלכם - ולא דיברתם עליו עד עכשיו?",
  en_prompt: "What's the one thing you'd most want to be different in your sex life - that you haven't talked about yet?",
};

export const INTIMACY_ASSESSMENT: AssessmentDef = {
  id: "intimacy",
  he_title: "מיניות ותשוקה",
  en_title: "Intimacy & Desire",
  he_tagline: "20 שאלות קצרות שמראות לכם איפה הסקס שלכם חזק - ואיפה כדאי להתחיל.",
  en_tagline: "20 short questions that show where your sex life is strong - and where to start.",
  live: true,
  dimensions: [
    { key: DIM.frequency, he: "תדירות וזמינות", en: "Frequency & availability" },
    { key: DIM.physical, he: "שביעות רצון גופנית", en: "Physical satisfaction" },
    { key: DIM.communication, he: "תקשורת מינית", en: "Sexual communication" },
    { key: DIM.desire, he: "מסתורין ותשוקה", en: "Mystery & desire" },
    { key: DIM.emotional, he: "חיבור רגשי בסקס", en: "Emotional intimacy" },
  ],
  questions: [...QUESTIONS, OPEN],
  total: QUESTIONS.length + 1, // 21
};
