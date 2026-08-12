"use client";

/**
 * The one place that answers "may we load a tracker for this visitor?".
 *
 * Both third-party trackers (PostHog, the Meta Pixel) and anything added later
 * must ask here rather than reading the cookie themselves — a second reader
 * with its own idea of what counts as consent is how the two drift apart, and
 * the one that drifts is the one that keeps tracking someone who said no.
 *
 * ── The rule ────────────────────────────────────────────────────────────────
 * Only `granted` is consent. `dismissed` is a REFUSAL, not an absence — the
 * visitor was asked and said no, and that answer is respected until the cookie
 * expires (30 days; `granted` lasts a year). No cookie at all means the
 * question is still on screen and has not been answered, which is also not
 * consent. So: load only on `granted`, and nothing else.
 *
 * This deliberately makes the default deny. A visitor who never answers, or who
 * blocks cookies entirely, gets no third-party tracker.
 *
 * ── What this does NOT gate ─────────────────────────────────────────────────
 * The first-party pipeline (`lib/analytics.ts` → /api/analytics/event →
 * `analytics_events`) is untouched by this, along with the `mioshy_device_id`
 * cookie it relies on. That is a deliberate scope line, not an oversight: it is
 * the funnel the team actually reads, it stays first-party, and it carries no
 * PII beyond a random UUID. Widening the gate to cover it is a product
 * decision, not a code one.
 *
 * The cookie is written by CookieConsentBar, which owns the modal and the two
 * lifetimes. This module only reads.
 */

export const CONSENT_COOKIE = "mioshy_cookie_consent";

/** Fired on `window` the moment a decision is stored, so a tracker gated below
 *  can start (or stay off) without waiting for a navigation. */
export const CONSENT_DECIDED_EVENT = "mioshy:consent-decided";

export type ConsentValue = "granted" | "dismissed";

/** The stored decision, or null when the visitor has not answered yet. */
export function readConsent(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )mioshy_cookie_consent=([^;]*)/);
  const v = m ? decodeURIComponent(m[1]) : null;
  return v === "granted" || v === "dismissed" ? v : null;
}

/** True ONLY for an explicit `granted`. Absent and `dismissed` are both no. */
export function hasAnalyticsConsent(): boolean {
  return readConsent() === "granted";
}

/** Subscribe to the decision. Returns an unsubscribe function. */
export function onConsentDecided(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CONSENT_DECIDED_EVENT, cb);
  return () => window.removeEventListener(CONSENT_DECIDED_EVENT, cb);
}
