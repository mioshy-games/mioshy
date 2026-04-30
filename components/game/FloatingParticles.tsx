"use client";

/**
 * FloatingParticles
 *
 * Renders animated particles over the game-page background.
 * Colors are auto-derived from the current background palette so they always
 * feel harmonious - no manual color picking needed.
 *
 * Controlled by ParticlesSettings (from GameSettings.particles).
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { BackgroundSettings, ParticlesSettings } from "@/lib/types/settings";
import { DEFAULT_PARTICLES } from "@/lib/settings-defaults";

// ─────────────────────────────────────────────────────────────────────────────
// Color derivation (mirrors GamePageBackground palette logic)
// ─────────────────────────────────────────────────────────────────────────────

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

function hslString(h: number, s: number, l: number, a: number): string {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

/**
 * Returns 3 HSLA strings for particles, derived from the background base hex.
 * We bump saturation/lightness so the dots are visible against dark backgrounds.
 */
function deriveParticleColors(hex: string, opacity: number): [string, string, string] {
  try {
    const [h] = hexToHsl(hex);
    return [
      hslString(h,            90, 72, opacity),
      hslString((h + 150) % 360, 85, 68, opacity * 0.85),
      hslString((h + 45)  % 360, 88, 65, opacity * 0.7),
    ];
  } catch {
    return [
      `rgba(192,132,252,${opacity})`,
      `rgba(251,113,133,${opacity * 0.85})`,
      `rgba(96,165,250,${opacity * 0.7})`,
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Particle shape clip paths
// ─────────────────────────────────────────────────────────────────────────────

function shapeStyles(shape: ParticlesSettings["shape"]): React.CSSProperties {
  switch (shape) {
    case "square":
      return { borderRadius: "3px" };
    case "star":
      return { clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" };
    case "diamond":
      return { clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", borderRadius: "0" };
    default: // circle
      return { borderRadius: "50%" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic data generation (seeded by index so SSR == client)
// ─────────────────────────────────────────────────────────────────────────────

type ParticleData = {
  left: number;
  top: number;
  size: number;
  color: string;
  /** framer-motion animate target: x travel, y travel */
  dx: number;
  dy: number;
  dur: number;
  delay: number;
};

function buildParticles(
  count: number,
  sizeMin: number,
  sizeMax: number,
  colors: [string, string, string],
  speed: number,
): ParticleData[] {
  const sizeRange = Math.max(1, sizeMax - sizeMin);
  // Base duration inversely proportional to speed (speed 1→slow, 10→fast)
  const baseDur = 14 - speed * 1.1;  // speed=1 → ~12.9s, speed=10 → ~3s

  return Array.from({ length: count }, (_, i) => {
    // Deterministic pseudo-random spreads using integer arithmetic
    const left  = 3  + ((i * 37 + i * i * 13) % 94);
    const top   = 5  + ((i * 53 + i * 7 + 17) % 88);
    const size  = sizeMin + ((i * 7 + 3) % sizeRange) + 1;

    // Direction pattern: cycle through 4 quadrants so particles spread in all directions
    const sector = i % 8;
    const magnitude = 20 + (i % 3) * 14;
    let dx = 0, dy = 0;
    switch (sector) {
      case 0: dy = -magnitude; break;                          // straight up
      case 1: dx =  magnitude; dy = -magnitude * 0.6; break;  // up-right
      case 2: dx =  magnitude; break;                          // right
      case 3: dx =  magnitude; dy =  magnitude * 0.6; break;  // down-right
      case 4: dy =  magnitude; break;                          // straight down
      case 5: dx = -magnitude; dy =  magnitude * 0.6; break;  // down-left
      case 6: dx = -magnitude; break;                          // left
      case 7: dx = -magnitude; dy = -magnitude * 0.6; break;  // up-left
    }

    return {
      left,
      top,
      size,
      color: colors[i % 3],
      dx,
      dy,
      dur:   baseDur + (i * 0.5) % 5,
      delay: (i * 0.35) % 4,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Single particle
// ─────────────────────────────────────────────────────────────────────────────

function Particle({ p, shape }: { p: ParticleData; shape: ParticlesSettings["shape"] }) {
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: `${p.left}%`,
        top:  `${p.top}%`,
        width:  `${p.size}px`,
        height: `${p.size}px`,
        background: p.color,
        willChange: "transform, opacity",
        ...shapeStyles(shape),
      }}
      animate={{
        x: [0, p.dx, p.dx * -0.5, 0],
        y: [0, p.dy, p.dy * -0.7, p.dy * 0.3, 0],
        opacity: [0.25, 0.9, 0.4, 0.9, 0.25],
      }}
      transition={{
        duration: p.dur,
        repeat: Infinity,
        ease: "easeInOut",
        delay: p.delay,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

interface FloatingParticlesProps {
  settings?: ParticlesSettings | null;
  bgSettings?: BackgroundSettings | null;
}

export function FloatingParticles({ settings, bgSettings }: FloatingParticlesProps) {
  const cfg = { ...DEFAULT_PARTICLES, ...(settings ?? {}) };

  // Resolve base hex from background
  const baseHex = useMemo(() => {
    if (bgSettings?.type === "gradient" && bgSettings.gradient?.from) return bgSettings.gradient.from;
    if (bgSettings?.type === "color" && bgSettings.color) return bgSettings.color;
    return "#8800ff";
  }, [bgSettings]);

  const colors = useMemo(
    () => deriveParticleColors(baseHex, cfg.opacity),
    [baseHex, cfg.opacity],
  );

  const particles = useMemo(
    () =>
      cfg.enabled && cfg.count > 0
        ? buildParticles(cfg.count, cfg.sizeMin, cfg.sizeMax, colors, cfg.speed)
        : [],
    [cfg.enabled, cfg.count, cfg.sizeMin, cfg.sizeMax, colors, cfg.speed],
  );

  if (!cfg.enabled || cfg.count <= 0) return null;

  return (
    <>
      {particles.map((p, i) => (
        <Particle key={i} p={p} shape={cfg.shape} />
      ))}
    </>
  );
}
