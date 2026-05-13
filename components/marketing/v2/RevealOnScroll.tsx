"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "fade-up" | "scale-up" | "fade";

type Props = {
  children: ReactNode;
  /** Animation variant - `scale-up` for headlines, `fade-up` for body. */
  variant?: Variant;
  /** Delay in seconds before animation starts. */
  delay?: number;
  /** How far below the final position to start (px). Default 16. */
  offset?: number;
  className?: string;
};

const VARIANTS: Record<Variant, Variants> = {
  "fade-up": {
    hidden: { opacity: 0.4, y: 16 },
    visible: { opacity: 1, y: 0 },
  },
  "scale-up": {
    hidden: { opacity: 0, scale: 0.94, y: 24 },
    visible: { opacity: 1, scale: 1, y: 0 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
};

/**
 * RevealOnScroll - wraps children in a motion.div that animates from a
 * subtle starting state to its final state when scrolled into view.
 *
 * Variants:
 *   • fade-up   - opacity 0.4 → 1 + translateY(16px) → 0   (body text)
 *   • scale-up  - opacity 0 → 1 + scale 94% → 100% + translateY(24px) → 0   (headlines)
 *   • fade      - opacity 0 → 1 only   (decorative elements)
 *
 * Honors `prefers-reduced-motion` - skips animation entirely if user opted out.
 * Triggers once and stays in final state (no re-animate on scroll back).
 */
export function RevealOnScroll({
  children,
  variant = "fade-up",
  delay = 0,
  offset,
  className,
}: Props) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  // For fade-up, allow a custom offset (used in Hero spec).
  const variants =
    variant === "fade-up" && offset !== undefined
      ? {
          hidden: { opacity: 0.4, y: offset },
          visible: { opacity: 1, y: 0 },
        }
      : VARIANTS[variant];

  const duration = variant === "scale-up" ? 0.5 : 0.4;

  return (
    <motion.div
      className={className}
      variants={variants}
      // CMS migration follow-up (Sprint 1, 2026-05-13): TWO changes
      // here to keep the homepage visible during slow hydration.
      //
      // 1. `initial={false}` — Tells framer-motion to skip the
      //    "hidden" state on first render and start at "visible".
      //    Previously every section's <motion.div> rendered at
      //    opacity:0 (for scale-up headlines) on SSR. With 11 newly
      //    "use client" sections, hydration now takes long enough on
      //    mid-range mobile that the IntersectionObserver registration
      //    runs AFTER a fast scroller has already passed sections —
      //    they'd then stay opacity:0 forever because…
      //
      // 2. `viewport.once: false` (was true) — When `once` is true
      //    and the observer registers AFTER the section's first
      //    intersection has already happened (because hydration was
      //    slow), there's no replay; the section never animates and
      //    stays hidden. Setting it false lets the observer re-fire
      //    on any subsequent re-entry, so scroll-back recovers any
      //    section that missed its first paint trigger. Animation
      //    starts from current visual state so no visible re-bounce.
      //
      // Net effect: SSR shows the final state (content visible). When
      // hydration completes, framer-motion takes over and animates
      // entries that are still in/below the viewport. Fast-scroll
      // past a section no longer leaves it invisible.
      initial={false}
      whileInView="visible"
      viewport={{ once: false, amount: 0.2, margin: "0px 0px -80px 0px" }}
      transition={{ duration, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
