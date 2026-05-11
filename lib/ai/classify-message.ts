/**
 * lib/ai/classify-message.ts
 *
 * Phase 4 — Claude Haiku classifier for incoming user messages.
 *
 * Returns sentiment + topic tags + urgency flag for a given message
 * body, so:
 *   - the admin tracker can filter by sentiment (urgent first)
 *   - the coach SLA queue can prioritize high-urgency rows
 *   - admin sees patterns ("conflict tag spiking this week")
 *
 * Implementation choices:
 *   - Direct fetch to api.anthropic.com — no new npm dep needed.
 *   - Claude Haiku (claude-haiku-4-5-20251001) — cheap, fast, accurate
 *     for this kind of short classification.
 *   - Returns null on any failure. NEVER throws. The caller must
 *     treat enrichment as best-effort — the user's message persistence
 *     never depends on this.
 *   - Tag taxonomy is fixed (5 priority categories + 7 cross-cutting
 *     subjects), constraining the LLM to a stable vocabulary.
 *
 * Env: ANTHROPIC_API_KEY required. When missing, the function logs
 * a warning and returns null — same shape as a failed call, so
 * callers don't need to special-case "not configured".
 */

import "server-only";

export type MessageSentiment =
  | "positive"
  | "neutral"
  | "concerning"
  | "urgent";

/**
 * Stable tag vocabulary the model is constrained to. Keeps the
 * results predictable for filtering and aggregation.
 */
export const ALLOWED_AUTO_TAGS = [
  // Priority categories (mirror the 5 main domains)
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
  // Cross-cutting subjects
  "conflict",
  "appreciation",
  "stuck",
  "win",
  "question",
  "request_for_help",
  "exercise_feedback",
] as const;

export type AutoTag = (typeof ALLOWED_AUTO_TAGS)[number];

export interface ClassificationResult {
  sentiment: MessageSentiment;
  auto_tags: AutoTag[];
}

const ANTHROPIC_URL    = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL  = "claude-haiku-4-5-20251001";
const MAX_BODY_FOR_LLM = 4000;

const SYSTEM_PROMPT = `You are a classifier for a Hebrew couples-coaching platform called Mioshy. Each input is a single message a user wrote to their coach (in Hebrew or English). Your job: return a JSON object with two fields:

1. "sentiment": exactly one of "positive" | "neutral" | "concerning" | "urgent".
   - "positive": user reports a win, feels good, expresses gratitude, shares progress.
   - "neutral": informational, asking a question, sharing without strong emotion.
   - "concerning": frustration, hopelessness, doubt about the relationship, persistent stuck feelings.
   - "urgent": signals of crisis, safety risk, abuse, suicidal ideation, severe acute distress.

2. "auto_tags": an array of 1-3 tags from this exact list (lowercase, no others):
   ["communication","intimacy","emotional_connection","friendship","family","conflict","appreciation","stuck","win","question","request_for_help","exercise_feedback"]

Output ONLY valid JSON, no prose, no markdown fences. Example:
{"sentiment":"concerning","auto_tags":["intimacy","stuck"]}

If the text is too short or unclear, return:
{"sentiment":"neutral","auto_tags":["question"]}`;

/**
 * Classify a single message. Returns null on any failure — the caller
 * MUST handle null gracefully. Latency target: < 1.5s p95.
 */
export async function classifyMessage(
  body: string,
): Promise<ClassificationResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[classify-message] ANTHROPIC_API_KEY missing — skipping");
    return null;
  }

  const trimmed = (body ?? "").trim().slice(0, MAX_BODY_FOR_LLM);
  if (trimmed.length < 3) return null;

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
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: trimmed,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "<unreadable>");
      console.warn("[classify-message] non-200", {
        status: res.status,
        body: text.slice(0, 300),
      });
      return null;
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const textBlock = (data.content ?? []).find((b) => b.type === "text");
    const raw = (textBlock?.text ?? "").trim();
    if (!raw) return null;

    return parseAndValidate(raw);
  } catch (e) {
    console.warn("[classify-message] threw", e);
    return null;
  }
}

/**
 * Parse the model's JSON output and constrain to the allowed enums.
 * Defensive: any malformed field falls back to neutral / [].
 */
function parseAndValidate(raw: string): ClassificationResult | null {
  // Strip markdown fences if the model added them.
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

  // Sentiment
  const rawSentiment = String(obj.sentiment ?? "").toLowerCase();
  const sentiment: MessageSentiment =
    rawSentiment === "positive"   ? "positive"   :
    rawSentiment === "concerning" ? "concerning" :
    rawSentiment === "urgent"     ? "urgent"     :
                                    "neutral";

  // Tags
  const rawTags = Array.isArray(obj.auto_tags) ? obj.auto_tags : [];
  const tags = rawTags
    .map((t) => String(t ?? "").toLowerCase().trim())
    .filter((t): t is AutoTag =>
      (ALLOWED_AUTO_TAGS as readonly string[]).includes(t),
    );

  // Cap at 3 tags to keep the chip ribbon scannable.
  return { sentiment, auto_tags: tags.slice(0, 3) };
}

/**
 * Convenience: classify + UPDATE the message row in one call.
 * Returns true when the row was updated, false on any classification
 * failure.
 *
 * The caller fires this fire-and-forget after the message insert,
 * so the user never blocks on the LLM round-trip.
 */
export async function classifyAndStampMessage(args: {
  /** Which table to update. */
  table: "journey_messages" | "journey_couple_channel_messages";
  messageId: string;
  body: string;
}): Promise<boolean> {
  const result = await classifyMessage(args.body);
  if (!result) return false;

  // Lazy-import the admin client so this module stays cheap to load
  // for callers that only need the type exports.
  const { createServiceRoleClient } = await import("@/lib/supabase-admin");
  const admin = createServiceRoleClient();
  if (!admin) return false;

  const { error } = await admin
    .from(args.table)
    .update({
      sentiment: result.sentiment,
      auto_tags: result.auto_tags,
    })
    .eq("id", args.messageId);

  if (error) {
    console.warn("[classify-message] update failed", {
      messageId: args.messageId,
      err: error.message,
    });
    return false;
  }
  return true;
}
