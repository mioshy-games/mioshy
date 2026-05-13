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
      // CMS migration follow-up (Sprint 1, 2026-05-13 / revised
      // 2026-05-13 PM after Itzik reported a regression):
      //
      // ONE change keeps the homepage visible during slow hydration:
      //
      //   `initial={false}` — Tells framer-motion to skip the
      //   "hidden" state on first render and start at "visible".
      //   Previously every section's <motion.div> rendered at
      //   opacity:0 (scale-up headlines) on SSR. With 11 newly
      //   "use client" sections in Sprint 1, hydration could take
      //   long enough on mid-range mobile that the
      //   IntersectionObserver registration ran AFTER a fast
      //   scroller had already passed sections, leaving them
      //   opacity:0 forever. With `initial={false}` the element is
      //   already visible on first paint — slow hydration no longer
      //   leaves sections blank.
      //
      // NOTE — the first revision of this fix ALSO flipped
      // `viewport.once: true → false`, on the theory it would let
      // the observer "catch up" via re-firing. That introduced a
      // different bug: every time a section left and re-entered the
      // viewport during ordinary up/down scrolling, framer-motion
      // animated it through hidden→visible AGAIN, producing a
      // ~400ms flicker the user saw as "content disappears for a
      // second". `initial={false}` alone is enough — content is
      // visible from SSR, the observer only needs to fire ONCE, and
      // there's nothing to replay on scroll-back. Reverted `once` to
      // `true`.
      initial={false}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -80px 0px" }}
      transition={{ duration, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
