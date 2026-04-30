import type { GameConfig, Question } from "./types";

/**
 * Default Snakes & Ladders configuration used by LOCAL (pass-the-phone)
 * mode. Remote mode loads its config from the `snakes_ladders_config`
 * table in Supabase so admins can tune it; local mode is frozen so it
 * keeps working even when someone plays offline.
 *
 * Design choices:
 *   • 10×10 board (100 cells), winning cell = 100.
 *   • ~6 ladders and ~6 snakes, distributed across the board so the
 *     middle section remains interesting.
 *   • A short starter set of couples-appropriate questions/challenges
 *     in Hebrew - enough for a fun session without feeling scripted.
 */

const STARTER_QUESTIONS: Question[] = [
  // ── Level 1 - קליל (light warm-up) ───────────────────────────────────────
  {
    id: "q-local-3",
    type: "question",
    text_he: "איזה רגע ביחד הכי מצחיק שאתה זוכר?",
    text_en: "What's the funniest moment we've had together?",
    category: "fun",
    level: 1,
  },
  {
    id: "q-local-4",
    type: "question",
    text_he: "מה משהו קטן שאני עושה שממלא אותך שמחה?",
    text_en: "What's a small thing I do that makes you happy?",
    category: "love",
    level: 1,
  },
  {
    id: "q-local-6",
    type: "question",
    text_he: "מה שיר שמזכיר לך אותי?",
    text_en: "What song reminds you of me?",
    category: "love",
    level: 1,
  },
  {
    id: "q-local-14",
    type: "question",
    text_he: "איזה רגע קטן היום גרם לך לחייך?",
    text_en: "What small moment today made you smile?",
    category: "gratitude",
    level: 1,
  },
  {
    id: "q-local-5",
    type: "question",
    text_he: "איזה חופשה היית רוצה שנצא אליה בשנה הקרובה?",
    text_en: "What's a trip you'd love us to take this year?",
    category: "future",
    level: 1,
  },
  {
    id: "q-local-7",
    type: "challenge",
    text_he: "תנו חיבוק של 20 שניות בלי לדבר.",
    text_en: "Give each other a 20-second hug, no talking.",
    category: "intimacy",
    level: 1,
  },
  {
    id: "q-local-13",
    type: "challenge",
    text_he: "רקדו דקה לשיר שהדליק אתכם פעם.",
    text_en: "Dance for a minute to a song that used to light you up.",
    category: "fun",
    level: 1,
  },
  // ── Level 2 - בינוני (medium) ─────────────────────────────────────────────
  {
    id: "q-local-2",
    type: "question",
    text_he: "מה הדבר הראשון שמשך אותך אליי?",
    text_en: "What first drew you to me?",
    category: "love",
    level: 2,
  },
  {
    id: "q-local-11",
    type: "question",
    text_he: "מה החוזקה הכי גדולה שלך שלא תמיד רואים?",
    text_en: "What's your greatest strength people don't always see?",
    category: "self",
    level: 2,
  },
  {
    id: "q-local-12",
    type: "question",
    text_he: "מה הדבר הכי אמיץ שעשית בשנה האחרונה?",
    text_en: "What's the bravest thing you did this past year?",
    category: "self",
    level: 2,
  },
  {
    id: "q-local-16",
    type: "question",
    text_he: "מה הדבר הכי רומנטי שאפשר לעשות השבוע?",
    text_en: "What's the most romantic thing we could do this week?",
    category: "love",
    level: 2,
  },
  {
    id: "q-local-8",
    type: "challenge",
    text_he: "אמר/י שלושה מחמאות עכשיו, עין בעין.",
    text_en: "Say three compliments now, eyes locked.",
    category: "intimacy",
    level: 2,
  },
  {
    id: "q-local-15",
    type: "challenge",
    text_he: "שלחו הודעת תודה קצרה למישהו שחשוב לכם.",
    text_en: "Send a short thank-you note to someone who matters.",
    category: "gratitude",
    level: 2,
  },
  // ── Level 3 - מאתגר (deep / bold) ────────────────────────────────────────
  {
    id: "q-local-1",
    type: "question",
    text_he: "מה החלום הכי גדול שלך שעדיין לא סיפרת עליו?",
    text_en: "What's your biggest dream you haven't shared yet?",
    category: "love",
    level: 3,
  },
  {
    id: "q-local-9",
    type: "challenge",
    text_he: "ספרו על פעם ששני אחד הציל את השני ברגע טעון.",
    text_en: "Tell about a time one of you saved the other in a charged moment.",
    category: "memories",
    level: 3,
  },
  {
    id: "q-local-10",
    type: "challenge",
    text_he: "צרו רגע של קשר עין ללא מילים למשך דקה.",
    text_en: "Make a full minute of wordless eye contact.",
    category: "intimacy",
    level: 3,
  },
];

export const DEFAULT_SNAKES_CONFIG: GameConfig = {
  name: "Mioshy Classic",
  boardSize: 100,
  // Retained for legacy shape; not used now that dice drives moves.
  coinHeadsSteps: 3,
  coinTailsSteps: 1,
  penaltyType: "back5",
  penaltySteps: 5,
  ladders: [
    { from: 4, to: 14, emoji: "🪜", label: "גילוי קטן" },
    { from: 9, to: 31, emoji: "🪜", label: "קפיצת אמונה" },
    { from: 20, to: 38, emoji: "🪜", label: "רגע מחבר" },
    { from: 28, to: 47, emoji: "🪜", label: "מבט חדש" },
    { from: 40, to: 59, emoji: "🪜", label: "אומץ לדבר" },
    { from: 51, to: 67, emoji: "🪜", label: "צחוק משותף" },
    { from: 63, to: 81, emoji: "🪜", label: "נשימה ביחד" },
    { from: 71, to: 91, emoji: "🪜", label: "שיתוף עמוק" },
  ],
  snakes: [
    { from: 17, to: 7, emoji: "🐍", label: "נסיגה רגשית" },
    { from: 27, to: 11, emoji: "🐍", label: "הגנה אוטומטית" },
    { from: 36, to: 19, emoji: "🐍", label: "עייפות של הרגע" },
    { from: 49, to: 32, emoji: "🐍", label: "ביקורת זעירה" },
    { from: 62, to: 45, emoji: "🐍", label: "חוסר נוכחות" },
    { from: 75, to: 58, emoji: "🐍", label: "הסחת דעת" },
    { from: 87, to: 70, emoji: "🐍", label: "פחד מחשיפה" },
    { from: 95, to: 79, emoji: "🐍", label: "רגע של ריחוק" },
  ],
  questions: STARTER_QUESTIONS,
};
