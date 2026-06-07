/**
 * lib/assessments/ai-hero.ts
 *
 * Claude Sonnet 4.6 benefit-stack hero generator for the assessments product
 * line. Topic-aware: takes the assessment title + weakest dimensions + the
 * open Q21 answer, detects the pain, and returns a benefit-stack hero that
 * leads the couple toward joining the coaching program (תוכנית הליווי).
 *
 * Separate from lib/ai/analyze-assessment.ts (which is Journey/Gottman-coupled)
 * so the live Journey funnel stays untouched. Same model, same strict voice
 * rules, same never-throw → null fallback contract.
 *
 * Env: ANTHROPIC_API_KEY. Without it returns null and the UI falls back to a
 * deterministic recommendation built from the weakest dimension.
 */

import "server-only";
import type { AiHeroBlock, AssessmentAnalysis, AssessmentDef } from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 800;

export interface AssessmentAiInputs {
  def: AssessmentDef;
  analysis: AssessmentAnalysis;
  user_name?: string | null;
  gender?: string | null; // "male" | "female" | "other"
}

const SYSTEM_PROMPT = `אתה כותב את ה-hero של דף סיכום אבחון זוגי באתר מיאושי, פלטפורמת ליווי זוגי בעברית. האבחון ממוקד בנושא אחד (יימסר לך). המטרה: להציג לזוג רצף של תועלות שתוכנית הליווי תביא להם בנושא הזה, ולהוביל אותם להצטרף לליווי. לא לתאר תהליך.

== כללי ניסוח חמורים ==
1. כתוב כמו חבר בקיא ובוטח, לא כמו פסיכולוג ולא כמו AI.
2. הפלט כולו בלשון עתיד-תועלת של הזוג: "תקבלו", "תרגישו", "תהפכו", "תחזרו", "תגלו", "תתאהבו", "תציתו", "תשברו", "תפרח", "תתחדש", "תתעצם".
3. אסור פעלים שמתארים את הליווי: "הליווי עושה / עובד / בונה / מספק / נותן". אסור "בלי X, בלי Y".
4. כל הבטחת זמן מעורפלת: "מהר מאוד", "תוך זמן קצר", "די מהר", "תמיד". אסור מספרים (לא "תוך שבוע", לא "תוך חודש").
5. בלי מקף ארוך "—". רק מינוס רגיל "-".
6. אסור: "אנחנו רואים", "אנו מזהים", "מסע", "חוויה", "ערך מוסף", "פלטפורמה", "טרנספורמציה", "פתרון מקיף".
7. אסור לצטט מומחים בשם, ואסור להמציא ציטוטים של זוגות אחרים.
8. אסור לאזכר אלימות, התעללות או טיפול חיצוני. הליווי + המומחה הצמוד הם התשובה.
9. אסור הצהרות סופיות מפחידות ("אתם בסכנה", "הזוגיות בקריסה").

== זיהוי הכאב (סדר עדיפות) ==
1. אם open_answer מולא בטקסט אמיתי - שם הכאב כתוב. בנה את התועלות שמרפאות אותו ישירות. סמן pain_signal="reflection".
2. אחרת לפי הממדים החלשים (weakest) והנושא - סמן pain_signal="scores".
חשוב: אל תמציא רגעים ספציפיים שהמשתמש לא כתב. אם open_answer ריק - אל תכתוב "כשאת..." או "כשהוא..." - השתמש רק במידע שיש לך ובנושא האבחון.

== מתי להזכיר מומחה צמוד ==
expert_mentioned=true רק אם open_answer כולל בקשה ברורה לתמיכה ("אני צריכה לדבר עם מישהו", "אנחנו לא יודעים מה לעשות"), או אם הממד החלש ביותר נמוך מאוד (ציון מתחת ל-35). אחרת expert_mentioned=false. כשמזכירים - נוסחה אחת בסוף: "עם מומחה זמין בצ'אט לכל שאלה."

== פתיחת hero_he ==
אם user_name סופק - התחל ב-"<שם>, " ואז משפט התועלת. הטיית מין: gender="female" → נקבה ("את ובן הזוג שלך"); gender="male" → זכר ("אתה ובת הזוג שלך"); אחרת → "אתם".

== מבנה הפלט ==
hero_he: שורה אחת, 1-2 משפטים, 22-45 מילים, ממוקד בנושא האבחון. אם expert_mentioned=true הוסף את משפט המומחה בסוף.
hero_en: תרגום מקביל (אם השם בעברית - השאר אותו בעברית).
recommendations_he: מערך של 3 פריטים, כל אחד משפט תועלת קצר (עד 12 מילים), מתחיל ב"תקבלו / תהיו / תחזרו / תרגישו / תגלו / תתאהבו / תפרח / תתחדש / תתעצם".
recommendations_en: 3 פריטים מקבילים.

== חוקי פלט ==
- החזר JSON אובייקט אחד בלבד, בלי markdown fences, בלי טקסט נלווה.
- שדות: hero_he, hero_en, recommendations_he, recommendations_en, expert_mentioned, pain_signal.
- ללא מקף ארוך (—).
`;

export async function generateAssessmentHero(
  inputs: AssessmentAiInputs,
): Promise<AiHeroBlock | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[assessments/ai-hero] ANTHROPIC_API_KEY missing - skipping");
    return null;
  }

  const start = Date.now();
  const payload = buildPayload(inputs);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      }),
    });

    const latency = Date.now() - start;
    if (!res.ok) {
      const text = await res.text().catch(() => "<unreadable>");
      console.warn("[assessments/ai-hero] non-200", {
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
    if (!raw) return null;

    const parsed = parseAndValidate(raw);
    if (!parsed) {
      console.warn("[assessments/ai-hero] parse failed", {
        latency,
        rawPreview: raw.slice(0, 200),
      });
      return null;
    }

    console.log("[assessments/ai-hero] success", {
      assessment: inputs.def.id,
      latency,
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
    console.warn("[assessments/ai-hero] threw", {
      latency: Date.now() - start,
      err: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

function buildPayload(inputs: AssessmentAiInputs) {
  const { def, analysis, user_name, gender } = inputs;
  const dimLabel = (key: string) =>
    def.dimensions.find((d) => d.key === key)?.he ?? key;

  return {
    topic_he: def.he_title,
    topic_en: def.en_title,
    user_name: user_name ?? null,
    gender: gender ?? null,
    dimension_scores: analysis.dimension_scores.map((d) => ({
      he: d.he,
      score: d.score,
    })),
    weakest: analysis.weakest_keys.map((k) => dimLabel(k)),
    open_answer: analysis.open_answer.slice(0, 600),
  };
}

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

  const recommendations_he = sanitizeArray(obj.recommendations_he);
  const recommendations_en = sanitizeArray(obj.recommendations_en);
  if (recommendations_he.length === 0 || recommendations_en.length === 0)
    return null;

  const rawSignal = String(obj.pain_signal ?? "scores").toLowerCase();
  const pain_signal: AiHeroBlock["pain_signal"] =
    rawSignal === "reflection" ? "reflection" : "scores";

  return {
    hero_he,
    hero_en,
    recommendations_he: recommendations_he.slice(0, 3),
    recommendations_en: recommendations_en.slice(0, 3),
    expert_mentioned: obj.expert_mentioned === true,
    pain_signal,
  };
}

function sanitize(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
}

function sanitizeArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(sanitize).filter((s): s is string => s.length > 0);
}
