"use client";

// ============================================================
// hooks/useCountdown.ts
//
// Shared per-second countdown logic, extracted from
// components/games/ComingSoonCountdown.tsx so the games "opens in …"
// chip and the paywall promo-expiry line share ONE implementation.
//
// Contract:
//   • Ticks every second (client-only; `mounted` is false until the
//     first client effect runs, so server + first client paint agree
//     and the ticking seconds never cause a hydration mismatch).
//   • Fires `onExpire` exactly once when the target time is reached
//     (guarded by a ref) — callers pass router.refresh() so the server
//     re-renders in the now-expired state (promo price reverts, game
//     opens) with no cron and no manual flag.
// ============================================================

import { useEffect, useRef, useState } from "react";

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Split a positive millisecond duration into D/H/M/S (clamped at 0). */
export function countdownParts(msLeft: number): CountdownParts {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

export interface CountdownState extends CountdownParts {
  /** false until the first client tick — render a static/no fallback until then. */
  mounted: boolean;
  /** true once now ≥ target. */
  expired: boolean;
}

/**
 * Live countdown to `targetIso`. `onExpire` fires once at 0.
 * Returns D/H/M/S plus `mounted` / `expired` flags.
 */
export function useCountdown(
  targetIso: string,
  onExpire?: () => void,
): CountdownState {
  const target = new Date(targetIso).getTime();
  const [now, setNow] = useState<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (now !== null && now >= target && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [now, target, onExpire]);

  const mounted = now !== null;
  const expired = mounted && now >= target;
  return {
    ...countdownParts(mounted ? target - (now as number) : 0),
    mounted,
    expired,
  };
}
