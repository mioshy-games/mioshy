/**
 * lib/assessments/result-content/intimacy.ts
 *
 * Results copy + per-dimension feedback for the intimacy assessment.
 * Feedback is grounded in the intimacy content items (book/items-cleaned.csv):
 * a low score in a dimension points the couple at the very tools that address
 * it. Voice follows the human-first, benefit-leaning Mioshy style (no clinical
 * tone, no scare language).
 */

import type { AssessmentResultContent } from "./index";

export const INTIMACY_RESULT_CONTENT: AssessmentResultContent = {
  weakBelow: 60,
  feedback: {
    frequency_availability: {
      strong_he: "יש ביניכם זמינות וזרימה מינית טובה - בסיס מצוין להעמיק ממנו.",
      strong_en: "You have good sexual availability and flow - a great base to build on.",
      weak_he: "נראה שהקצב המיני ביניכם לא תמיד מסונכרן. זה מהדברים הכי שכיחים בזוגיות ארוכה, ויש דרכים מעשיות לגשר על קצבים שונים ולפנות מקום לסקס גם בשגרה עמוסה.",
      weak_en: "Your sexual rhythms aren't always in sync. It's one of the most common things in a long relationship, and there are practical ways to bridge different paces and make room for sex even in a busy routine.",
    },
    physical_satisfaction: {
      strong_he: "הגוף שלכם נוכח ונהנה בסקס - נכס אמיתי.",
      strong_en: "Your body is present and enjoying sex - a real asset.",
      weak_he: "ההנאה הגופנית עדיין לא במלואה. הרבה פעמים זה קשור למתח שנשאר בגוף ולקושי להיות נוכחים בתחושות - שני דברים שאפשר לשחרר ולשנות.",
      weak_en: "Physical pleasure isn't yet at its fullest. Often it's about tension the body holds and difficulty staying present in sensation - both can be released.",
    },
    sexual_communication: {
      strong_he: "אתם מצליחים לדבר על הסקס ביניכם - וזה משנה הכל.",
      strong_en: "You manage to talk about your sex - and that changes everything.",
      weak_he: "עדיין קצת קשה לכם לבקש את מה שאתם רוצים, או לדבר על מה שלא עובד. שיחה על מין מחוץ לחדר השינה, בלי בושה ובלי שזה הופך לריב, היא המפתח.",
      weak_en: "It's still a bit hard to ask for what you want, or to talk about what isn't working. Talking about sex outside the bedroom, without shame and without it turning into a fight, is the key.",
    },
    mystery_desire: {
      strong_he: "עדיין יש ביניכם משיכה וסקרנות - אש ששווה לתחזק.",
      strong_en: "There's still attraction and curiosity between you - a fire worth tending.",
      weak_he: "המשיכה והמסתורין דועכים מעט - תופעה טבעית לגמרי בזוגיות, ואפשר להפוך אותה. הפתעה, מבט מחדש על בן/בת הזוג, וקצת מרחק - מחזירים את הרצון.",
      weak_en: "Attraction and mystery have faded a little - completely natural, and reversible. Surprise, seeing your partner anew, and a bit of distance bring desire back.",
    },
    emotional_intimacy: {
      strong_he: "הסקס שלכם נושא חיבור רגשי - וזה הלב של אינטימיות אמיתית.",
      strong_en: "Your sex carries emotional connection - the heart of real intimacy.",
      weak_he: "הסקס עדיין מרגיש לפעמים טכני יותר מאינטימי. החיבור הרגשי שלפני ואחרי, והרשות להיות פגיעים, הם מה שהופך אותו לעמוק וקרוב.",
      weak_en: "Sex still feels at times more technical than intimate. The emotional connection before and after, and allowing yourselves to be vulnerable, are what make it deep and close.",
    },
  },
  copy: {
    feedbackLabel_he: "מה התשובות שלכם מספרות",
    feedbackLabel_en: "What your answers tell",
    feedbackTitle_he: "המשוב האישי שלכם",
    feedbackTitle_en: "Your personal feedback",
    startHerePrefix_he: "כדאי להתחיל מ",
    startHerePrefix_en: "Start with ",
    gainsTitle_he: "מה ישתנה אצלכם בליווי",
    gainsTitle_en: "What will change for you",
    gains_he: [
      "תחזירו את המשיכה והפרפרים בבטן",
      "תלמדו לדבר על מה שאתם רוצים בלי בושה",
      "הסקס יחזור להרגיש אינטימי, לא משימה",
      "תגלו צדדים חדשים אחד בשני",
    ],
    gains_en: [
      "Bring back attraction and the butterflies",
      "Learn to talk about what you want without shame",
      "Sex feels intimate again, not a chore",
      "Discover new sides of each other",
    ],
    expertTitle_he: "מומחה/ית זוגיות צמוד/ה, בצ'אט פרטי",
    expertTitle_en: "A couples expert by your side, in private chat",
    expertBody_he: "לאורך כל הדרך יש לכם מומחה/ית זוגיות אמיתי/ת בצ'אט אישי - לומד/ת אתכם, עונה על כל שאלה, ומתאים/ה את התוכן בדיוק למה שעולה אצלכם.",
    expertBody_en: "All along the way you have a real couples expert in a private chat - learning you, answering every question, and tailoring the content to exactly what comes up for you.",
    offerTitle_he: "תוכנית הליווי האישית של מיאושי",
    offerSub_he: "פרק אישי בכל שבוע בנושאי מיניות וזוגיות, מומחה/ית זמין/ה בצ'אט, והכל מותאם בדיוק לתוצאות שלכם.",
    offerTitle_en: "Mioshy's personal coaching program",
    offerSub_en: "A personal chapter each week on intimacy and relationship, an expert available in chat, all tailored to your results.",
    fallbackHero_he: "בליווי עם מיאושי תחזירו את התשוקה והקרבה, והסקס יחזור להרגיש אינטימי וטבעי.",
    fallbackHero_en: "With Mioshy's coaching you'll bring back desire and closeness, and sex will feel intimate and natural again.",
    priceOriginal_he: "127 ₪",
    priceOriginal_en: "$36",
    priceAmount_he: "57",
    priceAmount_en: "$17",
    pricePeriod_he: "₪ / שבוע",
    pricePeriod_en: "/ week",
    reassurance_he: "ניתן לעצור בכל עת.",
    reassurance_en: "You can stop at any time.",
    cta_he: "מצטרפים לליווי",
    cta_en: "Join the program",
  },
};
