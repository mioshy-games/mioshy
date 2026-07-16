/**
 * lib/journey/category-feedback.ts
 *
 * Per-category personal feedback COPY for the Journey assessment results
 * ("המשוב האישי שלכם"). Driven by the computed
 * `analysis.summary.category_scores` (0..100 + lowest_key) — no new scoring.
 *
 * Category KEYS, display NAMES and ORDER live in the single source of truth
 * `lib/journey/categories.ts` (`CATEGORY_LABELS`, `CATEGORY_DISPLAY_ORDER`).
 * This file only owns the three-band feedback text.
 *
 * Three bands per category, selected by the couple's real score via
 * `categoryBand()` (< 50 weak · 50–79 medium · 80+ strong). Additive only —
 * does not touch journey scoring, the bar chart, the AI hero, or the CTA.
 * `en` copy for weak/strong is unchanged (phase 1 rewrites Hebrew only);
 * `en` medium is a light translation of the new Hebrew.
 */

import type { CategoryKey } from "./categories";
export type { CategoryKey };

export interface CategoryFeedback {
  weak_he: string;
  weak_en: string;
  medium_he: string;
  medium_en: string;
  strong_he: string;
  strong_en: string;
}

export const CATEGORY_FEEDBACK: Record<CategoryKey, CategoryFeedback> = {
  communication: {
    weak_he: "יש קושי לדבר ולהקשיב בלי שהשיחה מסלימה או נתקעת. דברים חשובים נשארים לא נאמרים, וזה מצטבר לתסכול ולתחושה שלא באמת שומעים אתכם.",
    weak_en: "Communication gets stuck at times - talks that escalate, or ones left unsaid. A soft start-up, hearing the feeling under the words, and repair after a fight change everything.",
    medium_he: "אתם מתקשרים טוב ברוב הזמן, אבל כשהשיחה נטענת היא נוטה להסלים או להיתקע. יש בסיס טוב, ומקום לחזק את ההקשבה ברגעים הקשים.",
    medium_en: "You communicate well most of the time, but when a talk gets loaded it tends to escalate or stall. A good base, with room to strengthen listening in the hard moments.",
    strong_he: "אתם יודעים לדבר ולהקשיב באמת, גם כשקשה. יש ביניכם מרחב בטוח להגיד את מה שחשוב.",
    strong_en: "You communicate well - you talk, listen, and recover after conflict. A strong base to build on.",
  },
  intimacy: {
    weak_he: "הקרבה הפיזית והתשוקה נדחקו הצידה. שגרה, עייפות וקושי לדבר על מין יוצרים מרחק, ולעיתים תסכול שקשה לומר בקול.",
    weak_en: "Physical closeness and desire aren't always present. Routine, tension and difficulty talking about sex create distance - and the spark can return.",
    medium_he: "יש ביניכם קרבה פיזית, אבל התשוקה עולה ויורדת - שגרה ועייפות לפעמים מרחיקות, ויש מקום לחדש ולחזק אותה.",
    medium_en: "There's physical closeness between you, but desire rises and falls - routine and fatigue sometimes create distance, and there's room to renew and strengthen it.",
    strong_he: "יש ביניכם תשוקה וקרבה פיזית שנשמרות לאורך זמן, ואתם מצליחים לדבר על מה שטוב לכם.",
    strong_en: "There's desire and physical closeness between you - a fire worth tending.",
  },
  emotional_connection: {
    weak_he: "יש ריחוק רגשי שמורגש בשגרה - לפעמים אתם חיים זה לצד זה ולא ביחד, וזה מצטבר לתסכול ולחוסר שביעות רצון הדדי.",
    weak_en: "The emotional connection is a little thin - sometimes living side by side rather than together. Small moments, appreciation and openness bring you close again.",
    medium_he: "יש ביניכם חיבור רגשי טוב, אבל הוא לא תמיד נוכח - בשגרה העמוסה הקרבה לפעמים נדחקת, ויש מקום לחזק אותה.",
    medium_en: "You have a good emotional connection, but it isn't always present - in the busy routine the closeness sometimes gets squeezed, and there's room to strengthen it.",
    strong_he: "יש ביניכם חום וקרבה שמחזיקים גם בימים עמוסים. אתם מרגישים מחוברים ורואים זה את זה.",
    strong_en: "You have a real emotional connection - closeness and expressions of love. A precious asset.",
  },
  friendship: {
    weak_he: "היומיום הפך בעיקר לשגרה וניהול הבית - מי עושה מה. פחות צחוק והנאה משותפת, ויותר תחושה של שני שותפים לבית מאשר של חברים.",
    weak_en: "Friendship and everyday fun get squeezed out a bit. Small rituals, shared laughter and 'us' moments bring the partnership back.",
    medium_he: "יש ביניכם שותפות טובה ביומיום, אבל לפעמים היא נבלעת בשגרה ובניהול הבית. יש מקום ליותר צחוק והנאה משותפת מהדברים הקטנים.",
    medium_en: "You have a good everyday partnership, but sometimes it gets swallowed by routine and running the home. There's room for more laughter and shared enjoyment of the small things.",
    strong_he: "אתם נהנים אחד מהשני ביומיום, לא רק מנהלים אותו. יש ביניכם חברות, צחוק ושותפות אמיתית.",
    strong_en: "You're good friends - fun, partnership and rituals of your own. The heart of a stable relationship.",
  },
  family: {
    weak_he: "הלחצים מבחוץ - ילדים, משפחה, עבודה - נכנסים פנימה ודוחקים את הזוגיות לסוף הרשימה. אתם מוצאים את עצמכם צוות לוגיסטי יותר מאשר זוג.",
    weak_en: "Parenting, family and outside life take their toll. Aligning expectations and standing as one front ease the load.",
    medium_he: "אתם מתמודדים לא רע עם הלחצים מבחוץ, אבל הם עדיין גובים מחיר מהזוגיות. יש מקום לשמור עליכם כעדיפות גם כשעמוס.",
    medium_en: "You handle the outside pressures reasonably well, but they still take a toll on the relationship. There's room to keep yourselves a priority even when it's busy.",
    strong_he: "אתם עומדים יחד מול הלחצים מבחוץ כחזית אחת, ושומרים על הזוגיות כעדיפות גם כשעמוס.",
    strong_en: "You manage parenting and outside pressures together - a partnership that holds.",
  },
};
