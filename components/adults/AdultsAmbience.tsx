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
// Alphas pulled down ~25-30% per round of design feedback so dots feel
// like room dust catching ambient light instead of stage spotlights.
const PARTICLE_TINTS = [
  { core: "rgba(253,164,175,0.30)", glow: "rgba(253,164,175,0.15)" }, // rose-300
  { core: "rgba(251,113,133,0.28)", glow: "rgba(251,113,133,0.13)" }, // rose-400
  { core: "rgba(240,171,252,0.28)", glow: "rgba(240,171,252,0.13)" }, // fuchsia-300
  { core: "rgba(232,121,249,0.26)", glow: "rgba(232,121,249,0.12)" }, // fuchsia-400
  { core: "rgba(253,224,71,0.28)",  glow: "rgba(253,224,71,0.13)"  }, // amber-200
  { core: "rgba(196,181,253,0.26)", glow: "rgba(196,181,253,0.12)" }, // violet-300
  { core: "rgba(249,168,212,0.28)", glow: "rgba(249,168,212,0.13)" }, // pink-300
] as const;

type ParticleSpec = {
  top: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  tintIndex: number;
  /** Horizontal wander in px (signed — negative = left, positive = right). */
  driftX: number;
  /** Vertical wander in px (signed — negative = up, positive = down). */
  driftY: number;
  /** Whether this particle should also render on mobile (<sm). 1/3 do. */
  mobileVisible: boolean;
};

// Deterministic "spread" - looks random but is reproducible, so the SSR
// HTML and the hydrated DOM match exactly.
function makeParticles(): ParticleSpec[] {
  // Hand-tuned positions - covers the page top→bottom in a balanced spray.
  // Density is intentionally high so EVERY section visibly has particles
  // drifting through it as the user scrolls.
  const out: ParticleSpec[] = [];
  // 11 vertical bands × 5 particles each = 55 particles spread page-wide.
  // On mobile we render only ~1/3 (every 3rd) — see `mobileVisible` below.
  const tops = [4, 12, 20, 28, 36, 44, 52, 60, 68, 78, 90] as const;
  for (const top of tops) {
    // Five horizontal positions, jittered per row so columns never align.
    const cols = [8, 28, 48, 68, 88] as const;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const left = ((col + (top % 11) * 1.7 + i * 0.9) % 94) + 2;
      // Larger sizes — bumped ~50% so dots register as visible "orbs"
      // rather than pinpricks. Mix kept varied so they don't look uniform.
      const sizeOpts = [6, 7, 8, 9, 10, 11];
      const size = sizeOpts[(top + i) % sizeOpts.length]!;
      // 8 → 22s loops, varied so they never sync up.
      const duration = 8 + ((top * 2 + i * 5) % 15);
      // negative ok = mid-loop start; staggers across the spread.
      const delay = ((top * 0.41 + i * 0.83) % 9) - 1.5;
      const tintIndex = (top + i * 3) % PARTICLE_TINTS.length;
      // Random direction per particle: derive an angle (0–360°) from a
      // deterministic seed, project onto X/Y. Gives every particle its
      // own bearing instead of all rising in a uniform vertical column.
      const angleDeg = (top * 7 + i * 13) % 360;
      const angleRad = (angleDeg * Math.PI) / 180;
      const magnitude = 16 + ((top * 2 + i * 7) % 22);
      const driftX = Math.round(Math.cos(angleRad) * magnitude);
      const driftY = Math.round(Math.sin(angleRad) * magnitude);
      // Mobile keeps every 3rd particle — ~18 dots instead of 55.
      const mobileVisible = out.length % 3 === 0;
      out.push({
        top,
        left,
        size,
        duration,
        delay,
        tintIndex,
        driftX,
        driftY,
        mobileVisible,
      });
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
    const mobileCount = particles.filter((p) => p.mobileVisible).length;
    const directionStats = particles.reduce(
      (acc, p) => {
        if (p.driftY < -2) acc.up++;
        else if (p.driftY > 2) acc.down++;
        else acc.lateral++;
        if (p.driftX < -2) acc.leftish++;
        else if (p.driftX > 2) acc.rightish++;
        return acc;
      },
      { up: 0, down: 0, lateral: 0, leftish: 0, rightish: 0 },
    );
    // eslint-disable-next-line no-console
    console.log("[AdultsAmbience] mounted", {
      particles: particles.length,
      mobileVisible: mobileCount,
      desktopOnly: particles.length - mobileCount,
      tints: PARTICLE_TINTS.length,
      directionStats,
      containerRect: el?.getBoundingClientRect(),
      viewportWidth: window.innerWidth,
      // First couple particles' computed inline styles, for sanity-check.
      sampleSpecs: particles.slice(0, 3).map((p) => ({
        top: p.top,
        left: p.left,
        driftX: p.driftX,
        driftY: p.driftY,
        size: p.size,
        mobileVisible: p.mobileVisible,
      })),
    });
    // Log fog blob bounding rects so we can verify they actually paint
    // visible regions and aren't clipped to zero by an unexpected ancestor.
    const fogs = el?.querySelectorAll(".mio-fog");
    if (fogs) {
      // eslint-disable-next-line no-console
      console.log(
        "[AdultsAmbience] fog blobs:",
        Array.from(fogs).map((f, i) => ({
          idx: i + 1,
          rect: f.getBoundingClientRect(),
        })),
      );
    }
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
          // Mobile keeps ~1/3 of particles; the rest hide via `hidden sm:block`.
          const visibilityCls = p.mobileVisible ? "" : " hidden sm:block";
          return (
            <span
              key={i}
              className={`mio-particle absolute rounded-full${visibilityCls}`}
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
                // CSS custom props consumed by keyframes for 2D drift —
                // each particle picks its own bearing (X + Y) so they don't
                // all rise vertically.
                ["--drift-x" as never]: `${p.driftX}px`,
                ["--drift-y" as never]: `${p.driftY}px`,
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

            /* Particles: 2D drift (each picks an angle via --drift-x/--drift-y)
               + opacity fade. With per-particle bearings, the swarm no longer
               rises in a uniform column — every dot drifts in its own
               direction. */
            @keyframes mio-particle-drift {
              0%   {
                transform: translate3d(calc(var(--drift-x) * 0.5), calc(var(--drift-y) * 0.5), 0);
                opacity: 0;
              }
              15%  { opacity: 0.85; }
              50%  {
                transform: translate3d(calc(var(--drift-x) * -0.5), calc(var(--drift-y) * -0.5), 0);
                opacity: 1;
              }
              85%  { opacity: 0.85; }
              100% {
                transform: translate3d(calc(var(--drift-x) * -1), calc(var(--drift-y) * -1), 0);
                opacity: 0;
              }
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
