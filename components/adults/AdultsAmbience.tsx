"use client";

/**
 * Page-wide cinematic ambience for /[locale]/adults.
 *
 * UX intent
 * ─────────
 * The /adults surface needs to feel like a single continuous after-dark
 * room - not a stack of black blocks separated by section padding.
 * This component sits behind ALL section content (-z-10) and renders:
 *
 *   1. Drifting colored "fog" blobs - deep crimson + violet + amber, large
 *      and softly blurred, slowly drifting across the page so the dark
 *      plate is never flat. Multiple blobs at staggered durations keep the
 *      lighting from feeling synced.
 *
 *   2. Floating particles - ~80 small dots in rose / fuchsia / amber tints
 *      with vertical drift and fade keyframes. Each dot has its own delay
 *      so the sky always has something moving.
 *
 *   3. A subtle radial-grain noise overlay - keeps gradients from banding
 *      and gives the dark plate skin.
 *
 * Implementation notes
 * ────────────────────
 * - Uses pure CSS keyframes (no framer-motion per dot) - 80 motion components
 *   would add up. Animations live in a single <style> block at the bottom.
 * - All elements are pointer-events-none + aria-hidden so they never affect
 *   the experience layer above them.
 * - The component is `"use client"` because it relies on CSS keyframes and
 *   a pseudo-random particle layout we want stable across renders. We seed
 *   the layout with a deterministic pattern so SSR + hydration agree.
 * - Particles use INLINE colored backgrounds + box-shadow so the colored
 *   glow halo can't be hijacked by an inherited `currentColor` (the page
 *   wrapper has `text-white`, which would cause `box-shadow: currentColor`
 *   to render as a WHITE glow instead of the intended rose/fuchsia/amber).
 */

import { useEffect, useMemo, useRef } from "react";

// Particle tints - explicit RGBA so the inline `box-shadow` glow uses the
// intended hue and is NOT coerced to white via inherited `currentColor`.
// `core` is the dot itself; `glow` is the halo (slightly more transparent).
const PARTICLE_TINTS = [
  { core: "rgba(253,164,175,0.95)", glow: "rgba(253,164,175,0.75)" }, // rose-300
  { core: "rgba(251,113,133,0.90)", glow: "rgba(251,113,133,0.70)" }, // rose-400
  { core: "rgba(240,171,252,0.90)", glow: "rgba(240,171,252,0.70)" }, // fuchsia-300
  { core: "rgba(232,121,249,0.85)", glow: "rgba(232,121,249,0.65)" }, // fuchsia-400
  { core: "rgba(253,224,71,0.90)",  glow: "rgba(253,224,71,0.70)"  }, // amber-200
  { core: "rgba(196,181,253,0.85)", glow: "rgba(196,181,253,0.65)" }, // violet-300
  { core: "rgba(249,168,212,0.90)", glow: "rgba(249,168,212,0.70)" }, // pink-300
] as const;

type ParticleSpec = {
  top: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  tintIndex: number;
  drift: number;
};

// Deterministic "spread" - looks random but is reproducible, so the SSR
// HTML and the hydrated DOM match exactly.
function makeParticles(): ParticleSpec[] {
  // Hand-tuned positions - covers the page top→bottom in a balanced spray.
  // Density is intentionally high so EVERY section visibly has particles
  // drifting through it as the user scrolls.
  const out: ParticleSpec[] = [];
  // 9 vertical bands × 4 particles each = 36 particles spread page-wide.
  // Density was halved (was 80) - felt overwhelming once the fog blobs
  // were visible. 36 dots is enough to register as "always something
  // moving" without competing with the colour layer for attention.
  const tops = [5, 14, 23, 32, 41, 53, 65, 78, 90] as const;
  for (const top of tops) {
    // Four horizontal positions, jittered per row so columns never align.
    const cols = [12, 36, 60, 84] as const;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const left = ((col + (top % 11) * 1.7 + i * 0.9) % 94) + 2;
      // Slightly larger sizes - small dots get lost against blurred fog.
      const sizeOpts = [4, 4, 5, 5, 6, 7];
      const size = sizeOpts[(top + i) % sizeOpts.length]!;
      // 8 → 22s loops, varied so they never sync up.
      const duration = 8 + ((top * 2 + i * 5) % 15);
      // negative ok = mid-loop start; staggers across the spread.
      const delay = ((top * 0.41 + i * 0.83) % 9) - 1.5;
      const tintIndex = (top + i * 3) % PARTICLE_TINTS.length;
      // 16 → 38px vertical wander - bigger drift = more visible motion.
      const drift = 16 + ((top * 2 + i * 7) % 22);
      out.push({ top, left, size, duration, delay, tintIndex, drift });
    }
  }
  return out;
}

export function AdultsAmbience() {
  const particles = useMemo(makeParticles, []);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ── DEBUG INSTRUMENTATION ────────────────────────────────────────────
  // The user reported they don't see floating dots in the hero/background.
  // These logs confirm the component mounted, how many particles were
  // computed, and what the rendered container's actual bounding box is -
  // which is the most common reason particles "disappear" (they end up in
  // a 0-height container, or get clipped by an unexpected ancestor).
  // Remove these logs once visibility is verified.
  useEffect(() => {
    const el = rootRef.current;
    if (typeof window === "undefined") return;
    // eslint-disable-next-line no-console
    console.log("[AdultsAmbience] mounted", {
      particles: particles.length,
      tints: PARTICLE_TINTS.length,
      containerRect: el?.getBoundingClientRect(),
      // First couple particles' computed inline styles, for sanity-check.
      sampleSpecs: particles.slice(0, 3),
    });
  }, [particles]);
  // ────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-testid="adults-ambience"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* ── 1. Drifting fog blobs ──
          Why we DON'T use mix-blend-screen here:
            On a near-black backdrop (#0a0410 ≈ luminance 0.04), screen-
            blending only paints where the blob colour is bright enough
            to lift the dark - and the resulting hue can be hard to
            perceive on a dim or uncalibrated display. Direct compositing
            (no blend mode) at high opacity is GUARANTEED visible because
            it just paints colour over the backdrop.
          Tradeoff: overlapping blobs no longer synthesize "magenta where
          rose meets fuchsia" the way screen-blending does - they just
          stack via alpha. We accept that for guaranteed visibility.
          Inline rgba values (instead of Tailwind utility classes) make
          this immune to JIT-cache hiccups during dev Fast Refresh. */}
      <div
        className="mio-fog mio-fog-1 absolute -start-[10%] top-[5%] h-[640px] w-[640px] rounded-full blur-[100px]"
        style={{ background: "rgba(244, 63, 94, 0.55)" }}
      />
      {/* mio-fog-2 - pushed significantly up (top:-15% instead of 18%) so
          only the bottom edge of the blob bleeds into the hero zone, and
          it stops dominating the "מה תקבלו" reading area below. Most of
          the blob now sits above the visible viewport, clipped by the
          page wrapper's overflow-hidden. */}
      <div
        className="mio-fog mio-fog-2 absolute -end-[10%] top-[-15%] h-[600px] w-[600px] rounded-full blur-[100px]"
        style={{ background: "rgba(217, 70, 239, 0.55)" }}
      />
      {/* mio-fog-3 was originally at start-[40%] top-[50%] - dead-centre of
          the page, which read as a "strange purple disc" sitting on top of
          the manifesto text after page load. Moved off-axis to the start-side
          mid-zone, shrunk slightly, and dropped opacity 0.55 → 0.32 so it
          reads as ambient atmosphere rather than a discrete object. */}
      <div
        className="mio-fog mio-fog-3 absolute -start-[15%] top-[42%] h-[460px] w-[460px] rounded-full blur-[120px]"
        style={{ background: "rgba(168, 85, 247, 0.32)" }}
      />
      <div
        className="mio-fog mio-fog-4 absolute -start-[8%] top-[72%] h-[600px] w-[600px] rounded-full blur-[100px]"
        style={{ background: "rgba(236, 72, 153, 0.55)" }}
      />
      <div
        className="mio-fog mio-fog-5 absolute -end-[8%] top-[88%] h-[560px] w-[560px] rounded-full blur-[110px]"
        style={{ background: "rgba(192, 38, 211, 0.55)" }}
      />
      <div
        className="mio-fog mio-fog-6 absolute start-[20%] top-[105%] h-[480px] w-[480px] rounded-full blur-[110px]"
        style={{ background: "rgba(251, 191, 36, 0.40)" }}
      />

      {/* ── 2. Floating particles - inline styled so the colored glow
              halo isn't hijacked by the page's `text-white` currentColor. ── */}
      <div className="absolute inset-0" data-testid="adults-particle-layer">
        {particles.map((p, i) => {
          const tint = PARTICLE_TINTS[p.tintIndex]!;
          return (
            <span
              key={i}
              className="mio-particle absolute rounded-full"
              style={{
                top: `${p.top}%`,
                insetInlineStart: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: tint.core,
                // Layered glow: tight tinted halo + wider soft spread.
                boxShadow: `0 0 ${p.size * 3}px ${tint.glow}, 0 0 ${
                  p.size * 6
                }px ${tint.glow}`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                // CSS custom prop consumed by keyframes for individual drift.
                ["--drift" as never]: `${p.drift}px`,
              }}
            />
          );
        })}
      </div>

      {/* ── 3. Grain overlay - keeps gradients from banding ── */}
      <div
        className="absolute inset-0 opacity-[0.065] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Fog blobs: large, slow, lateral + vertical drift, breathing scale + opacity. */
            @keyframes mio-fog-drift-a {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .55; }
              50%      { transform: translate3d(40px, -22px, 0) scale(1.08); opacity: .8; }
            }
            @keyframes mio-fog-drift-b {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .5; }
              50%      { transform: translate3d(-32px, 26px, 0) scale(1.1); opacity: .75; }
            }
            @keyframes mio-fog-drift-c {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .45; }
              50%      { transform: translate3d(28px, -20px, 0) scale(1.05); opacity: .7; }
            }
            .mio-fog { will-change: transform, opacity; }
            .mio-fog-1 { animation: mio-fog-drift-a 16s ease-in-out infinite; }
            .mio-fog-2 { animation: mio-fog-drift-b 18s ease-in-out infinite; animation-delay: -3s; }
            .mio-fog-3 { animation: mio-fog-drift-c 20s ease-in-out infinite; animation-delay: -7s; }
            .mio-fog-4 { animation: mio-fog-drift-a 22s ease-in-out infinite; animation-delay: -10s; }
            .mio-fog-5 { animation: mio-fog-drift-b 24s ease-in-out infinite; animation-delay: -5s; }
            .mio-fog-6 { animation: mio-fog-drift-c 26s ease-in-out infinite; animation-delay: -12s; }

            /* Particles: vertical drift + opacity fade. Each picks up its own --drift. */
            @keyframes mio-particle-drift {
              0%   { transform: translate3d(0, calc(var(--drift) * 0.5), 0); opacity: 0; }
              15%  { opacity: 0.85; }
              50%  { transform: translate3d(0, calc(var(--drift) * -0.5), 0); opacity: 1; }
              85%  { opacity: 0.85; }
              100% { transform: translate3d(0, calc(var(--drift) * -1), 0); opacity: 0; }
            }
            .mio-particle {
              animation-name: mio-particle-drift;
              animation-iteration-count: infinite;
              animation-timing-function: ease-in-out;
              will-change: transform, opacity;
            }

            @media (prefers-reduced-motion: reduce) {
              .mio-fog, .mio-particle { animation: none !important; }
            }
          `,
        }}
      />
    </div>
  );
}
