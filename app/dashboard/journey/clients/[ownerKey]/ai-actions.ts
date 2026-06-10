"use server";

/**
 * app/dashboard/journey/clients/[ownerKey]/ai-actions.ts
 *
 * Two coach-facing AI helpers for the couple control panel:
 *
 *   1. generateCoupleSummary — a 3-4 line Hebrew briefing FOR THE COACH:
 *      the couple's main weak areas, the prominent need, and a recommended
 *      direction. Synthesised across both partners' assessment heroes.
 *
 *   2. generateEmailDraft — a warm Hebrew email FROM the coach TO the couple,
 *      grounded in their questionnaire results and signed with the coach's
 *      name. The admin edits it before sending; we only draft.
 *
 * Both reuse the direct-fetch-to-Anthropic pattern from lib/ai/* (no new npm
 * dep) and NEVER throw — they return null on any failure so the UI degrades
 * to the existing per-partner panel / a manual compose box.
 *
 * The client passes a compact digest the server page already assembled, so
 * no extra DB round-trip happens here. requireAdmin re-gates the action
 * because server actions are independently reachable.
 *
 * Voice (Itzik): human, warm, speaks to the couple as "אתם/שלכם" in the
 * email; no three-part parallel lists; avoid the word "כלים"; no
 * "אנחנו רואים"/system voice; no em-dash.
 *
 * Env: ANTHROPIC_API_KEY.
 */

import { requireAdmin } from "@/lib/auth/admin";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL_SUMMARY = "claude-haiku-4-5-20251001";
const MODEL_EMAIL = "claude-sonnet-4-6";

export interface PartnerDigest {
  label: string;
  heroHe: string | null;
  recommendationsHe: string[];
  painSignal: string | null;
  whatHurts: string | null;
  successSignal: string | null;
  hasAssessment: boolean;
}

export interface CoupleAiDigest {
  ownerKey: string;
  coupleLabel: string;
  kind: "couple" | "user";
  expertName: string | null;
  partners: PartnerDigest[];
}

export interface EmailDraft {
  subject: string;
  body: string;
}

function hasAnyAssessment(d: CoupleAiDigest): boolean {
  return d.partners.some((p) => p.hasAssessment);
}

/** Compact, model-readable rendering of what we know about the couple. */
function renderDigest(d: CoupleAiDigest): string {
  const lines: string[] = [];
  lines.push(`סוג: ${d.kind === "couple" ? "זוג" : "יחיד"}`);
  lines.push(`שם: ${d.coupleLabel}`);
  d.partners.forEach((p, i) => {
    lines.push(`\n— בן/בת זוג ${i + 1}: ${p.label}`);
    if (!p.hasAssessment) {
      lines.push("  (לא מילא/ה שאלון)");
      return;
    }
    if (p.heroHe) lines.push(`  תקציר אבחון: ${p.heroHe}`);
    if (p.recommendationsHe.length)
      lines.push(`  המלצות: ${p.recommendationsHe.join(" | ")}`);
    if (p.painSignal) lines.push(`  אות כאב מרכזי: ${p.painSignal}`);
    if (p.whatHurts) lines.push(`  מה הכי כואב: ${p.whatHurts}`);
    if (p.successSignal) lines.push(`  מה ישנה את הזוגיות: ${p.successSignal}`);
  });
  return lines.join("\n");
}

async function callAnthropic(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[client-ai-actions] ANTHROPIC_API_KEY missing");
    return null;
  }
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "<unreadable>");
      console.warn("[client-ai-actions] non-200", {
        status: res.status,
        body: text.slice(0, 200),
      });
      return null;
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const block = (data.content ?? []).find((b) => b.type === "text");
    return (block?.text ?? "").trim() || null;
  } catch (e) {
    console.warn("[client-ai-actions] threw", e);
    return null;
  }
}

const SUMMARY_SYSTEM = `אתה עוזר/ת למאמן/ת זוגיות בפלטפורמת מיאושי. בהינתן נתוני אבחון של זוג, כתוב/כתבי תקציר קצר למאמן/ת בעברית — 3 עד 4 שורות בלבד, טקסט רגיל (לא JSON, לא כותרות).

התקציר חייב לכלול, בזרימה טבעית של משפטים:
- תחומי החולשה העיקריים של הזוג
- הצורך הבולט ביותר כרגע
- כיוון מומלץ להתחלה (פרק/נושא), בלי המילה "כלים"

כללי כתיבה:
- כתיבה אנושית, ישירה, בגוף שלישי על הזוג (זה למאמן/ת, לא לזוג).
- בלי שלוש פסוקיות מקבילות ברצף, בלי "אנחנו רואים", בלי מקף ארוך.
- אם אין מספיק נתונים, החזר/י בדיוק: NO_DATA`;

export async function generateCoupleSummary(
  digest: CoupleAiDigest,
): Promise<string | null> {
  await requireAdmin();
  if (!digest || !hasAnyAssessment(digest)) return null;

  const out = await callAnthropic(
    MODEL_SUMMARY,
    SUMMARY_SYSTEM,
    renderDigest(digest),
    400,
  );
  if (!out) return null;
  const cleaned = out.replace(/```/g, "").trim();
  if (!cleaned || cleaned.includes("NO_DATA")) return null;
  return cleaned;
}

const EMAIL_SYSTEM = `את/ה כותב/ת טיוטת אימייל בעברית מטעם מאמן/ת זוגיות במיאושי, אל זוג, בהתבסס על תוצאות השאלון שלהם. החזר/י JSON תקין בלבד, בלי טקסט נוסף ובלי גדרות קוד:
{"subject": "...", "body": "..."}

כללי כתיבה:
- פנייה חמה ואישית אל הזוג בגוף "אתם/שלכם" (שייכות).
- להתבסס על מה שעלה אצלם בשאלון, בלי לצטט מספרים או מונחים טכניים.
- להציע צעד ראשון מוחשי וקטן שאפשר לעשות יחד.
- בלי שלוש פסוקיות מקבילות ברצף, בלי המילה "כלים", בלי "אנחנו רואים", בלי מקף ארוך.
- אורך הגוף: 4 עד 7 משפטים. לחתום בשם המאמן/ת אם סופק.
- ה-body בעברית עם שורות חדשות אמיתיות (\\n).`;

export async function generateEmailDraft(
  digest: CoupleAiDigest,
): Promise<EmailDraft | null> {
  await requireAdmin();
  if (!digest || !hasAnyAssessment(digest)) return null;

  const signature = digest.expertName
    ? `\n\nשם המאמן/ת לחתימה: ${digest.expertName}`
    : "";
  const out = await callAnthropic(
    MODEL_EMAIL,
    EMAIL_SYSTEM,
    renderDigest(digest) + signature,
    900,
  );
  if (!out) return null;

  const cleaned = out
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    if (!body) return null;
    return { subject: subject || "מסר מהמאמן/ת שלכם", body };
  } catch {
    // Model returned prose instead of JSON — still usable as the body.
    return { subject: "מסר מהמאמן/ת שלכם", body: cleaned };
  }
}
