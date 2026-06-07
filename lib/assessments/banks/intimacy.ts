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

const QUESTIONS: AssessmentLikert[] = [
  // ── ממד א — תדירות וזמינות ──
  q("q01", DIM.frequency, "תדירות הסקס שלנו מספקת אותי", "The frequency of our sex satisfies me"),
  q("q02", DIM.frequency, "כשאחד מאיתנו רוצה סקס, השני נענה ברצון", "When one of us wants sex, the other responds willingly"),
  q("q03", DIM.frequency, "אני מצליחה ליזום סקס בקלות כשאני רוצה", "I can initiate sex easily when I want to"),
  q("q04", DIM.frequency, "יש מקום לסקס בחיים העמוסים שלנו", "There's room for sex in our busy lives"),

  // ── ממד ב — שביעות רצון גופנית ──
  q("q05", DIM.physical, "הסקס שלנו מספק אותי גופנית", "Our sex satisfies me physically"),
  q("q06", DIM.physical, "אני יודעת לבקש את מה שאני אוהבת במגע", "I know how to ask for what I like in touch"),
  q("q07", DIM.physical, "הסקס שלנו מתנהל בקצב שמתאים לי", "Our sex moves at a pace that suits me"),
  q("q08", DIM.physical, "אני מרגישה נינוחה גופנית בסקס שלנו", "I feel physically at ease during our sex"),

  // ── ממד ג — תקשורת מינית ──
  q("q09", DIM.communication, "אנחנו מדברים על הסקס שלנו ברגיעה ובלי בושה", "We talk about our sex calmly and without shame"),
  q("q10", DIM.communication, "אני מבקשת את מה שאני זקוקה לו בסקס", "I ask for what I need in sex"),
  q("q11", DIM.communication, "כשמשהו לא עובד טוב, אנחנו מצליחים לדבר עליו מחוץ לחדר השינה", "When something isn't working, we manage to talk about it outside the bedroom"),
  q("q12", DIM.communication, "אני יודעת בוודאות מה בן הזוג שלי אוהב", "I know for sure what my partner likes"),

  // ── ממד ד — מסתורין ותשוקה ──
  q("q13", DIM.desire, "אני מרגישה משיכה לבן הזוג שלי", "I feel attracted to my partner"),
  q("q14", DIM.desire, "הסקס שלנו מרגיש כחוויה חדשה, לא חזרה", "Our sex feels like a new experience, not a repeat"),
  q("q15", DIM.desire, "אני מגלה צדדים מפתיעים בבן הזוג שלי", "I discover surprising sides of my partner"),
  q("q16", DIM.desire, "בן הזוג שלי רואה אותי כאדם נחשק - לא רק כאמא או שותפה", "My partner sees me as desirable - not just as a mother or a partner"),

  // ── ממד ה — חיבור רגשי בסקס ──
  q("q17", DIM.emotional, "הסקס שלנו מרגיש לי אינטימי ולא רק טכני", "Our sex feels intimate to me, not just technical"),
  q("q18", DIM.emotional, "אחרי סקס אני מרגישה קרובה רגשית לבן הזוג", "After sex I feel emotionally close to my partner"),
  q("q19", DIM.emotional, "אני מרשה לעצמי להיות פגיעה בסקס", "I allow myself to be vulnerable during sex"),
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
