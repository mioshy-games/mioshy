/**
 * PII redaction for log output.
 *
 * Audit 2026-08-05, H5.
 *
 * Vercel log retention is long and access is broad, so anything written here is
 * effectively a second copy of the database with weaker access control. This
 * module is the single choke point that keeps identifiers out of it.
 *
 * Deliberately split out of log.ts — that file imports "server-only", which
 * cannot be loaded from a unit test. Keeping the rules here means they are
 * directly testable.
 *
 * Two layers, because both failure modes happen in practice:
 *   1. Keys whose VALUE is inherently identifying are dropped by name.
 *   2. Any remaining string is scrubbed for email and E.164 patterns, which
 *      catches PII embedded in free text like an error message.
 */

/**
 * Field names whose values are never safe to log.
 *
 * `body`, `text` and `answer` are here because this product's free text is
 * intimate relationship content — the most sensitive data we hold.
 */
const DROP_KEYS =
  /^(email|phone|mobile|to_address|body|answer|text|token|password|secret|authorization)$/i;

/** Emails: local@domain.tld → "[email]". */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * E.164-ish phone numbers → "[phone]".
 *
 * Requires a leading + or a run of 9+ digits, so ordinary numeric values
 * (durations, counts, amounts, timestamps in ms) are left alone. Guarded on
 * both sides so it does not bite into a longer token.
 */
const PHONE_RE = /(?<![\w+])(\+\d[\d\s().-]{7,}\d|\d{9,15})(?![\w])/g;

/** Scrub identifiers out of a free-text string. */
export function redactString(value: string): string {
  return value.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
}

/** True when a field name should be dropped outright rather than scrubbed. */
export function isDroppedKey(key: string): boolean {
  return DROP_KEYS.test(key);
}

/**
 * Apply both layers to one field.
 *
 * Returns `undefined` for a dropped key so the caller can omit it entirely —
 * logging `email=[redacted]` on every line is noise that teaches people the
 * field exists without telling them anything useful.
 */
export function redactField(
  key: string,
  value: string | number | boolean | null | undefined,
): string | number | boolean | null | undefined {
  if (isDroppedKey(key)) return undefined;
  if (typeof value === "string") return redactString(value);
  return value;
}
