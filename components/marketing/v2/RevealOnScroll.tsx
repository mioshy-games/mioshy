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
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -80px 0px" }}
      transition={{ duration, delay, ease: [0.22, 0.61, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
