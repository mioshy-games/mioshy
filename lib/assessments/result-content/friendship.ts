/**
 * lib/assessments/result-content/friendship.ts
 *
 * Results copy + per-dimension feedback for the friendship & emotional
 * closeness assessment. Feedback grounded in the friendship +
 * emotional_connection content items. Same human-first voice as intimacy.
 */

import type { AssessmentResultContent } from "./index";

export const FRIENDSHIP_RESULT_CONTENT: AssessmentResultContent = {
  weakBelow: 60,
  feedback: {
    daily_us_moments: {
      strong_he: "יש ביניכם הרבה רגעים קטנים וטובים ביום-יום, והרבה צחוק. בדיוק הדברים שמחזיקים זוגיות.",
      strong_en: "You share lots of small, good moments day to day, and plenty of laughter. Exactly what keeps a relationship strong.",
      weak_he: "הרגעים הקטנים ביום-יום נדחקים בלחץ של החיים. דווקא הם, מבט או צחוק משותף, מה שמקרב - וקל להחזיר אותם.",
      weak_en: "The small daily moments get pushed aside by the pressure of life. Yet those are what bring you close, and they are easy to bring back.",
    },
    appreciative_gaze: {
      strong_he: "אתם שמים לב לטוב אחד אצל השני ואומרים אותו. ההערכה הזו היא הבסיס לביטחון בזוגיות.",
      strong_en: "You notice the good in each other and say it out loud. That appreciation is the basis of security in a relationship.",
      weak_he: "קל לראות מה מפריע ולשכוח להגיד מה טוב. כשמתחילים לשים לב לדברים הטובים ולומר אותם, האווירה משתנה.",
      weak_en: "It's easy to see what bothers you and forget to say what's good. When you start noticing the good and saying it, the atmosphere shifts.",
    },
    mutual_vulnerability: {
      strong_he: "אתם מרגישים בנוח להיפתח אחד מול השני. הפתיחות הזו היא הלב של קרבה אמיתית.",
      strong_en: "You feel comfortable opening up to each other. That openness is the heart of real closeness.",
      weak_he: "עדיין לא תמיד קל להיפתח ולספר מה באמת מרגישים. ככל שמרגישים בטוחים יותר לשתף, הקרבה מעמיקה.",
      weak_en: "It isn't always easy yet to open up and share what you really feel. The safer you feel sharing, the deeper the closeness.",
    },
    knowing_partner_today: {
      strong_he: "אתם מכירים אחד את השני טוב ונהנים מהזמן המשותף. זו שותפות חיה.",
      strong_en: "You know each other well and enjoy your time together. That's a living partnership.",
      weak_he: "החיים שוחקים, וקל לאבד קשר עם מה שעובר על בן/בת הזוג. קצת סקרנות וזמן יחד מחזירים את הקרבה.",
      weak_en: "Life wears you down, and it's easy to lose touch with what your partner is going through. A little curiosity and time together bring the closeness back.",
    },
    couple_rituals: {
      strong_he: "יש לכם טקסים ורגעים קבועים שהם רק שלכם. אלה העוגנים שמייצבים זוגיות לאורך שנים.",
      strong_en: "You have rituals and regular moments that are just yours. These are the anchors that keep a relationship steady over the years.",
      weak_he: "חסרים רגעים קבועים שהם רק שלכם - קפה בבוקר, דייט שבועי, חגיגה קטנה. הם שהופכים שגרה לזוגיות.",
      weak_en: "You're missing regular moments that are just yours - morning coffee, a weekly date, a small celebration. Those turn routine into a relationship.",
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
      "תחזירו את הצחוק והרגעים הקטנים",
      "תרגישו שרואים ומעריכים אתכם",
      "שיחות אמיתיות יחזרו ביניכם",
      "תהיו שוב 'אנחנו'",
    ],
    gains_en: [
      "Bring back the laughter and small moments",
      "Feel seen and appreciated",
      "Real conversations return between you",
      "Be 'us' again",
    ],
    expertTitle_he: "מומחה/ית זוגיות צמוד/ה, בצ'אט פרטי",
    expertTitle_en: "A couples expert by your side, in private chat",
    expertBody_he: "לאורך כל הדרך יש לכם מומחה/ית זוגיות אמיתי/ת בצ'אט אישי - לומד/ת אתכם, עונה על כל שאלה, ומתאים/ה את התוכן בדיוק למה שעולה אצלכם.",
    expertBody_en: "All along the way you have a real couples expert in a private chat - learning you, answering every question, and tailoring the content to exactly what comes up for you.",
    offerTitle_he: "תוכנית הליווי האישית של מיאושי",
    offerSub_he: "פרק אישי בכל שבוע על קרבה, חברות וחיבור רגשי, מומחה/ית זמין/ה בצ'אט, והכל מותאם בדיוק לתוצאות שלכם.",
    offerTitle_en: "Mioshy's personal coaching program",
    offerSub_en: "A personal chapter each week on closeness, friendship and emotional connection, an expert available in chat, all tailored to your results.",
    fallbackHero_he: "בליווי עם מיאושי תחזרו לראות אחד את השני, החברות תתחזק והקרבה תעמיק.",
    fallbackHero_en: "With Mioshy's coaching you'll see each other again, your friendship will grow and your closeness will deepen.",
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
