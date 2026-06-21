"use client";

/**
 * Meta (Facebook) browser Pixel — thin `fbq` wrappers.
 *
 * The base `fbq` script + init + PageView live in
 * `components/analytics/MetaPixelProvider.tsx` (prod-only, idle-deferred,
 * DNT-respecting). These helpers are what feature components call to fire
 * standard / custom events, each with an `eventID` shared with the server CAPI
 * event so Meta deduplicates.
 *
 * Every call no-ops safely when `fbq` isn't present (dev, DNT, missing pixel).
 */

import { metaEventId } from "./meta-event-id";

export { metaEventId };

type Fbq = (...args: unknown[]) => void;

// Query params we must never let reach Meta. fbq auto-attaches the current page
// URL (`dl`) to every event, so if the URL carries a share/pairing token we
// skip the event entirely rather than leak it. Mirrors PostHog's sanitizeUrl
// redaction list (partner-share `?code=`, etc.).
const REDACT_QUERY_PARAMS = ["code", "token", "email", "invite", "ref_code"];

function urlHasSensitiveParams(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return REDACT_QUERY_PARAMS.some((p) => params.has(p));
  } catch {
    return false;
  }
}

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return null;
  // Never emit on a page whose URL carries a sensitive token (fbq would attach
  // that URL to the event).
  if (urlHasSensitiveParams()) return null;
  return fbq;
}

/** Fire a STANDARD Meta event (Purchase, ViewContent, …) with a dedup eventID. */
export function metaTrack(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  const fbq = getFbq();
  if (!fbq) return;
  try {
    fbq("track", eventName, params ?? {}, eventId ? { eventID: eventId } : undefined);
  } catch {
    /* analytics must never break UI */
  }
}

/** Fire a CUSTOM Meta event (FreeGameSpin, FreeGameCTAClick). */
export function metaTrackCustom(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  const fbq = getFbq();
  if (!fbq) return;
  try {
    fbq("trackCustom", eventName, params ?? {});
  } catch {
    /* analytics must never break UI */
  }
}
