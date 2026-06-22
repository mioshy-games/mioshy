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

/** Raw fbq presence check ONLY (no URL gate) — so we can tell "pixel not ready
 *  yet" apart from "sensitive URL" and buffer vs drop accordingly. */
function rawFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fbq === "function" ? fbq : null;
}

type QueuedCall =
  | { kind: "track"; name: string; params: Record<string, unknown>; eventId?: string }
  | { kind: "trackCustom"; name: string; params: Record<string, unknown> };

// ── Race fix (2026-06-22) ────────────────────────────────────────────────────
// MetaPixelProvider loads the pixel at browser idle (deferred), so events fired
// before init existed used to be dropped — explaining CompleteAssessment landing
// only ~1/3 of the time (it fires on the post-login summary remount, where
// isDone is already true at mount, BEFORE the idle init runs). We now BUFFER any
// event fired before the pixel is ready and flush it on init. Module-scoped
// (singleton) so it's shared with the provider's flushMetaPixelQueue(). Capped
// so a pixel that never initialises (dev / DNT / missing env) can't grow it
// unbounded.
const MAX_BUFFER = 50;
const buffer: QueuedCall[] = [];
let pixelReady = false;

function emit(call: QueuedCall): boolean {
  const fbq = rawFbq();
  if (!fbq) return false;
  try {
    if (call.kind === "track") {
      fbq(
        "track",
        call.name,
        call.params,
        call.eventId ? { eventID: call.eventId } : undefined,
      );
    } else {
      fbq("trackCustom", call.name, call.params);
    }
  } catch {
    /* analytics must never break UI */
  }
  return true;
}

function dispatch(call: QueuedCall): void {
  // Privacy: never emit on a page whose URL carries a share/pairing token — fbq
  // auto-attaches the page URL. Checked against the CURRENT url at send time.
  if (urlHasSensitiveParams()) return;
  if (pixelReady && emit(call)) return;
  // Pixel not ready yet → buffer for flush on init (instead of dropping).
  if (buffer.length < MAX_BUFFER) buffer.push(call);
}

/**
 * Mark the pixel ready and drain anything buffered before init. Called by
 * MetaPixelProvider right after `fbq('init', …)`. Idempotent.
 */
export function flushMetaPixelQueue(): void {
  pixelReady = true;
  if (!buffer.length) return;
  const pending = buffer.splice(0, buffer.length);
  for (const call of pending) {
    // Re-check the URL at drain time — it may have navigated since enqueue.
    if (urlHasSensitiveParams()) continue;
    if (!emit(call) && buffer.length < MAX_BUFFER) buffer.push(call); // fbq vanished → re-buffer
  }
}

/** Fire a STANDARD Meta event (Purchase, ViewContent, …) with a dedup eventID. */
export function metaTrack(
  eventName: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  dispatch({ kind: "track", name: eventName, params: params ?? {}, eventId });
}

/** Fire a CUSTOM Meta event (FreeGameSpin, FreeGameCTAClick, CompleteAssessment). */
export function metaTrackCustom(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  dispatch({ kind: "trackCustom", name: eventName, params: params ?? {} });
}
