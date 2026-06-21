"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = {
  /** Final numeric value (e.g. 1000, 4.8, 67). */
  to: number;
  /**
   * Number of decimals to display. For values like 4.8 use `1`.
   * For percentages like 67 use `0`.
   */
  decimals?: number;
  /** Optional prefix (e.g. "+"). */
  prefix?: string;
  /** Optional suffix (e.g. "%", "★"). */
  suffix?: string;
  /** How long the count-up takes, in seconds. Default 1.4. */
  duration?: number;
  /** Apply thousands separator (Hebrew uses comma). Default true. */
  thousands?: boolean;
};

/**
 * Counter - animates a number from 0 to `to` when scrolled into view.
 *
 * Used for stats blocks (1,000+, 4.8★, 67%, etc.). Honors
 * `prefers-reduced-motion` - renders the final value immediately if user
 * opted out.
 *
 * Triggers once and stays put.
 */
export function Counter({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.4,
  thousands = true,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const motionValue = useMotionValue(0);
  const prefersReducedMotion = useReducedMotion();

  const display = useTransform(motionValue, (latest) => {
    const n = decimals > 0 ? latest.toFixed(decimals) : Math.round(latest).toString();
    const formatted =
      thousands && decimals === 0 ? Number(n).toLocaleString("he-IL") : n;
    return `${prefix}${formatted}${suffix}`;
  });

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion) {
      motionValue.set(to);
      return;
    }
    const controls = animate(motionValue, to, {
      duration,
      ease: [0.22, 0.61, 0.36, 1],
    });
    return () => controls.stop();
  }, [inView, to, duration, motionValue, prefersReducedMotion]);

  // motion.span renders a MotionValue<string> as live-updating text content —
  // i.e. the text node mutates on every animation frame during the ~1.4s
  // count-up. Perf (2026-06-21): with PostHog session replay's
  // `maskTextSelector: "*"`, rrweb would serialise + mask each of those
  // mutations, a needless main-thread burst on first paint. `data-ph-no-capture`
  // matches the configured `blockSelector` in PostHogProvider, so replay ignores
  // this subtree entirely — no per-frame recording. Live visuals are unchanged
  // (the attribute only affects what replay captures); the number is a public
  // marketing stat, so blocking it from replay loses nothing.
  return (
    <motion.span ref={ref} aria-label={`${prefix}${to}${suffix}`} data-ph-no-capture="">
      {display}
    </motion.span>
  );
}
