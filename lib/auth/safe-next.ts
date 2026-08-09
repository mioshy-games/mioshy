/**
 * Validate a `?next=…` redirect target before pushing the user to it.
 *
 * Why this matters
 * ────────────────
 * Auth pages route users to whatever path the caller passed in `?next=`.
 * Without validation, an attacker could craft a phishing link like
 * `/auth?next=https://evil.example.com/steal` — the user signs in on
 * mioshy.com, gets redirected away to a hostile origin, and sees a
 * trusted-looking page that captures further input.
 *
 * Same-origin guard: accept only a path beginning with a single `/`, where the
 * next character cannot begin a new origin.
 *
 * Audit 2026-08-05, H4. This helper was correct but had NO CALLERS — both auth
 * surfaces had inlined their own check that blocked `//` and missed `/\`.
 * Browsers normalise a backslash to a forward slash when parsing an authority,
 * so `/\evil.com` and `/\/evil.com` are protocol-relative URLs that leave the
 * origin. Control characters are rejected too: a raw CR or LF in a redirect
 * target is a response-splitting / header-injection primitive, and no
 * legitimate internal path contains one.
 *
 * Returns the validated path, or `fallback` if the input fails.
 */
export function safeNext(
  next: string | string[] | null | undefined,
  fallback: string,
): string {
  if (!next || Array.isArray(next)) return fallback;
  const trimmed = next.trim();

  // Control characters (incl. CR, LF, NUL, TAB) — never valid in a path here.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return fallback;

  // A backslash anywhere is rejected: browsers treat it as a path separator
  // when resolving an authority, so it is only ever an escape attempt.
  if (trimmed.includes("\\")) return fallback;

  // Must be a single-slash-rooted path. `//host` is protocol-relative.
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;

  return trimmed;
}
