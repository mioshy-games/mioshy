/**
 * lib/assessments/result-content/program.ts
 *
 * Shared "what the Mioshy world gives you" value blocks, rendered on EVERY
 * assessment results page (generic, not per-assessment): the 5 coaching areas
 * the ליווי focuses on (+ the expert-learns-you note), plus a short cross-sell
 * of Couples Games Online and "הסקס של מיאושי".
 *
 * The 5 category names mirror the Journey results page (CMS topic1..5Name) so
 * the two products tell one consistent story.
 */

export interface ProgramCategory {
  he: string;
  en: string;
  desc_he: string;
  desc_en: string;
}

export interface ProgramValue {
  categoriesLabel_he: string;  categoriesLabel_en: string;
  categoriesTitle_he: string;  categoriesTitle_en: string;
  categoriesNote_he: string;   categoriesNote_en: string;
  categories: ProgramCategory[];
  worldLabel_he: string;       worldLabel_en: string;
  gamesTitle_he: string;       gamesTitle_en: string;
  gamesBody_he: string;        gamesBody_en: string;
  sexTitle_he: string;         sexTitle_en: string;
  sexBody_he: string;          sexBody_en: string;
}

export const PROGRAM_VALUE: ProgramValue = {
  categoriesLabel_he: "על מה נעבוד בליווי",
  categoriesLabel_en: "What we'll work on in the program",
  categoriesTitle_he: "חמשת התחומים שהליווי שלנו מתמקד בהם",
  categoriesTitle_en: "The five areas our coaching focuses on",
  categoriesNote_he: "תוך כדי, המומחה/ית שלנו לומד/ת אתכם ונותן/ת לכם כלים שמתאימים לכם אישית ולצרכים שלכם.",
  categoriesNote_en: "Along the way, your expert learns you and gives you tools tailored personally to you and your needs.",
  categories: [
    { he: "תקשורת זוגית", en: "Couple communication", desc_he: "איך אנחנו מדברים, מקשיבים ופותרים אי-הסכמות", desc_en: "How we talk, listen, and resolve disagreements" },
    { he: "מיניות ואינטימיות", en: "Sexuality & intimacy", desc_he: "החיים המיניים, המגע, הקרבה הפיזית והרצון", desc_en: "Sex life, touch, physical closeness, desire" },
    { he: "אהבה וחיבור רגשי", en: "Love & emotional connection", desc_he: "תחושת קרבה, ביטויי אהבה ופתיחות רגשית", desc_en: "Closeness, expressions of love, emotional openness" },
    { he: "חברות ושותפות יומיומית", en: "Friendship & daily partnership", desc_he: "כיף, חוויות משותפות והתנהלות יומיומית", desc_en: "Fun, shared experiences, daily life" },
    { he: "משפחה, הורות ולחצים חיצוניים", en: "Family, parenting & outside pressures", desc_he: "הורות, משפחה מורחבת והתמודדות עם לחצים מבחוץ", desc_en: "Parenting, extended family, outside pressures" },
  ],
  worldLabel_he: "וזה לא הכל - העולם של מיאושי",
  worldLabel_en: "And that's not all - the world of Mioshy",
  gamesTitle_he: "משחקי זוגות אונליין",
  gamesTitle_en: "Couples games online",
  gamesBody_he: "עשרות משחקים לזוגות - גלגל, שאלות ואתגרים - להצית שיחה, צחוק וקרבה בכל רגע שבא לכם.",
  gamesBody_en: "Dozens of couples games - a wheel, questions and challenges - to spark conversation, laughter and closeness whenever you feel like it.",
  sexTitle_he: "הסקס של מיאושי",
  sexTitle_en: "Mioshy's intimacy collection",
  sexBody_he: "תכנים ומשחקים למבוגרים בלבד - להעמיק את התשוקה, לשבור שגרה ולגלות צדדים חדשים בחדר השינה.",
  sexBody_en: "Adults-only content and games - to deepen desire, break routine and discover new sides in the bedroom.",
};
