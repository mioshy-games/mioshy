"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  /** How many pixels of parallax movement total (split half up, half down). */
  range?: number;
};

/**
 * ParallaxImage - wraps next/image with a subtle parallax scroll effect.
 * The image translates ±range/2 px as the user scrolls past it.
 *
 * Honors `prefers-reduced-motion` - falls back to a plain Image if user
 * opted out. Range default 16px is intentionally small to avoid motion
 * sickness; never goes above 24px.
 */
export function ParallaxImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  range = 16,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Clamp range to [0, 24] for safety
  const safeRange = Math.min(Math.max(range, 0), 24);
  const y = useTransform(scrollYProgress, [0, 1], [safeRange / 2, -safeRange / 2]);

  if (prefersReducedMotion) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        priority={priority}
      />
    );
  }

  return (
    <div ref={ref} style={{ overflow: "hidden", borderRadius: "inherit" }}>
      <motion.div style={{ y }}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={className}
          priority={priority}
        />
      </motion.div>
    </div>
  );
}
