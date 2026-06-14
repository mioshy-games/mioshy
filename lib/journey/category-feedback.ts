/**
 * lib/journey/category-feedback.ts
 *
 * Per-category personal feedback for the Journey assessment results
 * ("המשוב האישי שלכם"). Mirrors the standalone-assessment feedback pattern,
 * but for the 5 broad Journey categories. Driven by the existing
 * `analysis.summary.category_scores` (0..100 + lowest_key) — no new scoring.
 *
 * Feedback is grounded in the Mioshy content library for each category
 * (book/items-cleaned.csv: communication/intimacy/emotional_connection/
 * friendship/family). Two bands per category (strong / needs-work), selected
 * by the couple's real score. Additive only — does not touch journey scoring,
 * the bar chart, the AI hero, or the CTA.
 */

export const CATEGORY_WEAK_BELOW = 60;

export type CategoryKey =
  | "communication"
  | "intimacy"
  | "emotional_connection"
  | "friendship"
  | "family";

export interface CategoryFeedback {
  he: string; // label
  en: string;
  strong_he: string;
  strong_en: string;
  weak_he: string;
  weak_en: string;
}

export const CATEGORY_FEEDBACK: Record<CategoryKey, CategoryFeedback> = {
  communication: {
    he: "תקשורת זוגית",
    en: "Couple communication",
    strong_he: "אתם מתקשרים טוב - מצליחים לדבר, להקשיב ולהתאושש מוויכוח. בסיס חזק שאפשר לבנות עליו.",
    strong_en: "You communicate well - you talk, listen, and recover after conflict. A strong base to build on.",
    weak_he: "התקשורת ביניכם נתקעת לפעמים - שיחות שמסלימות, או כאלה שלא נאמרות. פתיחה רכה, הקשבה לרגש שמתחת למילים ותיקון אחרי ריב משנים הכל.",
    weak_en: "Communication gets stuck at times - talks that escalate, or ones left unsaid. A soft start-up, hearing the feeling under the words, and repair after a fight change everything.",
  },
  intimacy: {
    he: "מיניות ואינטימיות",
    en: "Sexuality & intimacy",
    strong_he: "יש ביניכם תשוקה וקרבה פיזית - אש ששווה לתחזק.",
    strong_en: "There's desire and physical closeness between you - a fire worth tending.",
    weak_he: "הקרבה הפיזית והתשוקה לא תמיד נוכחות. שגרה, מתח וקושי לדבר על מין מרחיקים - ואפשר להחזיר את הניצוץ.",
    weak_en: "Physical closeness and desire aren't always present. Routine, tension and difficulty talking about sex create distance - and the spark can return.",
  },
  emotional_connection: {
    he: "אהבה וחיבור רגשי",
    en: "Love & emotional connection",
    strong_he: "יש ביניכם חיבור רגשי אמיתי - תחושת קרבה וביטויי אהבה. נכס יקר.",
    strong_en: "You have a real emotional connection - closeness and expressions of love. A precious asset.",
    weak_he: "החיבור הרגשי קצת דק - לפעמים חיים זה לצד זה ולא ביחד. רגעים קטנים, הערכה ופתיחות רגשית מקרבים מחדש.",
    weak_en: "The emotional connection is a little thin - sometimes living side by side rather than together. Small moments, appreciation and openness bring you close again.",
  },
  friendship: {
    he: "חברות ושותפות יומיומית",
    en: "Friendship & daily partnership",
    strong_he: "אתם חברים טובים - יש כיף, שותפות וטקסים משלכם. הלב של זוגיות יציבה.",
    strong_en: "You're good friends - fun, partnership and rituals of your own. The heart of a stable relationship.",
    weak_he: "החברות והכיף היומיומי נדחקים מעט. טקסים קטנים, צחוק משותף ורגעי 'אנחנו' מחזירים את השותפות.",
    weak_en: "Friendship and everyday fun get squeezed out a bit. Small rituals, shared laughter and 'us' moments bring the partnership back.",
  },
  family: {
    he: "משפחה, הורות ולחצים חיצוניים",
    en: "Family, parenting & outside pressures",
    strong_he: "אתם מנהלים יחד את ההורות והלחצים מבחוץ - שותפות שמחזיקה.",
    strong_en: "You manage parenting and outside pressures together - a partnership that holds.",
    weak_he: "לחצים של הורות, משפחה וחיים מבחוץ גובים מכם. תיאום ציפיות וחזית אחת מקלים את העומס.",
    weak_en: "Parenting, family and outside life take their toll. Aligning expectations and standing as one front ease the load.",
  },
};

/** Fixed render order (matches the bar chart). */
export const CATEGORY_ORDER: CategoryKey[] = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
];
