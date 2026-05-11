"use client";

/**
 * Page-wide cinematic ambience for /[locale]/journey/assessment.
 *
 * Tone is intentionally quieter than AdultsAmbience - the assessment is a
 * vulnerable, introspective moment, not a marketing surface. Palette:
 * emerald + sky + indigo (cool, "morning sky / deep water" feel). Particle
 * count and motion are deliberately sparse so the questionnaire stays the
 * focal point.
 *
 * Same structural pattern as AdultsAmbience:
 *  - Pointer-events-none + aria-hidden so it never affects the experience layer.
 *  - Inline rgba colors so the colored glow halo isn't hijacked by the page's
 *    inherited `currentColor`.
 *  - Deterministic particle layout so SSR + hydration agree.
 *  - Keyframes live in a single TOP-LEVEL <style> block. Nested @keyframes
 *    inside CSS-in-JS get silently dropped in some Next.js prod builds, so
 *    we keep them flat at the root of the style tag.
 */

import { useEffect, useMemo, useRef } from "react";

// Alpha tuning round 3: bumped UP from 0.22 (round 1) to 0.55 (round 2)
// to 0.36 here - round 2 was over-corrected ("too solid, too obvious")
// and round 3 is the goldilocks: visible enough to register on a glance
// but transparent enough that the dots feel like room dust catching
// light, not stage spotlights. Glow halo cut harder than the core
// (0.30 → 0.18) so the bloom doesn't overwhelm at the lower core alpha.
const PARTICLE_TINTS = [
  { core: "rgba(16,185,129,0.38)",  glow: "rgba(16,185,129,0.20)"  }, // emerald-500
  { core: "rgba(56,189,248,0.36)",  glow: "rgba(56,189,248,0.18)"  }, // sky-400
  { core: "rgba(99,102,241,0.36)",  glow: "rgba(99,102,241,0.18)"  }, // indigo-500
] as const;

type ParticleSpec = {
  top: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  tintIndex: number;
  driftX: number;
  driftY: number;
  mobileVisible: boolean;
};

function makeParticles(): ParticleSpec[] {
  // 21 particles total - 7 vertical bands × 3 horizontal cols. Earlier
  // 6×2 = 12 produced two clear vertical "lines" of dots that read as
  // a grid; spreading to 3 cols breaks the column illusion and gives
  // visible activity across the full width on phone and desktop alike.
  // Mobile keeps every 3rd (~7 particles), so density on phones is
  // similar to before but distribution is wider.
  const out: ParticleSpec[] = [];
  const tops = [6, 18, 30, 42, 54, 68, 84] as const;
  for (const top of tops) {
    const cols = [16, 50, 84] as const;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const left = ((col + (top % 7) * 1.3 + i * 0.7) % 90) + 4;
      const sizeOpts = [6, 7, 8, 9, 10];
      const size = sizeOpts[(top + i) % sizeOpts.length]!;
      // 12 → 22s loops - perceptibly slower than AdultsAmbience (8-22s)
      // but fast enough that motion registers within a 5-10s glance
      // (the previous 18-32s range made motion imperceptible to users
      // on the page for less than ~30s).
      const duration = 12 + ((top * 2 + i * 5) % 10);
      const delay = ((top * 0.41 + i * 0.83) % 11) - 2;
      const tintIndex = (top + i * 2) % PARTICLE_TINTS.length;
      const angleDeg = (top * 7 + i * 13) % 360;
      const angleRad = (angleDeg * Math.PI) / 180;
      const magnitude = 14 + ((top * 2 + i * 7) % 18);
      const driftX = Math.round(Math.cos(angleRad) * magnitude);
      const driftY = Math.round(Math.sin(angleRad) * magnitude);
      const mobileVisible = out.length % 3 === 0;
      out.push({
        top, left, size, duration, delay, tintIndex,
        driftX, driftY, mobileVisible,
      });
    }
  }
  return out;
}

export function JourneyAmbience() {
  const particles = useMemo(makeParticles, []);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // ── DIAG: logs why nothing is visible. Remove after verification. ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = rootRef.current;
    const cs = el ? window.getComputedStyle(el) : null;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // eslint-disable-next-line no-console
    console.log("[JourneyAmbience] mounted", {
      particleSpecs: particles.length,
      mobileVisibleSpecs: particles.filter((p) => p.mobileVisible).length,
      renderedParticles: el?.querySelectorAll(".mio-j-particle").length,
      renderedFogBlobs: el?.querySelectorAll(".mio-j-fog").length,
      containerRect: el?.getBoundingClientRect(),
      computed: cs
        ? {
            zIndex: cs.zIndex,
            opacity: cs.opacity,
            display: cs.display,
            position: cs.position,
            visibility: cs.visibility,
            overflow: cs.overflow,
          }
        : null,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      prefersReducedMotion: reducedMotion,
    });
  }, [particles]);
  // ───────────────────────────────────────────────────────────────────

  return (
    <div
      ref={rootRef}
      aria-hidden
      data-testid="journey-ambience"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* ── Fog blobs - 4 large, very soft, slow-drifting. Lower alpha than
              AdultsAmbience so they read as ambient atmosphere, not objects. ── */}
      <div
        className="mio-j-fog mio-j-fog-1 absolute -start-[12%] top-[6%] h-[560px] w-[560px] rounded-full blur-[110px]"
        style={{ background: "rgba(16, 185, 129, 0.45)" }}
      />
      <div
        className="mio-j-fog mio-j-fog-2 absolute -end-[10%] top-[-10%] h-[520px] w-[520px] rounded-full blur-[110px]"
        style={{ background: "rgba(56, 189, 248, 0.42)" }}
      />
      <div
        className="mio-j-fog mio-j-fog-3 absolute -start-[14%] top-[58%] h-[480px] w-[480px] rounded-full blur-[120px]"
        style={{ background: "rgba(99, 102, 241, 0.40)" }}
      />
      <div
        className="mio-j-fog mio-j-fog-4 absolute -end-[8%] top-[82%] h-[520px] w-[520px] rounded-full blur-[110px]"
        style={{ background: "rgba(16, 185, 129, 0.38)" }}
      />

      {/* ── Particles - 12 dots, very transparent, drifting slowly. ── */}
      <div className="absolute inset-0">
        {particles.map((p, i) => {
          const tint = PARTICLE_TINTS[p.tintIndex]!;
          const visibilityCls = p.mobileVisible ? "" : " hidden sm:block";
          return (
            <span
              key={i}
              className={`mio-j-particle absolute rounded-full${visibilityCls}`}
              style={{
                top: `${p.top}%`,
                insetInlineStart: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: tint.core,
                boxShadow: `0 0 ${p.size * 3}px ${tint.glow}, 0 0 ${
                  p.size * 6
                }px ${tint.glow}`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                ["--j-drift-x" as never]: `${p.driftX}px`,
                ["--j-drift-y" as never]: `${p.driftY}px`,
              }}
            />
          );
        })}
      </div>

      {/* ── Grain overlay - keeps gradients from banding. ── */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Translate magnitudes bumped to 36-44px (was 14-28px) - at the
               smaller values motion was ≤2px/s and registered as static.
               Durations cut to 18-24s (was 26-34s) so a glance of 5-10s
               actually catches motion. Scales go to 1.08-1.10 in mid-cycle
               for a gentle "breathing" feel. */
            @keyframes mio-j-fog-a {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .55; }
              50%      { transform: translate3d(40px, -22px, 0) scale(1.08); opacity: .85; }
            }
            @keyframes mio-j-fog-b {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .5; }
              50%      { transform: translate3d(-36px, 28px, 0) scale(1.10); opacity: .80; }
            }
            @keyframes mio-j-fog-c {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .45; }
              50%      { transform: translate3d(32px, -20px, 0) scale(1.07); opacity: .75; }
            }
            .mio-j-fog { will-change: transform, opacity; }
            .mio-j-fog-1 { animation: mio-j-fog-a 18s ease-in-out infinite; }
            .mio-j-fog-2 { animation: mio-j-fog-b 21s ease-in-out infinite; animation-delay: -4s; }
            .mio-j-fog-3 { animation: mio-j-fog-c 23s ease-in-out infinite; animation-delay: -9s; }
            .mio-j-fog-4 { animation: mio-j-fog-a 24s ease-in-out infinite; animation-delay: -14s; }

            @keyframes mio-j-particle-drift {
              0%   {
                transform: translate3d(calc(var(--j-drift-x) * 0.5), calc(var(--j-drift-y) * 0.5), 0);
                opacity: 0;
              }
              20%  { opacity: 0.7; }
              50%  {
                transform: translate3d(calc(var(--j-drift-x) * -0.5), calc(var(--j-drift-y) * -0.5), 0);
                opacity: 1;
              }
              80%  { opacity: 0.7; }
              100% {
                transform: translate3d(calc(var(--j-drift-x) * -1), calc(var(--j-drift-y) * -1), 0);
                opacity: 0;
              }
            }
            .mio-j-particle {
              animation-name: mio-j-particle-drift;
              animation-iteration-count: infinite;
              animation-timing-function: ease-in-out;
              will-change: transform, opacity;
            }

            @media (prefers-reduced-motion: reduce) {
              .mio-j-fog, .mio-j-particle { animation: none !important; }
            }
          `,
        }}
      />
    </div>
  );
}
