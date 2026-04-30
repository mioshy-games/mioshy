/**
 * Validate a `?next=…` redirect target before pushing the user to it.
 *
 * Why this matters
 * ────────────────
 * Auth pages route users to whatever path the caller passed in `?next=`.
 * Without validation, an attacker could craft a phishing link like
 * `/auth?next=https://evil.example.com/steal` - the user signs in on
 * mioshy.com, gets redirected away to a hostile origin, and sees a
 * trusted-looking page that captures further input.
 *
 * Same-origin guard: only accept paths that start with a single `/`
 * AND don't start with `//` or `/\` (which browsers parse as
 * protocol-relative URLs that escape the origin).
 *
 * Returns the validated path, or the `fallback` if the input fails.
 */
export function safeNext(
  next: string | string[] | null | undefined,
  fallback: string,
): string {
  if (!next || Array.isArray(next)) return fallback;
  const trimmed = next.trim();
  // Must start with single slash, and the second char must not start a new
  // origin (so reject "//evil.com" and "/\\evil.com" - both browser-parsed
  // as protocol-relative URLs).
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }
  return trimmed;
}
