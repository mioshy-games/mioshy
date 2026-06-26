/**
 * URL redaction — shared between PostHog (replay/properties) and the
 * first-party analytics pipeline (`lib/analytics.ts`).
 *
 * Mioshy renders intimate couples content and ships partner-pairing links that
 * carry a one-time `?code=` token. None of those tokens (nor email/invite refs)
 * may ever reach an analytics store. This is the single source of truth for
 * which query params get stripped, so PostHog and `analytics_events` mask
 * identically. Extracted from PostHogProvider.tsx (Itzik 2026-06-26) so the
 * first-party `page_view`/`referrer` path gets the same treatment.
 */

// Query params we never want to leave the browser, even inside a URL string.
export const REDACT_QUERY_PARAMS = ["code", "token", "email", "invite", "ref_code"];

/**
 * Replace the value of any sensitive query param with "redacted", preserving
 * the input shape (path-only stays path-only; absolute stays absolute). Returns
 * the input untouched when it isn't a non-empty string or can't be parsed, so
 * it's safe to pass arbitrary event-property values through it.
 */
export function sanitizeUrl(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw) return raw;
  try {
    // raw can be absolute or path-only; give the URL ctor a base either way.
    const u = new URL(raw, "https://mioshy.com");
    let touched = false;
    for (const p of REDACT_QUERY_PARAMS) {
      if (u.searchParams.has(p)) {
        u.searchParams.set(p, "redacted");
        touched = true;
      }
    }
    if (!touched) return raw;
    // Return in the same shape we got it (path-only vs absolute).
    return raw.startsWith("http") ? u.toString() : u.pathname + u.search + u.hash;
  } catch {
    return raw;
  }
}
