/**
 * lib/dashboard/auto-tag.ts
 *
 * Pure deterministic tagger for journey responses + user→clinician
 * messages. Phase 4 — no LLM, just rules.
 *
 * The clinician inbox surfaces the resulting tags as small chips so
 * the team can triage faster. The taxonomy (defined here) is the
 * single source of truth for both the writer (responses.ts /
 * user-messages.ts at submit time) and the reader (CRM filters).
 *
 * Adding a new tag:
 *   1. Add the literal to ResponseTag below
 *   2. Implement the predicate inside computeResponseTags / computeMessageTags
 *   3. (optional) Add a label in tagLabel() so the inbox renders it nicely
 *
 * Privacy:
 *   The text passed to this function may contain personal content. We
 *   only inspect it for length and tokens — we do not persist it
 *   anywhere besides the `tags` array of the row that owns it.
 */

// ─── Tag taxonomy ──────────────────────────────────────────────────

export type ResponseTag =
  | "short"
  | "long"
  | "no_text"
  | "contains_url"
  | "crisis_keyword"
  | "q_assessment"
  | "private";

export type MessageTag =
  | "short"
  | "long"
  | "contains_url"
  | "crisis_keyword"
  | "question"; // contains '?' — clinician should respond explicitly

// Soft prompt for the clinician — NOT a clinical triage replacement.
// Conservatively short list. Order doesn't matter.
//
// Hebrew + English entries. Match is case-insensitive, whole-word-ish
// (we use a loose includes check on a normalised lowercase string —
// false positives are acceptable; the cost is a calmer "look at this"
// nudge to the clinician). We err on the side of more flagging.
const CRISIS_TOKENS = [
  // Hebrew
  "אובדנ",
  "להתאבד",
  "להרוג",
  "לסיים את הכל",
  "לא רוצה לחיות",
  "לפגוע בעצמ",
  "מכ", // רק יחד עם בקשה — ראה תנאי בהמשך
  // English
  "suicid",
  "kill myself",
  "kill him",
  "kill her",
  "end it all",
  "self harm",
  "self-harm",
  "abuse",
  "violen",
] as const;

const URL_PATTERN = /\bhttps?:\/\/\S+/i;

const SHORT_THRESHOLD = 25;
const LONG_THRESHOLD = 600;

// ─── Public API ─────────────────────────────────────────────────────

export function computeResponseTags(input: {
  text: string | null | undefined;
  isPrivate: boolean;
  hasStructuredAnswer: boolean;
}): ResponseTag[] {
  const text = (input.text ?? "").trim();
  const tags: ResponseTag[] = [];

  if (text.length === 0) tags.push("no_text");
  else {
    if (text.length < SHORT_THRESHOLD) tags.push("short");
    if (text.length > LONG_THRESHOLD) tags.push("long");
    if (URL_PATTERN.test(text)) tags.push("contains_url");
    if (containsCrisisToken(text)) tags.push("crisis_keyword");
  }

  if (input.hasStructuredAnswer) tags.push("q_assessment");
  if (input.isPrivate) tags.push("private");

  // Stable order, dedupe (defensive)
  return Array.from(new Set(tags));
}

export function computeMessageTags(input: { text: string }): MessageTag[] {
  const text = input.text.trim();
  const tags: MessageTag[] = [];

  if (text.length < SHORT_THRESHOLD) tags.push("short");
  if (text.length > LONG_THRESHOLD) tags.push("long");
  if (URL_PATTERN.test(text)) tags.push("contains_url");
  if (containsCrisisToken(text)) tags.push("crisis_keyword");
  if (text.includes("?") || text.includes("؟")) tags.push("question");

  return Array.from(new Set(tags));
}

/** Localised labels for the inbox. Falls back to the literal tag
 *  when the locale doesn't have a specific copy. */
export function tagLabel(tag: ResponseTag | MessageTag, isHe: boolean): string {
  const map_he: Record<string, string> = {
    short: "קצר",
    long: "ארוך",
    no_text: "ללא טקסט",
    contains_url: "מכיל קישור",
    crisis_keyword: "דורש תשומת לב",
    q_assessment: "אבחון",
    private: "פרטי",
    question: "שאלה",
  };
  const map_en: Record<string, string> = {
    short: "Short",
    long: "Long",
    no_text: "No text",
    contains_url: "Has link",
    crisis_keyword: "Needs attention",
    q_assessment: "Assessment",
    private: "Private",
    question: "Question",
  };
  return (isHe ? map_he : map_en)[tag] ?? tag;
}

/** Whether the tag should be visually elevated in the inbox. */
export function tagSeverity(
  tag: ResponseTag | MessageTag,
): "neutral" | "info" | "warn" {
  if (tag === "crisis_keyword") return "warn";
  if (tag === "long" || tag === "q_assessment" || tag === "question") return "info";
  return "neutral";
}

// ─── Internals ──────────────────────────────────────────────────────

function containsCrisisToken(text: string): boolean {
  const lower = text.toLowerCase();
  // Tighten the loose Hebrew "מכ" to require neighbouring context
  // so we don't flag every benign "מכל" or "מכן". We accept
  // "מכה" / "מכות" / "מכים" forms.
  for (const token of CRISIS_TOKENS) {
    if (token === "מכ") {
      if (/\bמכ(ה|ות|ים)\b/.test(text)) return true;
      continue;
    }
    if (lower.includes(token.toLowerCase())) return true;
  }
  return false;
}
