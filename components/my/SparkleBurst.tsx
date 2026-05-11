"use client";

/**
 * SparkleBurst - a one-shot, gentle sparkle that plays the first time
 * a user sees a rail entry transition into "current". Used to draw
 * attention without being noisy.
 *
 * Implementation:
 *   - Tracks "seen" entries in localStorage by key
 *   - Renders 5 small dots that fade outward over ~600ms
 *   - Respects prefers-reduced-motion: falls back to a static dot
 *   - Plays exactly once per (user, key) - even across tabs in the
 *     same session, since localStorage persists.
 *
 * Why not server-tracked: the existing `journey_scheduled_items.notified_at`
 * column already exists for backend notification tracking. This is a
 * UI-only "celebrate the moment" effect - separate concern.
 */

import { useEffect, useRef, useState } from "react";

const LS_KEY = "mioshy:sparkled";

export function SparkleBurst({
  /** Stable identifier - typically the rail entry's key. */
  sparkleKey,
  /** Whether this entry is currently in a "fresh" state. The
   *  component decides on its own whether to actually play
   *  the animation based on localStorage. */
  active,
}: {
  sparkleKey: string;
  active: boolean;
}) {
  const [shouldPlay, setShouldPlay] = useState(false);
  const playedRef = useRef(false);

  useEffect(() => {
    if (!active || playedRef.current) return;

    let seen: string[] = [];
    try {
      const raw = localStorage.getItem(LS_KEY);
      seen = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      seen = [];
    }

    if (seen.includes(sparkleKey)) {
      // Already seen on a prior visit - don't replay.
      return;
    }

    setShouldPlay(true);
    playedRef.current = true;

    // Persist so we don't re-fire on next page load.
    try {
      const updated = Array.from(new Set([...seen, sparkleKey])).slice(-200);
      localStorage.setItem(LS_KEY, JSON.stringify(updated));
    } catch {
      // ignore - best-effort
    }

    // Auto-stop after the animation completes
    const t = setTimeout(() => setShouldPlay(false), 1200);
    return () => clearTimeout(t);
  }, [active, sparkleKey]);

  if (!active) return null;

  // Reduced motion fallback: a quiet dot in the corner.
  // We can't read prefers-reduced-motion in SSR, so we render the
  // CSS-driven version and let the @media query kill the animation.
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
    >
      {shouldPlay ? (
        <span className="sparkle-burst absolute inset-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="sparkle-dot absolute h-1 w-1 rounded-full bg-white/95"
              style={{
                left: "50%",
                top: "50%",
                animationDelay: `${i * 60}ms`,
                // 5 directions around the center
                ["--sparkle-tx" as never]: `${
                  Math.cos((i / 5) * Math.PI * 2) * 18
                }px`,
                ["--sparkle-ty" as never]: `${
                  Math.sin((i / 5) * Math.PI * 2) * 18
                }px`,
              }}
            />
          ))}
        </span>
      ) : null}
      <style jsx>{`
        @keyframes mioshy-sparkle {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          25% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(
                calc(-50% + var(--sparkle-tx, 0px)),
                calc(-50% + var(--sparkle-ty, 0px))
              )
              scale(0.4);
            opacity: 0;
          }
        }
        .sparkle-dot {
          animation: mioshy-sparkle 600ms ease-out forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .sparkle-dot {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </span>
  );
}
