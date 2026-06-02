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
import type {
  AiHeroBlock,
  Analysis,
  Response,
} from "@/lib/journey/types";

const ANTHROPIC_URL    = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL  = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 800;

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
- לשבור את השגרה המינית / להצית את התשוקה / להחזיר את הפרפרים בבטן
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

== זיהוי שילוב של תחומים ==
שילוב = שני תחומים שונים שכואבים יחד. סמנים:
- q20c או q22a מזכירים שני תחומים → שילוב.
- friendship_score < 50 וגם passion_risk > 60 → תקשורת + אינטימיות.
- horsemen_flag=true וגם category_scores.intimacy < 50 → תקשורת + אינטימיות.
- top_priority שונה מהקטגוריה עם הציון הנמוך ביותר → שילוב.

בשילוב — ערימת התועלות עצמה מספרת את הסיפור. 3 תועלות בשורה: הראשונה מהתחום הראשון, השנייה מהתחום השני, השלישית תועלת משולבת ("תתאהבו מחדש", "תחזרו להיות 'אנחנו'").

== מתי להזכיר מומחה צמוד ==
expert_mentioned=true רק כשמתקיים אחד:
- horsemen_flag=true ו-q20a_urgency_now Likert >= 4 (דחיפות גבוהה).
- q20c או q22a כוללים בקשה ברורה לתמיכה ("אני צריכה לדבר עם מישהו", "אנחנו לא יודעים מה לעשות").
- pain_signal="horsemen" ואין שילוב (תועלת בודדת — יש מקום למשפט מומחה).
אחרת expert_mentioned=false. השפע של התועלות עושה את העבודה לבד.

כשמזכירים — נוסחה אחת בלבד בסוף: "עם מומחה זמין בצ'אט לכל שאלה."

== מבנה הפלט ==
hero_he: שורה אחת, 1-2 משפטים, 22-45 מילים. אם expert_mentioned=true — הוסף את משפט המומחה בסוף.
hero_en: תרגום מקביל, אותו מבנה (אם השם בעברית — השאר אותו בעברית גם באנגלית).
recommendations_he: מערך של 3 פריטים, כל אחד משפט תועלת קצר (עד 12 מילים), מתחיל ב"תקבלו / תהיו / תחזרו / תרגישו / תגלו / תתאהבו / תפרח / תתחדש / תתעצם".
recommendations_en: 3 פריטים מקבילים.

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
{"hero_he":"דנה, תגלו זוגיות שהויכוחים לא יהפכו בה לנטל. תלמדו להתווכח ולחזור לשגרה זוגית אוהבת מהר מאוד, האהבה תפרח, והאינטימיות תתחדש.","hero_en":"Dana, you'll discover a relationship where arguments no longer feel like a burden. You'll learn to disagree and return to loving routine very quickly, love will bloom, and intimacy will renew.","recommendations_he":["תלמדו להתווכח בלי שזה יהיה נטל.","שיחות אמיתיות יחזרו ביניכם.","האינטימיות תתחדש."],"recommendations_en":["You'll learn to argue without it becoming a burden.","Real conversations will return.","Intimacy will renew."],"expert_mentioned":false,"pain_signal":"reflection"}

INPUT:
{name:"יוסי", gender:"male", years:"4-7 שנים", kids:"0",
 top_priority:"intimacy", top_gap:"passion_play",
 category_scores:{communication:72, intimacy:34, emotional_connection:68, friendship:60, family:55, lowest_key:"intimacy"},
 four_horsemen_flag:false, q20c:"אין סקס, נדמה לי שהיא לא רוצה אותי יותר", q22a:"שנתחיל שוב לחפש אחד את השני"}

OUTPUT:
{"hero_he":"יוסי, מהר מאוד תחזירו את הפרפרים בבטן, תציתו מחדש את התשוקה, ותשברו את השגרה המינית.","hero_en":"Yossi, very quickly you'll bring back the butterflies, reignite passion, and break the routine.","recommendations_he":["תחזירו את הפרפרים בבטן.","תתאהבו מחדש.","יותר אינטימיות אמיתית ביניכם."],"recommendations_en":["The butterflies will come back.","You'll fall in love again.","More real intimacy between you."],"expert_mentioned":false,"pain_signal":"reflection"}

INPUT:
{name:"רונית", gender:"female", years:"8-15 שנים", kids:"3",
 top_priority:"friendship", top_gap:"turn_toward",
 category_scores:{communication:65, intimacy:58, emotional_connection:54, friendship:42, family:50, lowest_key:"friendship"},
 four_horsemen_flag:false, q20c:"אנחנו חיים אחד ליד השני אבל לא ביחד, אני לבד גם כשהוא בבית", q22a:""}

OUTPUT:
{"hero_he":"רונית, מהר מאוד הציפייה לחזור הביתה אחרי יום עבודה תגדל, התקשורת והחברות ביניכם תתעצם, תמיד.","hero_en":"Ronit, very quickly the desire to come home after a workday will grow, and your communication and friendship will strengthen, always.","recommendations_he":["תחזרו לראות אחד את השני בסוף יום ארוך.","החברות והכיף ביניכם יחזרו.","תהיו שוב 'אנחנו'."],"recommendations_en":["You'll see each other again after a long day.","Friendship and fun will return.","You'll be 'us' again."],"expert_mentioned":false,"pain_signal":"reflection"}

INPUT:
{name:"אורי", gender:"male", years:"1-3 שנים", kids:"0",
 top_priority:"communication", top_gap:"four_horsemen_criticism",
 category_scores:{communication:32, intimacy:55, emotional_connection:48, friendship:50, family:60, lowest_key:"communication"},
 four_horsemen_flag:true, q20a_urgency:5, q20c:"אנחנו רבים על הכל ואני לא יודע כבר איך לדבר איתה בלי שזה מסתיים רע"}

OUTPUT:
{"hero_he":"אורי, מהר מאוד תהפכו לזוג שמדבר בלי להאשים, ויכוחים שעד היום התפוצצו ייגמרו תוך דקות בלי שיישאר טעם רע. עם מומחה זמין בצ'אט לכל שאלה.","hero_en":"Uri, very quickly you'll become a couple that talks without blame, fights that used to explode will end within minutes with no bitter aftertaste. With an expert available in chat for any question.","recommendations_he":["תלמדו להתווכח בלי שזה יהיה פיצוץ.","שיחות אמיתיות יחזרו.","תקבלו ליווי אישי בכל שאלה."],"recommendations_en":["You'll learn to argue without it exploding.","Real conversations will return.","You'll receive personal guidance for every question."],"expert_mentioned":true,"pain_signal":"horsemen"}

== חוקי פלט ==
- החזר JSON אובייקט אחד בלבד, בלי markdown fences, בלי טקסט נלווה.
- ללא מקף ארוך (—).
- אם user_name לא סופק — אל תתחיל בפנייה אישית, פשוט "מהר מאוד...".
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the AI hero block. Returns null on any failure - the caller
 * MUST handle null and fall back to the deterministic narrative.
 */
export async function analyzeAssessment(
  inputs: AssessmentAiInputs,
): Promise<AiHeroBlock | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai/analyze-assessment] ANTHROPIC_API_KEY missing - skipping");
    return null;
  }

  const start = Date.now();
  const userPayload = buildUserPayload(inputs);

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
        messages: [
          {
            role: "user",
            content: JSON.stringify(userPayload),
          },
        ],
      }),
    });

    const latency = Date.now() - start;

    if (!res.ok) {
      const text = await res.text().catch(() => "<unreadable>");
      console.warn("[ai/analyze-assessment] non-200", {
        status: res.status,
        latency,
        body: text.slice(0, 400),
      });
      return null;
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const block = (data.content ?? []).find((b) => b.type === "text");
    const raw = (block?.text ?? "").trim();
    if (!raw) {
      console.warn("[ai/analyze-assessment] empty content", { latency });
      return null;
    }

    const parsed = parseAndValidate(raw);
    if (!parsed) {
      console.warn("[ai/analyze-assessment] parse failed", {
        latency,
        rawPreview: raw.slice(0, 200),
      });
      return null;
    }

    console.log("[ai/analyze-assessment] success", {
      latency,
      hero_len: parsed.hero_he.length,
      expert: parsed.expert_mentioned,
      signal: parsed.pain_signal,
    });

    return {
      ...parsed,
      model: ANTHROPIC_MODEL,
      generated_at: new Date().toISOString(),
      latency_ms: latency,
    };
  } catch (e) {
    console.warn("[ai/analyze-assessment] threw", {
      latency: Date.now() - start,
      err: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
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
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
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
    expert_mentioned,
    pain_signal,
  };
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
