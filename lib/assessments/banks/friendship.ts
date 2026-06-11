/**
 * lib/assessments/banks/friendship.ts
 *
 * Assessment 2 — חברות וקרבה רגשית (Friendship & emotional closeness).
 * 5 dimensions × 4 Likert + 1 open reflection (Q21). Hebrew is source of truth
 * (Itzik approved 2026-06-07). Gendered slash phrasing, grounded in the
 * friendship + emotional_connection content items. No reverse-scored items.
 *
 * Static array = seed-of-record + runtime fallback; live questions are in the
 * DB table assessment_questions (migration 110), editable from the admin.
 */

import type { AssessmentDef, AssessmentLikert, AssessmentReflection } from "../types";

const DIM = {
  daily: "daily_us_moments",
  appreciate: "appreciative_gaze",
  vulnerability: "mutual_vulnerability",
  knowing: "knowing_partner_today",
  rituals: "couple_rituals",
} as const;

function q(id: string, dimension: string, he: string, en: string, reverse = false): AssessmentLikert {
  return { id, category: "free", type: "likert5", domain: null, axes: [], purpose: "", dimension, reverse, he, en };
}

const QUESTIONS: AssessmentLikert[] = [
  // ── ממד א — רגעי "אנחנו" יומיים ──
  q("q01", DIM.daily, "יש לנו רגעי חיבור קטנים ביום-יום, בלי תכנון מראש", "We have small moments of connection in daily life, without planning"),
  q("q02", DIM.daily, "אנחנו צוחקים יחד", "We laugh together"),
  q("q03", DIM.daily, "כשאני נכנס/ת הביתה, מחכה לי רגע של מבט, חיבוק או שאלה אישית - לא רק לוגיסטיקה", "When I come home, a look, a hug or a personal question is waiting for me - not just logistics"),
  q("q04", DIM.daily, "ערב רגיל עם בן/בת הזוג מרגיש לי כיף", "An ordinary evening with my partner feels fun to me"),

  // ── ממד ב — מבט מעריך ──
  q("q05", DIM.appreciate, "כשבן/בת הזוג עושה משהו טוב, אני שם/ה לב ואומר/ת לו/ה", "When my partner does something good, I notice and tell them"),
  q("q06", DIM.appreciate, "אני מודע/ת לתכונות שאני מעריך/ה בבן/בת הזוג", "I'm aware of the traits I appreciate in my partner"),
  q("q07", DIM.appreciate, "בן/בת הזוג מוקיר/ה אותי על דברים ספציפיים - לא רק 'תודה' כללי", "My partner cherishes me for specific things - not just a general thanks"),
  q("q08", DIM.appreciate, "כשאני חושב/ת על בן/בת הזוג, עולה בי משהו חיובי", "When I think about my partner, something positive comes up in me"),

  // ── ממד ג — פגיעות הדדית ──
  q("q09", DIM.vulnerability, "אני מרגיש/ה נוח לחלוק עם בן/בת הזוג פחדים או חולשות", "I feel comfortable sharing fears or weaknesses with my partner"),
  q("q10", DIM.vulnerability, "אני מרגיש/ה שבן/בת הזוג נוח/ה לשתף אותי בדברים פנימיים, לא רק תפעוליים", "I feel my partner is comfortable sharing inner things with me, not just logistics"),
  q("q11", DIM.vulnerability, "אחרי שיחה אינטימית אני מרגיש/ה קרוב/ה יותר לבן/בת הזוג", "After an intimate conversation I feel closer to my partner"),
  q("q12", DIM.vulnerability, "אנחנו מצליחים להתגבר מהר על ויכוח ולחזור לשגרה בלי טעם רע", "We manage to recover quickly from an argument and return to routine without a bad aftertaste"),

  // ── ממד ד — היכרות וקרבה עדכנית ──
  q("q13", DIM.knowing, "בן/בת הזוג שלי מרגיש/ה בנוח לשתף אותי בדברים מהותיים בחייו/ה", "My partner feels comfortable sharing meaningful things in their life with me"),
  q("q14", DIM.knowing, "אנחנו אוהבים לבלות את הזמן הפנוי שלנו יחד", "We love spending our free time together"),
  q("q15", DIM.knowing, "אני מכיר/ה את החברים הקרובים של בן/בת הזוג עכשיו", "I know my partner's close friends right now"),
  q("q16", DIM.knowing, "אני שם/ה לב לשינויים שבן/בת הזוג עבר/ה בשנה האחרונה", "I notice the changes my partner has been through in the past year"),

  // ── ממד ה — טקסים זוגיים ──
  q("q17", DIM.rituals, "יש לנו טקסים יומיים שרק שלנו (קפה בבוקר, שיחה לפני שינה וכד')", "We have daily rituals that are just ours (morning coffee, a talk before bed, etc.)"),
  q("q18", DIM.rituals, "יש לנו דייט שבועי קבוע - או משהו דומה", "We have a regular weekly date - or something similar"),
  q("q19", DIM.rituals, "אנחנו חוגגים יחד גם הצלחות קטנות", "We celebrate even small successes together"),
  q("q20", DIM.rituals, "יש לנו 'דברים שלנו' - בדיחות פנימיות, מקומות, שירים שרק אנחנו מבינים", "We have 'our things' - inside jokes, places, songs only we get"),
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
  he_prompt: "מתי הייתה הפעם האחרונה שהרגשת קרוב/ה לבן/בת הזוג שלך באמת? מה קרה ברגע ההוא?",
  en_prompt: "When was the last time you truly felt close to your partner? What happened in that moment?",
};

export const FRIENDSHIP_ASSESSMENT: AssessmentDef = {
  id: "friendship",
  he_title: "חברות וקרבה רגשית",
  en_title: "Friendship & emotional closeness",
  he_tagline: "20 שאלות קצרות על הקרבה, החברות והרגעים הקטנים שמחזיקים זוגיות.",
  en_tagline: "20 short questions about closeness, friendship and the small moments that hold a relationship.",
  live: true,
  dimensions: [
    { key: DIM.daily, he: "קרבה יומיומית", en: "Daily closeness" },
    { key: DIM.appreciate, he: "הערכה והוקרה", en: "Appreciation" },
    { key: DIM.vulnerability, he: "פתיחות רגשית", en: "Emotional openness" },
    { key: DIM.knowing, he: "היכרות וסקרנות", en: "Knowing & curiosity" },
    { key: DIM.rituals, he: "טקסים ומסורות", en: "Rituals & traditions" },
  ],
  questions: [...QUESTIONS, OPEN],
  total: QUESTIONS.length + 1,
};
