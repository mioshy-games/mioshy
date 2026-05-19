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
  /** Horizontal wander in px (signed - negative = left, positive = right). */
  driftX: number;
  /** Vertical wander in px (signed - negative = up, positive = down). */
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
  // Perf 2026-05-17 — reduced from 11 bands × 5 cols = 55 dots to
  // 6 bands × 5 cols = 30 dots. Each dot carries an inline box-shadow
  // halo + continuously-animated transform/opacity, so paint+composite
  // cost scales linearly with count. Halving the count was the second-
  // biggest lever (after blur radius) for the cursor-freeze on /mioshy-sex
  // in Chrome (macOS). Bands are spread roughly evenly so each scroll
  // viewport still has motion. On mobile we render only ~1/3.
  const tops = [8, 24, 40, 56, 72, 88] as const;
  for (const top of tops) {
    // Five horizontal positions, jittered per row so columns never align.
    const cols = [8, 28, 48, 68, 88] as const;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const left = ((col + (top % 11) * 1.7 + i * 0.9) % 94) + 2;
      // Larger sizes - bumped ~50% so dots register as visible "orbs"
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
      // Mobile keeps every 3rd particle - ~18 dots instead of 55.
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
      {/* PERF 2026-05-19 — Tailwind `blur-[45px]` / `blur-[50px]`
          utilities removed from all 6 fog blobs. Solid rgba
          backgrounds replaced with radial-gradients that feather
          via stops (mid stop at ~38%) instead of via a per-frame
          GPU blur shader. Same wine palette, same positions, same
          animation — just no `filter: blur()` cost on every scroll
          or animation tick. Matches the /games and /journey
          rollout from earlier today. */}
      <div
        className="mio-fog mio-fog-1 absolute -start-[10%] top-[5%] h-[640px] w-[640px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(244,63,94,0.55) 0%, rgba(244,63,94,0.26) 38%, rgba(244,63,94,0) 75%)" }}
      />
      {/* mio-fog-2 - pushed significantly up (top:-15% instead of 18%) so
          only the bottom edge of the blob bleeds into the hero zone, and
          it stops dominating the "מה תקבלו" reading area below. Most of
          the blob now sits above the visible viewport, clipped by the
          page wrapper's overflow-hidden. */}
      <div
        className="mio-fog mio-fog-2 absolute -end-[10%] top-[-15%] h-[600px] w-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(217,70,239,0.55) 0%, rgba(217,70,239,0.26) 38%, rgba(217,70,239,0) 75%)" }}
      />
      {/* mio-fog-3 was originally at start-[40%] top-[50%] - dead-centre of
          the page, which read as a "strange purple disc" sitting on top of
          the manifesto text after page load. Moved off-axis to the start-side
          mid-zone, shrunk slightly, and dropped opacity 0.55 → 0.32 so it
          reads as ambient atmosphere rather than a discrete object. */}
      <div
        className="mio-fog mio-fog-3 absolute -start-[15%] top-[42%] h-[460px] w-[460px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(168,85,247,0.32) 0%, rgba(168,85,247,0.15) 38%, rgba(168,85,247,0) 75%)" }}
      />
      <div
        className="mio-fog mio-fog-4 absolute -start-[8%] top-[72%] h-[600px] w-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(236,72,153,0.55) 0%, rgba(236,72,153,0.26) 38%, rgba(236,72,153,0) 75%)" }}
      />
      <div
        className="mio-fog mio-fog-5 absolute -end-[8%] top-[88%] h-[560px] w-[560px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(192,38,211,0.55) 0%, rgba(192,38,211,0.26) 38%, rgba(192,38,211,0) 75%)" }}
      />
      <div
        className="mio-fog mio-fog-6 absolute start-[20%] top-[105%] h-[480px] w-[480px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,0.40) 0%, rgba(251,191,36,0.19) 38%, rgba(251,191,36,0) 75%)" }}
      />

      {/* ── 2. Floating particles ──
          2026-05-19 PERFORMANCE REBUILD — was 55 individual <span>
          elements on desktop (18 on mobile), each with its own CSS
          animation running translate + opacity. The cumulative cost
          on a typical 60Hz session: hundreds of per-frame style
          recalculations, the heaviest single source of jank reported
          on /mioshy-sex.

          New shape: ONE element rendering ~20 dots as a stack of
          radial-gradient stops, with a single transform-only
          animation drifting the whole composition. GPU-compositor
          only, zero per-frame style work. Brightness/palette
          preserved; particle DENSITY reduced from ~55 → ~20, which
          on a near-black backdrop still reads as a generous starfield.

          The `particles` array + makeParticles() + the diagnostic
          useEffect that logs particle counts are intentionally left
          in place for now — they no longer affect rendering but the
          probe logs may still be useful for future investigations. */}
      {/* `.mio-particle-field` removed 2026-05-19 per Itzik —
          floating orbs across the site didn't land. CSS rule kept
          inert in the inline style block for future reuse. The fog
          blobs above stay (they're only 3 elements, very cheap). */}

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
               rises in a uniform column - every dot drifts in its own
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

            /* 2026-05-19 — single-layer particle field. Replaces the
               55-on-desktop / 18-on-mobile <span>.mio-particle DOM tree
               above. One element, 20 radial-gradient dots, ONE
               transform-only animation. Compositor-cheap. */
            /* 2026-05-19 round 2 — sizes 2x, opacity dropped to 0.55
               for the subtle transparency Itzik asked for across all
               orbs surfaces. */
            /* 2026-05-19 round 4 — sizes increased ~3x (was 4-8px,
               now 13-22px) to MATCH the other 4 orbs surfaces. Itzik
               flagged that the orbs weren't visible on /mioshy-sex
               at all. Opacity 0.38 → 0.35, edge sharpened 48% → 35%
               (consistent with all other fields after Itzik's "less
               blur + more transparency" pass). */
            /* 2026-05-19 round 5 — matched to /journey final settings:
               3-stop gradient (solid core 0-40%, transparent 80%) gives
               sharp dots with subtle halo, opacity 0.3. Renders for
               both authed and anonymous users (AdultsAmbience is a
               pure layer with no auth gating, mounted in the page-
               level wrapper). */
            .mio-particle-field {
              pointer-events: none;
              opacity: 0.3;
              background-image:
                radial-gradient(circle 18px at 8%  12%, rgba(244, 63, 94, 0.85) 0%, rgba(244, 63, 94, 0.85) 40%, transparent 80%),
                radial-gradient(circle 14px at 18% 28%, rgba(217, 70, 239, 0.85) 0%, rgba(217, 70, 239, 0.85) 40%, transparent 80%),
                radial-gradient(circle 22px at 30% 8%,  rgba(255,255,255, 0.65) 0%, rgba(255,255,255, 0.65) 40%, transparent 80%),
                radial-gradient(circle 13px at 42% 22%, rgba(251, 191, 36, 0.80) 0%, rgba(251, 191, 36, 0.80) 40%, transparent 80%),
                radial-gradient(circle 17px at 55% 14%, rgba(168, 85, 247, 0.85) 0%, rgba(168, 85, 247, 0.85) 40%, transparent 80%),
                radial-gradient(circle 14px at 70% 32%, rgba(236, 72, 153, 0.85) 0%, rgba(236, 72, 153, 0.85) 40%, transparent 80%),
                radial-gradient(circle 18px at 82% 18%, rgba(192, 38, 211, 0.85) 0%, rgba(192, 38, 211, 0.85) 40%, transparent 80%),
                radial-gradient(circle 21px at 92% 8%,  rgba(244, 63, 94, 0.80) 0%, rgba(244, 63, 94, 0.80) 40%, transparent 80%),
                radial-gradient(circle 14px at 12% 48%, rgba(255,255,255, 0.6) 0%, rgba(255,255,255, 0.6) 40%, transparent 80%),
                radial-gradient(circle 17px at 26% 62%, rgba(217, 70, 239, 0.85) 0%, rgba(217, 70, 239, 0.85) 40%, transparent 80%),
                radial-gradient(circle 18px at 40% 54%, rgba(168, 85, 247, 0.85) 0%, rgba(168, 85, 247, 0.85) 40%, transparent 80%),
                radial-gradient(circle 13px at 54% 72%, rgba(244, 63, 94, 0.80) 0%, rgba(244, 63, 94, 0.80) 40%, transparent 80%),
                radial-gradient(circle 22px at 68% 60%, rgba(236, 72, 153, 0.85) 0%, rgba(236, 72, 153, 0.85) 40%, transparent 80%),
                radial-gradient(circle 14px at 82% 76%, rgba(192, 38, 211, 0.80) 0%, rgba(192, 38, 211, 0.80) 40%, transparent 80%),
                radial-gradient(circle 17px at 94% 56%, rgba(255,255,255, 0.55) 0%, rgba(255,255,255, 0.55) 40%, transparent 80%),
                radial-gradient(circle 13px at 16% 86%, rgba(251, 191, 36, 0.75) 0%, rgba(251, 191, 36, 0.75) 40%, transparent 80%),
                radial-gradient(circle 18px at 36% 92%, rgba(217, 70, 239, 0.80) 0%, rgba(217, 70, 239, 0.80) 40%, transparent 80%),
                radial-gradient(circle 14px at 58% 88%, rgba(168, 85, 247, 0.80) 0%, rgba(168, 85, 247, 0.80) 40%, transparent 80%),
                radial-gradient(circle 18px at 76% 94%, rgba(244, 63, 94, 0.80) 0%, rgba(244, 63, 94, 0.80) 40%, transparent 80%),
                radial-gradient(circle 13px at 88% 86%, rgba(236, 72, 153, 0.75) 0%, rgba(236, 72, 153, 0.75) 40%, transparent 80%);
              background-size: 100% 100%;
              background-repeat: no-repeat;
              animation: mio-particle-field-drift 28s ease-in-out infinite;
              will-change: transform;
            }
            @keyframes mio-particle-field-drift {
              0%, 100% { transform: translate3d(0, 0, 0); }
              33%      { transform: translate3d(2%, -2%, 0); }
              66%      { transform: translate3d(-2%, 2%, 0); }
            }

            @media (prefers-reduced-motion: reduce) {
              .mio-fog, .mio-particle, .mio-particle-field { animation: none !important; }
            }
          `,
        }}
      />
    </div>
  );
}
