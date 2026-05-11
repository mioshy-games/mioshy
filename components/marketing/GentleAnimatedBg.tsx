"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { FloatingParticles } from "@/components/game/FloatingParticles";

/**
 * Light-theme animated backdrop. A purple and a red orb slowly drift toward
 * each other near centre and back (synced "attraction"), with small floating
 * circles drifting on top - same particle system the wheels game uses.
 *
 * Designed for `position: absolute; inset-0` placement inside a relatively
 * positioned hero/section.
 */
export function GentleAnimatedBg({
  intensity = "normal",
}: {
  intensity?: "normal" | "soft";
}) {
  const op = intensity === "soft" ? 0.55 : 0.85;

  useEffect(() => {
    console.log("[GentleAnimatedBg] mounted v2 - converge + particles");
  }, []);

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

      {/* Purple ↔ Red converging pair (synced 32s loop) */}
      <ConvergingOrb side="left"  size="65vw" left="20%" top="42%" color="rgba(167,139,250,0.65)" op={op} />
      <ConvergingOrb side="right" size="60vw" left="80%" top="55%" color="rgba(244,63,94,0.55)"   op={op * 0.9} />

      {/* Ambient warm accent (independent, slower) */}
      <Blob
        color="rgba(253,186,116,0.32)"
        size="40vw"
        left="55%"
        top="12%"
        dx={120}
        dy={-100}
        dur={34}
        op={op * 0.7}
      />

      {/* Floating circles - same primitive as the wheels game */}
      <div className="absolute inset-0 z-[1]">
        <FloatingParticles
          settings={{
            enabled: true,
            count: 32,
            shape: "circle",
            opacity: 0.55,
            speed: 3,
            sizeMin: 4,
            sizeMax: 11,
          }}
          bgSettings={{ type: "color", color: "#a78bfa" }}
        />
      </div>

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

function ConvergingOrb({
  side,
  size,
  left,
  top,
  color,
  op,
}: {
  side: "left" | "right";
  size: string;
  left: string;
  top: string;
  color: string;
  op: number;
}) {
  const sign = side === "left" ? 1 : -1;
  const travelX = 320 * sign;
  const travelY = side === "left" ? 70 : -70;
  return (
    <motion.div
      aria-hidden
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
        x: [0, travelX * 0.5, travelX, travelX * 0.5, 0],
        y: [0, travelY * 0.6, travelY, travelY * 0.6, 0],
        scale: [1, 1.06, 1.18, 1.06, 1],
      }}
      transition={{
        duration: 32,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      }}
    />
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
