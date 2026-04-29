"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Reusable dark animated background — extracted from GamePageBackground.
 * Lighter than the full game variant (no particles, no scanlines) so it
 * can be used as a backdrop for any "hero-ish" surface without stealing
 * focus from the content on top of it.
 */

type Orb = {
  color: string;
  size: string;
  x: string;
  y: string;
  dx: number;
  dy: number;
  dur: number;
  blur: string;
  op: number;
};

type Palette = [string, string, string];

const PILLAR_PALETTES: Record<string, Palette> = {
  games: ["#8b5cf6", "#ec4899", "#06b6d4"], // violet → pink → cyan
  journey: ["#14b8a6", "#6366f1", "#a855f7"], // teal → indigo → purple
  adults: ["#e11d48", "#b91c1c", "#f59e0b"], // rose → red → amber
  default: ["#8800ff", "#ff0088", "#0088ff"],
};

export function AnimatedOrbsBg({
  pillar = "default",
  baseColor = "#05030a",
  intensity = "normal",
  children,
  className = "",
}: {
  pillar?: keyof typeof PILLAR_PALETTES | string;
  baseColor?: string;
  intensity?: "subtle" | "normal" | "bold";
  children?: ReactNode;
  className?: string;
}) {
  const palette = PILLAR_PALETTES[pillar] ?? PILLAR_PALETTES.default;
  const [c1, c2, c3] = palette;

  const opMul = intensity === "subtle" ? 0.5 : intensity === "bold" ? 1.15 : 1;

  const orbs: Orb[] = [
    { color: c1, size: "85vw", x: "18%", y: "35%", dx: 300, dy: 220, dur: 19, blur: "110px", op: 0.78 * opMul },
    { color: c2, size: "65vw", x: "72%", y: "55%", dx: 270, dy: 240, dur: 23, blur: "100px", op: 0.65 * opMul },
    { color: c3, size: "55vw", x: "48%", y: "18%", dx: 200, dy: 280, dur: 28, blur: "120px", op: 0.48 * opMul },
  ];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Solid base */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: baseColor }}
      />

      {/* Animated blobs */}
      {orbs.map((o, i) => {
        const dir = i % 2 === 0 ? 1 : -1;
        return (
          <motion.div
            key={i}
            className="pointer-events-none absolute rounded-full"
            style={{
              width: o.size,
              height: o.size,
              left: o.x,
              top: o.y,
              translateX: "-50%",
              translateY: "-50%",
              background: o.color,
              filter: `blur(${o.blur})`,
              opacity: o.op,
              willChange: "transform",
            }}
            animate={{
              x: [0, o.dx * dir, o.dx * dir * -0.6, 0],
              y: [0, o.dy, o.dy * -0.7, o.dy * 0.3, 0],
            }}
            transition={{
              duration: o.dur,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "mirror",
            }}
          />
        );
      })}

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      {/* Subtle noise */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* Content */}
      {children ? <div className="relative">{children}</div> : null}
    </div>
  );
}
