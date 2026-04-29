"use client";

import { motion } from "framer-motion";

/**
 * A soft, light-theme animated backdrop. Three pastel blobs drifting
 * behind the hero, plus a subtle grain — premium feel without visual noise.
 *
 * Designed for `position: absolute; inset-0` placement inside a relatively
 * positioned hero/section.
 */
export function GentleAnimatedBg({
  intensity = "normal",
}: {
  intensity?: "normal" | "soft";
}) {
  const op = intensity === "soft" ? 0.45 : 0.7;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base cream wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #FFF9FB 0%, #FCE7F3 35%, #EDE9FE 68%, #FEF3C7 100%)",
        }}
      />

      {/* Drifting blobs */}
      <Blob
        color="rgba(244,114,182,0.55)"
        size="60vw"
        left="10%"
        top="30%"
        dx={160}
        dy={120}
        dur={22}
        op={op}
      />
      <Blob
        color="rgba(167,139,250,0.50)"
        size="55vw"
        left="80%"
        top="55%"
        dx={-180}
        dy={140}
        dur={28}
        op={op}
      />
      <Blob
        color="rgba(253,186,116,0.35)"
        size="40vw"
        left="55%"
        top="12%"
        dx={120}
        dy={-100}
        dur={34}
        op={op * 0.85}
      />

      {/* Very subtle grain for depth */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(rgba(0,0,0,0.6) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />
    </div>
  );
}

function Blob({
  color,
  size,
  left,
  top,
  dx,
  dy,
  dur,
  op,
}: {
  color: string;
  size: string;
  left: string;
  top: string;
  dx: number;
  dy: number;
  dur: number;
  op: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left,
        top,
        translateX: "-50%",
        translateY: "-50%",
        background: color,
        filter: "blur(110px)",
        opacity: op,
        willChange: "transform",
      }}
      animate={{
        x: [0, dx, dx * -0.4, 0],
        y: [0, dy, dy * -0.6, dy * 0.3, 0],
      }}
      transition={{
        duration: dur,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "mirror",
      }}
    />
  );
}
