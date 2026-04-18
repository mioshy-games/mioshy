"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

type ParticleData = {
  left: string; top: string; width: string; height: string;
  background: string; dur: number; delay: number;
};

function Particle({ p }: { p: ParticleData }) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{
        left: p.left, top: p.top,
        width: p.width, height: p.height,
        background: p.background,
      }}
      animate={{ y: [0, -30, 0], opacity: [0.3, 0.8, 0.3] }}
      transition={{
        duration: p.dur,
        repeat: Infinity,
        ease: "easeInOut",
        delay: p.delay,
      }}
    />
  );
}

const PARTICLES: ParticleData[] = Array.from({ length: 18 }, (_, i) => ({
  left:  `${5 + (i * 37 + i * i * 13) % 90}%`,
  top:   `${10 + (i * 53 + i * 7) % 80}%`,
  width:  `${4 + (i * 7) % 10}px`,
  height: `${4 + (i * 7) % 10}px`,
  background: i % 3 === 0
    ? "rgba(192,132,252,0.6)"
    : i % 3 === 1
    ? "rgba(251,113,133,0.5)"
    : "rgba(96,165,250,0.4)",
  dur:   3 + (i * 0.4),
  delay: i * 0.3,
}));

// Animated blobs
function Blob({ color, size, x, y, dx, dy, dur, blur, op, dir }: {
  color: string; size: string; x: string; y: string;
  dx: number; dy: number; dur: number; blur: string; op: number; dir: 1 | -1;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{
        width: size, height: size, left: x, top: y,
        translateX: "-50%", translateY: "-50%",
        background: color, filter: `blur(${blur})`,
        opacity: op, willChange: "transform",
      }}
      animate={{ x: [0, dx * dir, dx * dir * -0.6, 0], y: [0, dy, dy * -0.7, dy * 0.3, 0] }}
      transition={{ duration: dur, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
    />
  );
}

/**
 * Full-screen game-style dark background with animated blobs + floating
 * particles. Wraps the login / signup pages.
 */
export function AuthBackground({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="relative min-h-[100dvh] w-full overflow-hidden bg-[#06030f]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* ── Animated blobs ── */}
      <Blob color="#7c3aed" size="80vw" x="15%"  y="35%"  dx={280} dy={200} dur={20} blur="120px" op={0.55} dir={1} />
      <Blob color="#db2777" size="65vw" x="75%"  y="60%"  dx={240} dy={280} dur={25} blur="110px" op={0.45} dir={-1} />
      <Blob color="#2563eb" size="50vw" x="50%"  y="10%"  dx={180} dy={320} dur={30} blur="130px" op={0.35} dir={1} />

      {/* ── Scanlines texture ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 5px)`,
        }}
      />

      {/* ── Vignette ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 20%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* ── Floating particles ── */}
      {PARTICLES.map((p, i) => (
        <Particle key={i} p={p} />
      ))}

      {/* ── Content ── */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        {/* Header sits inside the animated background so it blends naturally */}
        <SiteHeader />

        {/* Vertically centered form area */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          {children}
        </main>

        {/* Footer at the bottom of the full-screen layer */}
        <SiteFooter />
      </div>
    </motion.div>
  );
}
