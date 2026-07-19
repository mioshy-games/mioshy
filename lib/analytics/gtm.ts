/**
 * GTM dataLayer helper — the single place product code pushes the events GTM
 * builds triggers on (container GTM-5WQQB3R).
 *
 * Guarantees `window.dataLayer` exists before every push. GTM itself is
 * interaction-gated (see components/analytics/GoogleTagManager.tsx), so a push
 * can precede gtm.js — that's fine: GTM drains any events already queued on the
 * array when it loads.
 *
 * Event names here are CONTRACTUAL: GTM triggers key off them exactly
 * (case-sensitive). Do not rename an event without updating the container.
 *
 * Server-safe: no-op when there is no window (SSR / RSC).
 */
export function pushToDataLayer(event: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(event);
}
