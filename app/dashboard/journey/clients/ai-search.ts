"use server";

/**
 * app/dashboard/journey/clients/ai-search.ts
 *
 * AI smart-search for the Couples list. The admin types a natural-language
 * question in Hebrew ("מי לא סיים את השאלון השבוע") and we translate it into
 * a small, fixed FILTER SPEC that the client applies to the already-loaded
 * rows. We deliberately return a predicate spec — NOT row ids and NOT SQL —
 * so:
 *   - nothing about the DB schema leaks to the model,
 *   - the whole client list never has to travel to the API,
 *   - it stays cheap and fast (Haiku, <1.5s target).
 *
 * NEVER throws. Returns null on any failure (missing key, bad JSON, network)
 * so the caller falls back to plain text search. A plain name like
 * "נועה כהן" should come back as { textIncludes: "נועה כהן" }.
 *
 * Env: ANTHROPIC_API_KEY. Reuses the same direct-fetch pattern as
 * lib/ai/classify-message.ts — no new npm dependency.
 */

import { requireAdmin } from "@/lib/auth/admin";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export type CoupleState =
  | "active"
  | "paused"
  | "no_content"
  | "progressing"
  | "complete";

/** The fixed vocabulary the model is constrained to emit. */
export interface CoupleFilterSpec {
  kind?: "couple" | "user";
  states?: CoupleState[];
  /** Last activity within the last N days (e.g. "this week" -> 7). */
  activityWithinDays?: number;
  /** No activity for at least N days (stale clients). */
  staleForDays?: number;
  minCompletedPct?: number;
  maxCompletedPct?: number;
  /** Free-text name / pair-code match, applied case-insensitively. */
  textIncludes?: string;
}

const SYSTEM_PROMPT = `You translate a single admin search query (Hebrew or English) about a list of couples/clients on a couples-coaching platform into a JSON filter. Return ONLY a JSON object, no prose, no markdown fences.

Allowed fields (all optional — include only what the query implies):
- "kind": "couple" | "user"
- "states": array of any of ["active","paused","no_content","progressing","complete"]
- "activityWithinDays": number (e.g. "this week" -> 7, "today" -> 1, "this month" -> 30)
- "staleForDays": number (e.g. "haven't been active in a while" -> 14)
- "minCompletedPct": number 0-100
- "maxCompletedPct": number 0-100
- "textIncludes": string (a person/couple name or pair code mentioned literally)

Mapping hints:
- "didn't finish" / "לא סיימו" -> { "maxCompletedPct": 99 }
- "finished" / "סיימו" -> { "states": ["complete"] }
- "haven't started" / "לא התחילו" -> { "maxCompletedPct": 0 }
- "stuck" / "paused" / "תקועים" -> { "states": ["paused"] }
- A bare name with no other intent -> { "textIncludes": "<name>" }

If the query is just a name, return only textIncludes. If you cannot map it, return {}.

Examples:
"מי לא סיים את השאלון השבוע" -> {"maxCompletedPct":99,"activityWithinDays":7}
"זוגות פעילים" -> {"states":["active"],"kind":"couple"}
"נועה כהן" -> {"textIncludes":"נועה כהן"}`;

const ALLOWED_STATES: CoupleState[] = [
  "active",
  "paused",
  "no_content",
  "progressing",
  "complete",
];

function clampPct(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function clampDays(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(365, Math.round(n));
}

function validate(raw: string): CoupleFilterSpec | null {
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
  const o = parsed as Record<string, unknown>;
  const spec: CoupleFilterSpec = {};

  if (o.kind === "couple" || o.kind === "user") spec.kind = o.kind;
  if (Array.isArray(o.states)) {
    const states = o.states.filter((s): s is CoupleState =>
      ALLOWED_STATES.includes(s as CoupleState),
    );
    if (states.length) spec.states = states;
  }
  const aw = clampDays(o.activityWithinDays);
  if (aw) spec.activityWithinDays = aw;
  const sf = clampDays(o.staleForDays);
  if (sf) spec.staleForDays = sf;
  const minp = clampPct(o.minCompletedPct);
  if (minp !== undefined) spec.minCompletedPct = minp;
  const maxp = clampPct(o.maxCompletedPct);
  if (maxp !== undefined) spec.maxCompletedPct = maxp;
  if (typeof o.textIncludes === "string" && o.textIncludes.trim()) {
    spec.textIncludes = o.textIncludes.trim().slice(0, 120);
  }

  return spec;
}

/**
 * Translate a query to a filter spec. Returns null on any failure so the
 * caller can fall back to a literal text match.
 */
export async function aiSearchCouples(
  question: string,
): Promise<CoupleFilterSpec | null> {
  // Admin-gate: this action is invoked from an admin-only page, but server
  // actions are independently reachable, so we re-check the session.
  await requireAdmin();

  const q = (question ?? "").trim().slice(0, 300);
  if (q.length < 2) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai-search-couples] ANTHROPIC_API_KEY missing — fallback");
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
        model: ANTHROPIC_MODEL,
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: q }],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "<unreadable>");
      console.warn("[ai-search-couples] non-200", {
        status: res.status,
        body: text.slice(0, 200),
      });
      return null;
    }
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const block = (data.content ?? []).find((b) => b.type === "text");
    const raw = (block?.text ?? "").trim();
    if (!raw) return null;
    return validate(raw);
  } catch (e) {
    console.warn("[ai-search-couples] threw", e);
    return null;
  }
}
