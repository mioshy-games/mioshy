/**
 * lib/ai/analyze-assessment.ts
 *
 * Claude Sonnet 4.6 hero generator for the journey assessment summary.
 *
 * Inputs: deterministic Analysis output (from lib/journey/analysis.ts) +
 * raw Response[] (so the model can read the open-text reflections) + the
 * user's name + gender + relationship-years + kids count.
 *
 * Output: AiHeroBlock — a benefit-stack hero sentence in HE/EN, 2-3
 * benefit-style recommendations, plus metadata (model, latency, source of
 * the pain signal). NEVER throws — returns null on any failure so the
 * caller falls back to the deterministic narrative.
 *
 * Voice rules baked in (Itzik, 2026-06-02):
 *   - Stack 2-3 BENEFITS, never describe the process ("הליווי עושה X").
 *   - Vague time promises only — "מהר מאוד", never N days/weeks.
 *   - Expert mention conditional (single benefit + need signal, or
 *     horsemen_flag + high urgency, or explicit user ask in q20c/q22a).
 *   - No em-dash, no "אנחנו רואים", no foreign-feel words.
 *   - Name appears once at the start (if supplied), with gender-correct
 *     pronouns throughout.
 *
 * Env: ANTHROPIC_API_KEY required. Without it the function logs and
 * returns null. Cost: ~$0.005 per assessment.
 */

import "server-only";
import { stripEmDash } from "@/lib/text/sanitize-dashes";
import type {
  AiHeroBlock,
  AiHeroFailReason,
  Analysis,
  Response,
} from "@/lib/journey/types";

const ANTHROPIC_URL    = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL  = "claude-sonnet-4-6";
// 800 was occasionally too tight for the HE+EN hero + 6 recommendations, so a
// verbose run could get truncated mid-JSON → parse_fail. 1100 gave headroom;
// bumped to 1500 (2026-06-29) for the added HE+EN answer-grounded narrative.
const MAX_OUTPUT_TOKENS = 1500;

// ── retry / timeout budget ────────────────────────────────────────────────
// The user waits synchronously on the results screen, so total wall-clock is
// bounded. attemptOnce takes a per-call timeout; attempt 1 gets the full
// PER_ATTEMPT_TIMEOUT_MS, a retry gets whatever budget remains (capped at the
// same ceiling).
//
// 2026-06-24: the previous gate reserved the FULL 18s timeout for the retry,
// so it only fired when ≤3.2s had elapsed. But parse_fail / empty happen AFTER
// a normal ~6s model response, so the retry never ran (observed attempts:1 on
// every parse_fail). We now allow a retry whenever enough budget REMAINS for a
// realistic second call (RETRY_MIN_REMAINING_MS), and raised the total budget
// so two typical ~6s calls fit. A real timeout (18s) is NOT in the transient
// set, so it still falls straight through to the fallback (no doubling).
const PER_ATTEMPT_TIMEOUT_MS = 18_000;
const TOTAL_BUDGET_MS        = 30_000;
const RETRY_MIN_REMAINING_MS = 8_000; // enough for a typical ~6s call + margin
const MAX_ATTEMPTS           = 2;
const BACKOFF_MS             = 600;

// ---------------------------------------------------------------------------
// Inputs the route hands us, expanded by the prompt builder.
// ---------------------------------------------------------------------------

export interface AssessmentAiInputs {
  analysis: Analysis;
  responses: Response[];
  /** Display name (first name preferred). Undefined → prompt skips the
   *  vocative opening. */
  user_name?: string | null;
  /** "male" | "female" | "other". Drives Hebrew pronoun selection. */
  gender?: string | null;
  relationship_years_label?: string | null; // e.g. "8-15 שנים"
  kids_count_label?: string | null;         // e.g. "2"
}

// ---------------------------------------------------------------------------
// System prompt (Hebrew - the only language the user will read).
// Few-shot examples taken verbatim from approved drafts.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `אתה כותב את ה-hero של דף סיכום אבחון זוגי באתר מיאושי, פלטפורמת ליווי זוגי בעברית. המטרה: להציג לזוג רצף של תועלות שהליווי יביא להם, לא לתאר תהליך.

== כללי ניסוח חמורים ==
1. כתוב כמו חבר בקיא ובוטח, לא כמו פסיכולוג ולא כמו AI.
2. הפלט כולו בלשון עתיד-תועלת של הזוג עצמו: "תקבלו", "תרגישו", "תהפכו", "תחזרו", "תגלו", "תתאהבו", "תציתו", "תשברו", "תפרח", "תתחדש", "תתעצם", "תגדל".
3. אסור פעלים שמתארים את הליווי: "הליווי עושה / עובד / בונה / מחייה / מספק / נותן". אסור "בלי X, בלי Y" (השוואות שליליות).
4. כל הבטחת זמן מעורפלת: "מהר מאוד", "תוך זמן קצר", "די מהר", "תמיד". אסור מספרים: לא "תוך שבוע", לא "תוך חודש", לא "ב-14 ימים".
5. בלי מקף ארוך "—". רק מינוס רגיל "-".
6. אסור: "אנחנו רואים", "אנו מזהים", "ניתן לראות", "מן הסתם", "כפי הנראה", "מסע", "חוויה", "ערך מוסף", "פלטפורמה", "טרנספורמציה", "פתרון מקיף", "להרגיש 'נראים'", "מחוברים מחדש".
7. אסור לצטט מומחים בשם. אסור להמציא ציטוטים של זוגות אחרים.
8. אסור לאזכר אלימות, התעללות או טיפול חיצוני. הליווי + המומחה הצמוד הם התשובה לכל מצב.
9. אסור הצהרות סופיות: "אתם בסכנה", "הזוגיות בקריסה", "המצב חמור".

== אוצר המילים של התועלות (השתמש אך ורק מתוכו או דומה) ==
- יותר אינטימיות / יותר תקשורת אמיתית / יותר סקס
- לשבור את השגרה המינית / להצית את התשוקה / להחזיר את הפרפרים לבטן
- להתאהב מחדש / לאהוב מחדש / להתאהב שוב
- האהבה תפרח / האינטימיות תתחדש / החברות תתעצם
- הציפייה לחזור הביתה תגדל / שיחות אמיתיות יחזרו
- תלמדו להתווכח בלי שזה יהיה נטל / ויכוחים ייגמרו תוך דקות בלי טעם רע

== זיהוי הכאב (סדר עדיפות) ==
1. אם q20c_what_hurts מולא בטקסט אמיתי - שם הכאב כתוב. בנה את התועלות שמרפאות אותו ישירות. סמן pain_signal="reflection".
2. אם q22a_success_signal מולא - שם הזוג כתב מה חסר להם שאם יתפתר ישנה את הזוגיות. תרגם את זה ישירות לתועלות בלשון "תקבלו / תהיו / תפרח". זה האות הכי חזק להתאמה אישית. סמן pain_signal="reflection".
3. אחרת בדוק horsemen_flag=true → pain_signal="horsemen".
4. אחרת לפי top_priority + top_gap → pain_signal="top_priority".
5. אחרת לפי הציונים → pain_signal="scores".

חשוב: אסור להמציא רגעים ספציפיים שהמשתמש לא כתב. אם q20c או q22a ריקים - אל תכתוב משפטים שמתחילים ב"כשאת חוזרת מהעבודה..." או "כשהוא מסתכל בטלפון..." - השתמש רק במידע שיש לך.

== שיקוף הקלט (desire-led, כשיש reflection אמיתי) ==
1. העדף תמיד להדהד את השאיפה: אם q22a_success_signal מולא - שלב מילה או צירוף קצר שהמשתמש כתב בו (verbatim, מהטקסט שלו בלבד) בתוך משפט התועלת הראשון, בלשון "תקבלו / תחזרו / תהיו".
2. הדהד את הכאב (q20c) רק כש-q22a ריק. גם אז תמיד במסגור הקלה ("התחושה ש... תיעלם", "במקום ש..."), לעולם לא שקיעה בכאב ולא הגזמה או דרמטיזציה. (הכאב תמיד מנחה אילו תועלות לבחור, גם כשלא מהדהדים אותו verbatim.)
3. אסור לשנות, לפרש או להוסיף דרמה למה שכתב. אם הטקסט קצר/מבולבל/לא ברור - אל תשקף, בנה תועלות מהציונים.

== סגירה (חובה, על השאיפה של הזוג) ==
סיים תמיד את hero_he על התוצאה שהזוג עצמו רוצה - נגזרת מהתשובות שלהם (q22a_success_signal אם מולא, אחרת q20c, top_priority והציונים), בלשון תועלת קונקרטית וספציפית לזוג הזה ("ושוב תרגישו...", "תחזרו להיות...", "תהיו שוב..."). הסגירה חייבת להיות משפט שמתאים רק לזוג הזה - לא משפט שאפשר להדביק לכל אחד.
אסור בתכלית סגירה גנרית/קלישאתית: אסור "הכול לפניכם", אסור "וזה מתחיל כבר עכשיו", אסור "מכאן זה רק עולה", ואסור כל סיסמה מוטיבציונית כללית מאותו סוג ("השמיים הגבול", "אתם בדרך הנכונה" וכו').
שמור על כל המגבלות: לשון תועלת בלבד, לא הבטחה מספרית, אסור לתאר תהליך, אסור "הליווי/התוכנית", אסור המילה "מסע". הכותרת היא משפט אחד קצר — משפט המומחה לא נכנס אליה.

== זיהוי שילוב של תחומים ==
שילוב = שני תחומים שונים שכואבים יחד. סמנים:
- q20c או q22a מזכירים שני תחומים → שילוב.
- friendship_score < 50 וגם passion_risk > 60 → תקשורת + אינטימיות.
- horsemen_flag=true וגם category_scores.intimacy < 50 → תקשורת + אינטימיות.
- top_priority שונה מהקטגוריה עם הציון הנמוך ביותר → שילוב.

בשילוב — לכותרת (hero) בחר את היתרון הנקודתי החזק ביותר מבין התחומים, משפט אחד קצר בלבד. את הרוחב של שאר התחומים שמור ל-recommendations (3 הפריטים), לעולם לא לכותרת.

== מתי להזכיר מומחה צמוד ==
expert_mentioned=true רק כשמתקיים אחד:
- horsemen_flag=true ו-q20a_urgency_now Likert >= 4 (דחיפות גבוהה).
- q20c או q22a כוללים בקשה ברורה לתמיכה ("אני צריכה לדבר עם מישהו", "אנחנו לא יודעים מה לעשות").
- pain_signal="horsemen" ואין שילוב (תועלת בודדת — יש מקום למשפט מומחה).
אחרת expert_mentioned=false. השפע של התועלות עושה את העבודה לבד.

expert_mentioned הוא דגל אנליטיקה בלבד. אל תכניס את משפט המומחה לכותרת הקצרה (hero_he/en) — הכותרת נשארת יתרון נקודתי אחד, משפט אחד.

== מבנה הפלט ==
hero_he: משפט אחד קצר וחד בלבד, 6 עד 12 מילים. יתרון נקודתי אחד (לא ערימת תועלות, לא רשימה, לא שני משפטים) שנגזר ישירות מהתשובות של הזוג, ומנוסח כך שהוא מתאים רק להם. בלי משפט המומחה בכותרת. אם user_name סופק, פתח בשם.
hero_en: תרגום מקביל קצר, אותו אורך ואותו מבנה (אם השם בעברית — השאר אותו בעברית גם באנגלית).
recommendations_he: מערך של 3 פריטים, כל אחד משפט תועלת קצר (עד 12 מילים), מתחיל ב"תקבלו / תהיו / תחזרו / תרגישו / תגלו / תתאהבו / תפרח / תתחדש / תתעצם".
recommendations_en: 3 פריטים מקבילים.
narrative_he: פסקה אחת חמה ואישית בגובה העיניים, 2 עד 4 משפטים, שמשקפת לזוג מה עלה מהתשובות שלהם בשאלון. הישען ישירות על מה שהם כתבו (q20c_what_hurts, q22a_success_signal) ועל הציונים והעדיפות שבחרו, ושלב משפט מחזק על מה שעובד אצלם. אסור שתהיה גנרית - מי שיקרא אותה צריך להרגיש שהיא נכתבה רק עליהם. קול אנושי וחומל, בלי הבטחות תהליך, בלי מספרים, בלי מבנה של שלושה פריטים, ובלי מקף ארוך.
narrative_en: תרגום מקביל לאותה פסקה, אותו קול ואותו תוכן.

== פתיחת hero_he ==
אם user_name סופק — התחל ב-"<שם>, " ואז משפט התועלת. הפנייה למין:
- gender="female" → "את ובן הזוג שלך", הטיות נקבה.
- gender="male" → "אתה ובת הזוג שלך", הטיות זכר.
- אחרת → "אתם".

== Few-shot examples ==

INPUT:
{name:"דנה", gender:"female", years:"8-15 שנים", kids:"2",
 top_priority:"communication", top_gap:"repair",
 category_scores:{communication:48, intimacy:62, emotional_connection:71, friendship:55, family:60, lowest_key:"communication"},
 four_horsemen_flag:true, q20c:"הויכוחים שלנו לא נגמרים והכל הופך לנטל", q22a:"שנדע להתווכח בלי שזה יהרוס לנו את היום"}

OUTPUT:
{"hero_he":"דנה, תלמדו להתווכח בלי שזה יהרוס לכם את היום.","hero_en":"Dana, you'll learn to argue without it ruining your whole day.","recommendations_he":["תלמדו להתווכח בלי שזה יהיה נטל.","שיחות אמיתיות יחזרו ביניכם.","האינטימיות תתחדש."],"recommendations_en":["You'll learn to argue without it becoming a burden.","Real conversations will return.","Intimacy will renew."],"narrative_he":"כתבתם שהויכוחים לא נגמרים ושהכל הופך לנטל, וזה בדיוק מה שעולה גם מהתשובות. הציונים מראים שהבסיס הרגשי והחברות עדיין חזקים אצלכם, ולכן מה שחסר הוא הדרך לדבר כשנהיה קשה. זה בר שינוי, ומשם נתחיל יחד.","narrative_en":"You wrote that the arguments never end and everything turns into a burden, and that's exactly what your answers show. Your scores say the emotional base and the friendship between you are still strong, so what's missing is the way to talk when it gets hard. That can change, and that's where we'll start together.","expert_mentioned":false,"pain_signal":"reflection"}

INPUT:
{name:"יוסי", gender:"male", years:"4-7 שנים", kids:"0",
 top_priority:"intimacy", top_gap:"passion_play",
 category_scores:{communication:72, intimacy:34, emotional_connection:68, friendship:60, family:55, lowest_key:"intimacy"},
 four_horsemen_flag:false, q20c:"אין סקס, נדמה לי שהיא לא רוצה אותי יותר", q22a:"שנתחיל שוב לחפש אחד את השני"}

OUTPUT:
{"hero_he":"יוסי, מהר מאוד תחזרו לחפש אחד את השני.","hero_en":"Yossi, very soon you'll start seeking each other out again.","recommendations_he":["תחזירו את הפרפרים בבטן.","תתאהבו מחדש.","יותר אינטימיות אמיתית ביניכם."],"recommendations_en":["The butterflies will come back.","You'll fall in love again.","More real intimacy between you."],"narrative_he":"מהתשובות שלכם עולה שהמרחק הפיזי כואב, וכתבתם שאתם רוצים שוב לחפש אחד את השני. הציונים דווקא מראים שהתקשורת והקשר הרגשי יציבים, וזה הבסיס שממנו אפשר להחזיר את הקרבה. אתם לא רחוקים כמו שזה מרגיש עכשיו.","narrative_en":"Your answers show the physical distance hurts, and you wrote that you want to seek each other out again. Your scores actually show communication and the emotional bond are steady, and that's the base to bring closeness back from. You're not as far apart as it feels right now.","expert_mentioned":false,"pain_signal":"reflection"}

INPUT:
{name:"רונית", gender:"female", years:"8-15 שנים", kids:"3",
 top_priority:"friendship", top_gap:"turn_toward",
 category_scores:{communication:65, intimacy:58, emotional_connection:54, friendship:42, family:50, lowest_key:"friendship"},
 four_horsemen_flag:false, q20c:"אנחנו חיים אחד ליד השני אבל לא ביחד, אני לבד גם כשהוא בבית", q22a:""}

OUTPUT:
{"hero_he":"רונית, מהר מאוד תחזרו להיות 'אנחנו', לא רק זה לצד זה.","hero_en":"Ronit, very soon you'll be 'us' again, not just side by side.","recommendations_he":["תחזרו לראות אחד את השני בסוף יום ארוך.","החברות והכיף ביניכם יחזרו.","תהיו שוב 'אנחנו'."],"recommendations_en":["You'll see each other again after a long day.","Friendship and fun will return.","You'll be 'us' again."],"narrative_he":"כתבת שאתם חיים זה לצד זה אבל לא ביחד, ושלפעמים את לבד גם כשהוא בבית. זה עולה גם מהתשובות, שמראות שהחברות היומיומית קצת נשחקה. אבל התקשורת והקרבה עדיין שם, ומהן אפשר להחזיר את תחושת ה'אנחנו'.","narrative_en":"You wrote that you live side by side but not together, and that sometimes you're alone even when he's home. Your answers reflect that too, showing the day-to-day friendship has worn a little. But communication and closeness are still there, and from them we can bring back the feeling of 'us'.","expert_mentioned":false,"pain_signal":"reflection"}

INPUT:
{name:"אורי", gender:"male", years:"1-3 שנים", kids:"0",
 top_priority:"communication", top_gap:"four_horsemen_criticism",
 category_scores:{communication:32, intimacy:55, emotional_connection:48, friendship:50, family:60, lowest_key:"communication"},
 four_horsemen_flag:true, q20a_urgency:5, q20c:"אנחנו רבים על הכל ואני לא יודע כבר איך לדבר איתה בלי שזה מסתיים רע"}

OUTPUT:
{"hero_he":"אורי, מהר מאוד הוויכוחים ייגמרו תוך דקות ותרגישו שוב באותו צד.","hero_en":"Uri, very soon the arguments will end within minutes and you'll feel on the same side again.","recommendations_he":["תלמדו להתווכח בלי שזה יהיה פיצוץ.","שיחות אמיתיות יחזרו.","תקבלו ליווי אישי בכל שאלה."],"recommendations_en":["You'll learn to argue without it exploding.","Real conversations will return.","You'll receive personal guidance for every question."],"narrative_he":"כתבת שאתם רבים על הכל ושכבר קשה לדבר בלי שזה נגמר רע, וזה בדיוק מה שהתשובות מראות. בצד השני, יש ביניכם בסיס משפחתי ואינטימי שעובד, וזה אומר שהקושי הוא בדרך ולא בקשר עצמו. את הדרך הזו אפשר ללמוד, ואתם לא לבד בזה.","narrative_en":"You wrote that you fight about everything and it's already hard to talk without it ending badly, and that's exactly what your answers show. On the other side, there's a family and intimate base between you that works, which means the difficulty is in the way, not in the bond itself. That way can be learned, and you're not alone in it.","expert_mentioned":true,"pain_signal":"horsemen"}

== חוקי פלט ==
- החזר JSON תקין בלבד, ללא markdown וללא טקסט נוסף. בלי code fences (אסור \`\`\`), בלי שום מילה לפני ה-{ או אחרי ה-}. התשובה כולה היא אובייקט JSON אחד שלם, שמתחיל ב-{ ונגמר ב-}.
- ודא שכל המפתחות והסוגריים נסגרים כראוי - JSON חתוך/לא שלם פסול.
- ללא מקף ארוך (—).
- אם user_name לא סופק — אל תתחיל בפנייה אישית, פשוט "מהר מאוד...".
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discriminated result so the caller can persist observability (Stage 1):
 * a success carries the hero; a failure carries the reason + attempt count.
 * NEVER throws — the caller falls back to the deterministic template.
 */
export type AiHeroResult =
  | { ok: true; hero: AiHeroBlock; attempts: number; latency_ms: number }
  | { ok: false; reason: AiHeroFailReason; attempts: number; latency_ms: number };

/**
 * Generate the AI hero block, with bounded retry. Returns an AiHeroResult
 * — the caller MUST handle the failure case and fall back to the
 * deterministic template (lib/journey/hero-fallback.ts).
 */
export async function analyzeAssessment(
  inputs: AssessmentAiInputs,
): Promise<AiHeroResult> {
  const startAll = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai/analyze-assessment] ANTHROPIC_API_KEY missing - skipping");
    return { ok: false, reason: "no_key", attempts: 0, latency_ms: 0 };
  }

  const userPayload = buildUserPayload(inputs);
  let attempt = 0;
  let lastReason: AiHeroFailReason = "threw";

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    // Attempt 1 gets the full per-attempt timeout; a retry gets the budget
    // that remains (still capped at the per-attempt ceiling) so the total
    // wall-clock stays bounded.
    const elapsedBefore = Date.now() - startAll;
    const attemptTimeout =
      attempt === 1
        ? PER_ATTEMPT_TIMEOUT_MS
        : Math.min(PER_ATTEMPT_TIMEOUT_MS, TOTAL_BUDGET_MS - elapsedBefore);
    const one = await attemptOnce(apiKey, userPayload, attemptTimeout);

    if (one.ok) {
      const latency = Date.now() - startAll;
      console.log("[ai/analyze-assessment] success", {
        attempt,
        latency,
        expert: one.hero.expert_mentioned,
        signal: one.hero.pain_signal,
      });
      return {
        ok: true,
        hero: {
          ...one.hero,
          // Display-layer em-dash sanitiser — closes the "—" AI tell on the
          // hero + recommendations (shared util; idempotent; en-dash kept).
          hero_he: stripEmDash(one.hero.hero_he),
          hero_en: stripEmDash(one.hero.hero_en),
          recommendations_he: one.hero.recommendations_he.map(stripEmDash),
          recommendations_en: one.hero.recommendations_en.map(stripEmDash),
          narrative_he: one.hero.narrative_he ? stripEmDash(one.hero.narrative_he) : undefined,
          narrative_en: one.hero.narrative_en ? stripEmDash(one.hero.narrative_en) : undefined,
          model: ANTHROPIC_MODEL,
          generated_at: new Date().toISOString(),
          latency_ms: latency,
        },
        attempts: attempt,
        latency_ms: latency,
      };
    }

    lastReason = one.reason;

    // Retry transient failures when enough budget REMAINS for a realistic
    // second call. parse_fail / empty are explicitly included: they occur
    // AFTER a normal-latency response (the model answered, the output was just
    // unusable), so a second attempt usually succeeds. A real timeout (~18s)
    // and config errors (http_4xx, no_key) are NOT transient → no retry.
    const transient =
      one.reason === "http_429" ||
      one.reason === "http_5xx" ||
      one.reason === "empty" ||
      one.reason === "parse_fail" ||
      one.reason === "threw";
    const elapsed = Date.now() - startAll;
    const remaining = TOTAL_BUDGET_MS - elapsed - BACKOFF_MS;

    if (attempt < MAX_ATTEMPTS && transient && remaining >= RETRY_MIN_REMAINING_MS) {
      console.warn("[ai/analyze-assessment] retrying", {
        attempt,
        reason: one.reason,
        elapsed,
        remaining,
      });
      await sleep(BACKOFF_MS);
      continue;
    }
    break;
  }

  return {
    ok: false,
    reason: lastReason,
    attempts: attempt,
    latency_ms: Date.now() - startAll,
  };
}

// ---------------------------------------------------------------------------
// Single attempt: one HTTP call with an AbortController timeout. Returns a
// parsed hero or a typed failure reason. Never throws.
// ---------------------------------------------------------------------------

async function attemptOnce(
  apiKey: string,
  userPayload: ReturnType<typeof buildUserPayload>,
  timeoutMs: number,
): Promise<{ ok: true; hero: ParsedHero } | { ok: false; reason: AiHeroFailReason }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(userPayload) }],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "<unreadable>");
      const reason: AiHeroFailReason =
        res.status === 429 ? "http_429" :
        res.status >= 500  ? "http_5xx" :
                             "http_4xx";
      console.warn("[ai/analyze-assessment] non-200", {
        status: res.status,
        reason,
        body: text.slice(0, 300),
      });
      return { ok: false, reason };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const block = (data.content ?? []).find((b) => b.type === "text");
    const raw = (block?.text ?? "").trim();
    if (!raw) {
      console.warn("[ai/analyze-assessment] empty content");
      return { ok: false, reason: "empty" };
    }

    const parsed = parseAndValidate(raw);
    if (!parsed) {
      // TEMP (2026-06-24, remove after parse_fail confirmed ~0): dump the raw
      // model output so we can confirm the failure shape — fences vs. prose
      // around the JSON vs. truncation (tail without a closing brace) vs.
      // schema deviation. head+tail+length+fence flag is enough to classify.
      console.warn("[ai/analyze-assessment] parse failed — TEMP raw dump", {
        rawLen: raw.length,
        hadFences: /```/.test(raw),
        head: raw.slice(0, 300),
        tail: raw.slice(-150),
      });
      return { ok: false, reason: "parse_fail" };
    }

    return { ok: true, hero: parsed };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const reason: AiHeroFailReason = aborted ? "timeout" : "threw";
    console.warn(`[ai/analyze-assessment] ${reason}`, {
      err: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, reason };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Build the JSON we send to Claude. Only the signals the prompt needs -
// keep the payload tight to save tokens.
// ---------------------------------------------------------------------------

function buildUserPayload(inputs: AssessmentAiInputs) {
  const { analysis, responses, user_name, gender, relationship_years_label, kids_count_label } = inputs;

  const reflect = (id: string): string => {
    const r = responses.find((x) => x.question_id === id);
    return r && r.answer.kind === "text" ? r.answer.text.slice(0, 600) : "";
  };

  const likert = (id: string): number | null => {
    const r = responses.find((x) => x.question_id === id);
    return r && r.answer.kind === "likert" ? r.answer.value : null;
  };

  return {
    user_name: user_name ?? null,
    gender: gender ?? null,
    relationship_years: relationship_years_label ?? null,
    kids_count: kids_count_label ?? null,
    scores: {
      friendship_score: analysis.friendship_score,
      conflict_health: analysis.conflict_health,
      passion_risk: analysis.passion_risk,
    },
    category_scores: analysis.summary.category_scores ?? null,
    top_priority: analysis.summary.top_priority ?? null,
    top_gap: analysis.top_gap,
    four_horsemen_flag: analysis.four_horsemen_flag,
    primary_love_language: analysis.primary_love_language,
    reflections: {
      q20c_what_hurts: reflect("q20c_what_hurts"),
      q22a_success_signal: reflect("q22a_success_signal"),
    },
    likert_signals: {
      q20a_urgency_now: likert("q20a_urgency_now"),
      q20b_intimacy_satisfaction: likert("q20b_intimacy_satisfaction"),
    },
  };
}

// ---------------------------------------------------------------------------
// Parse + validate. Constrains output to the AiHeroBlock shape and
// strips em-dashes defensively (the prompt forbids them, but we never
// trust the LLM).
// ---------------------------------------------------------------------------

type ParsedHero = Omit<AiHeroBlock, "model" | "generated_at" | "latency_ms">;

function parseAndValidate(raw: string): ParsedHero | null {
  const candidate = extractJsonObject(raw);
  if (!candidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const hero_he = sanitize(obj.hero_he);
  const hero_en = sanitize(obj.hero_en);
  if (!hero_he || !hero_en) return null;

  const recs_he = sanitizeArray(obj.recommendations_he);
  const recs_en = sanitizeArray(obj.recommendations_en);
  if (recs_he.length === 0 || recs_en.length === 0) return null;

  // Answer-grounded narrative — best-effort: a missing/blank narrative does
  // NOT fail the parse (hero + recs are the hard requirements); the route then
  // keeps the deterministic summary.narrative_he/en.
  const narrative_he = sanitize(obj.narrative_he) || undefined;
  const narrative_en = sanitize(obj.narrative_en) || undefined;

  const expert_mentioned = obj.expert_mentioned === true;
  const rawSignal = String(obj.pain_signal ?? "scores").toLowerCase();
  const pain_signal: AiHeroBlock["pain_signal"] =
    rawSignal === "reflection"   ? "reflection"   :
    rawSignal === "horsemen"     ? "horsemen"     :
    rawSignal === "top_priority" ? "top_priority" :
                                   "scores";

  return {
    hero_he,
    hero_en,
    recommendations_he: recs_he.slice(0, 3),
    recommendations_en: recs_en.slice(0, 3),
    narrative_he,
    narrative_en,
    expert_mentioned,
    pain_signal,
  };
}

/**
 * Pull the first complete JSON object out of a raw model response, robust to:
 *   - ```json fences (anywhere, not just at the exact start/end),
 *   - leading/trailing prose ("Here is the JSON: { ... } hope this helps"),
 *   - trailing garbage after the object.
 * Scans for the first '{' and returns the substring up to its BALANCED closing
 * '}', tracking string literals + escapes so braces inside strings don't count.
 * Returns null when there is no '{' or the object never closes (truncated
 * output) — both surface as parse_fail and trigger the retry.
 */
function extractJsonObject(raw: string): string | null {
  // Drop code fences entirely; the brace scan handles any surrounding text.
  const s = raw.replace(/```(?:json)?/gi, "");
  const start = s.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null; // unbalanced → truncated/incomplete
}

/** Replace em/en dashes with a plain minus, trim whitespace, return null if empty. */
function sanitize(v: unknown): string {
  if (typeof v !== "string") return "";
  const cleaned = v
    .replace(/[—–]/g, "-") // em-dash, en-dash -> minus
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function sanitizeArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(sanitize)
    .filter((s): s is string => s.length > 0);
}
