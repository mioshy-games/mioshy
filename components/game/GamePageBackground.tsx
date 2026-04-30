"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { BackgroundSettings, ParticlesSettings } from "@/lib/types/settings";
import { FloatingParticles } from "./FloatingParticles";

// ─── Color utilities ──────────────────────────────────────────────────────────
// Pure functions - no deps - derive a palette from a single hex input

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const hk = h / 360, sk = s / 100, lk = l / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (sk === 0) { r = g = b = lk; }
  else {
    const q = lk < 0.5 ? lk * (1 + sk) : lk + sk - lk * sk;
    const p = 2 * lk - q;
    r = hue2rgb(p, q, hk + 1/3);
    g = hue2rgb(p, q, hk);
    b = hue2rgb(p, q, hk - 1/3);
  }
  return "#" + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

/**
 * Given a hex color from the DB (e.g. "#1a0a2e"), return three vivid blob
 * colours derived from it: primary, split-complementary, and analogous.
 * We always push saturation to ≥85% and lightness to 50-60% so blobs glow.
 */
function derivePalette(hex: string): [string, string, string] {
  try {
    const [h, , ] = hexToHsl(hex);
    const primary   = hslToHex(h,           90, 55);
    const split     = hslToHex((h + 150) % 360, 85, 52);
    const analogous = hslToHex((h + 45)  % 360, 88, 50);
    return [primary, split, analogous];
  } catch {
    return ["#8800ff", "#ff0088", "#0088ff"];
  }
}

// ─── Static fallback themes (used when no bg_value or slug matches) ──────────

const SLUG_THEMES: Record<string, [string, string, string]> = {
  "first-date-spin":     ["#9b00ff", "#ff0099", "#00d4ff"],
  "couple-heart-spin":   ["#ff0050", "#cc0088", "#ff7700"],
  "friends-party-spin":  ["#ffcc00", "#66ff00", "#ff5500"],
  "intimate-sparks-spin":["#0055ff", "#00ddff", "#aa00ff"],
  "couple-renewal-spin": ["#ff9900", "#ff3300", "#ffee00"],
  "better-date-spin":    ["#00ff88", "#00bbff", "#aaff00"],
  "peak-desire-spin":    ["#ff0077", "#cc0033", "#ff44cc"],
  "truth-or-dare":       ["#8800ff", "#dd00ff", "#0099ff"],
  "wheel-of-love":       ["#ff8800", "#ff0044", "#ffdd00"],
  "naughty-or-nice":     ["#0099ff", "#00ffcc", "#ff0099"],
};

// ─── Blob component - GPU-only transform animation ────────────────────────────

type BlobConfig = {
  color: string;
  size: string;
  x: string;
  y: string;
  dx: number;   // horizontal travel px
  dy: number;   // vertical travel px
  dur: number;  // seconds
  blur: string;
  op: number;
};

function Blob({ b, i }: { b: BlobConfig; i: number }) {
  const dir = i % 2 === 0 ? 1 : -1;
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{
        width: b.size,
        height: b.size,
        left: b.x,
        top: b.y,
        translateX: "-50%",
        translateY: "-50%",
        background: b.color,
        filter: `blur(${b.blur})`,
        opacity: b.op,
        willChange: "transform",
      }}
      animate={{
        x: [0, b.dx * dir, b.dx * dir * -0.6, 0],
        y: [0, b.dy, b.dy * -0.7, b.dy * 0.3, 0],
      }}
      transition={{
        duration: b.dur,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "mirror",
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * @param gameSlug   - used as theme key
 * @param primaryColor - hex from game.bg_value in DB (overrides slug theme)
 * @param bgSettings  - from game_settings table; takes priority over primaryColor
 */
export function GamePageBackground({
  gameSlug,
  primaryColor,
  bgSettings,
  particlesSettings,
  children,
  /**
   * Override the default `min-h-[100dvh] w-full overflow-hidden` wrapper
   * class. Use when embedding the backdrop into a contained marketing
   * surface (e.g. a hero "demo wheel" column) instead of the full game page.
   * The inner content wrapper height also adapts when this is provided.
   */
  containerClassName,
}: {
  gameSlug: string;
  primaryColor?: string;
  /** Background settings from GameSettings (takes priority over primaryColor) */
  bgSettings?: BackgroundSettings | null;
  /** Floating particles settings from GameSettings */
  particlesSettings?: ParticlesSettings | null;
  children: ReactNode;
  containerClassName?: string;
}) {
  // ── If bgSettings has an image, render it directly and skip blobs ─────────
  if (bgSettings?.type === "image" && bgSettings.imageUrl) {
    return (
      <div
        className={containerClassName ?? "relative min-h-[100dvh] w-full"}
        style={{
          backgroundImage: `url(${bgSettings.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          className={
            containerClassName
              ? "relative h-full w-full"
              : "relative min-h-[100dvh]"
          }
        >
          {children}
        </div>
      </div>
    );
  }

  // ── Derive the base color for blob palette ────────────────────────────────
  // Priority: bgSettings.gradient.from → bgSettings.color → primaryColor → slug theme
  let baseHex: string | undefined;
  if (bgSettings?.type === "gradient" && bgSettings.gradient?.from) {
    baseHex = bgSettings.gradient.from;
  } else if (bgSettings?.type === "color" && bgSettings.color) {
    baseHex = bgSettings.color;
  } else {
    baseHex = primaryColor;
  }

  // Resolve palette
  const [c1, c2, c3] =
    baseHex && baseHex.startsWith("#") && baseHex.length >= 7
      ? (bgSettings?.type === "gradient" && bgSettings.gradient?.to
          ? [baseHex, bgSettings.gradient.to, derivePalette(baseHex)[2]]
          : derivePalette(baseHex))
      : SLUG_THEMES[gameSlug] ?? ["#8800ff", "#ff0088", "#0088ff"];

  // Solid base - use bgSettings.color for solid, otherwise keep near-black
  const base =
    bgSettings?.type === "color" && bgSettings.color
      ? bgSettings.color
      : "#05030a";

  // Three blobs
  const blobs: BlobConfig[] = [
    { color: c1, size: "90vw",  x: "20%",  y: "40%", dx: 320, dy: 220, dur: 18, blur: "110px", op: 0.80 },
    { color: c2, size: "70vw",  x: "70%",  y: "55%", dx: 280, dy: 260, dur: 22, blur: "100px", op: 0.70 },
    { color: c3, size: "55vw",  x: "45%",  y: "15%", dx: 200, dy: 300, dur: 27, blur: "120px", op: 0.50 },
  ];

  return (
    <motion.div
      className={
        containerClassName ?? "relative min-h-[100dvh] w-full overflow-hidden"
      }
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Solid base */}
      <div className="pointer-events-none absolute inset-0" style={{ background: base }} />

      {/* Animated blobs */}
      {blobs.map((b, i) => <Blob key={i} b={b} i={i} />)}

      {/* Scanlines - light gaming texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 5px)`,
        }}
      />

      {/* Vignette - dark edges push eye to centre */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.80) 100%)",
        }}
      />

      {/* Floating particles */}
      <FloatingParticles settings={particlesSettings} bgSettings={bgSettings} />

      {/* Content */}
      <div
        className={
          containerClassName
            ? "relative h-full w-full"
            : "relative min-h-[100dvh]"
        }
      >
        {children}
      </div>
    </motion.div>
  );
}

// ─── Optional frosted inner container ────────────────────────────────────────

export function GameArea({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-3xl backdrop-blur-md ${className}`}
      style={{
        background: "rgba(0,0,0,0.38)",
        boxShadow: "inset 0 0 80px rgba(255,255,255,0.04), 0 0 0 1px rgba(255,255,255,0.07), 0 8px 40px rgba(0,0,0,0.65)",
      }}
    >
      {children}
    </div>
  );
}
