"use client";

/**
 * useDwellTracking — per-surface dwell-time instrumentation.
 * (admin-analytics-spec §6, §10.5)
 *
 * Measures how long a user actively spends on a surface and emits `dwell`
 * heartbeats to analytics_events. Mount it once per surface:
 *
 *   useDwellTracking("games", game.slug);   // per-game
 *   useDwellTracking("journey", itemId);    // per-chapter
 *   useDwellTracking("adults", `${gameId}:${level}`); // per-level
 *
 * Behaviour (per the approved spec):
 *  • Counts only ACTIVE time — the timer pauses while the tab is hidden, so
 *    background time is never counted.
 *  • Emits a heartbeat every 15s carrying the active-ms DELTA since the last
 *    send, so the dashboard view (Phase 2) sums deltas into a clean total
 *    without double-counting.
 *  • Flushes the final span on visibilitychange→hidden, pagehide and unmount
 *    via navigator.sendBeacon (survives navigation/close).
 *  • Suppresses visits under 5s (filters accidental opens).
 *  • Metadata only — no content ever leaves the client (privacy approach A).
 *
 * Fire-and-forget; never throws into the host component.
 */

import { useEffect } from "react";
import { track, sendBeaconEvent } from "@/lib/analytics";

/** Heartbeat cadence (spec §10.5). */
const HEARTBEAT_MS = 15_000;
/** Minimum cumulative active time for a span to count as a visit (spec §10.5). */
const MIN_VISIT_MS = 5_000;

export type DwellPillar = "journey" | "games" | "adults";

export function useDwellTracking(
  pillar: DwellPillar,
  refId?: string | null,
): void {
  useEffect(() => {
    if (typeof document === "undefined") return;

    // Mutable timing state (refs → no re-renders).
    let activeMs = 0;            // total accumulated active ms
    let sentMs = 0;              // activeMs already reported (idempotency anchor)
    let spanStart: number | null = null; // start of the current visible span

    const openSpan = () => {
      if (spanStart === null && document.visibilityState === "visible") {
        spanStart = Date.now();
      }
    };

    // Close the current visible span into the accumulator.
    const closeSpan = () => {
      if (spanStart !== null) {
        activeMs += Date.now() - spanStart;
        spanStart = null;
      }
    };

    /**
     * Emit the active-ms delta since the last send. Idempotent: a delta of 0
     * (already flushed) is a no-op, so overlapping hidden/pagehide/unmount
     * triggers never double-count.
     */
    const flush = (useBeacon: boolean) => {
      closeSpan();
      const delta = activeMs - sentMs;
      // Only report once the visit has crossed the minimum threshold.
      if (activeMs < MIN_VISIT_MS || delta <= 0) {
        if (!useBeacon) openSpan(); // heartbeat path: keep counting
        return;
      }
      const props = {
        pillar,
        ms: delta,
        ...(refId ? { item_id: refId } : {}),
      };
      if (useBeacon) sendBeaconEvent("dwell", props);
      else track("dwell", props);
      sentMs = activeMs;
      if (!useBeacon) openSpan(); // resume the timer for the next heartbeat
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Tab backgrounded → stop counting + flush what we have (mobile may
        // never fire beforeunload, so beacon now).
        flush(true);
      } else {
        openSpan();
      }
    };
    const onPageHide = () => flush(true);

    openSpan();
    const heartbeat = setInterval(() => flush(false), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      // SPA route change / refId change → flush the final span. Page is still
      // alive here, so a beacon is fine and stays idempotent with any prior
      // hidden/pagehide flush.
      flush(true);
    };
    // Re-arm when the surface identity changes (e.g. navigating chapters)
    // so the previous span is flushed and a fresh one begins.
  }, [pillar, refId]);
}
