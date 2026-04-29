"use client";

/**
 * PlayAmbience — dark mood lighting specifically tuned for the post-
 * purchase /adults/[slug]/play surface.
 *
 * Why a separate component (not just AdultsAmbience)
 * ───────────────────────────────────────────────────
 * The marketing /adults page uses a rose / fuchsia / amber / violet
 * palette — "after-dark sensual" but warm. This play surface is the
 * actual game space — we lean into a him/her duality with deep BLUE
 * and deep RED fog blobs that drift across the page, separated by a
 * neutral violet midline. The colour story doubles as a visual cue
 * for the role markers used inside the content (blue = his prompts,
 * red = hers).
 *
 * Layered motion:
 *   1. Six drifting fog blobs (alternating blue / red / violet, each
 *      with its own duration and delay so they never sync).
 *   2. ~70 floating particles in a matching palette (rose, blue,
 *      violet, white) sprinkled top→bottom, drifting + fading.
 *   3. Subtle radial-grain overlay so gradients never band.
 *
 * Pure CSS keyframes, deterministic positions, honours
 * prefers-reduced-motion.
 */

import { useEffect, useMemo, useRef } from "react";

const PARTICLE_TINTS = [
  { core: "rgba(253,164,175,0.95)", glow: "rgba(253,164,175,0.75)" }, // rose
  { core: "rgba(125,211,252,0.95)", glow: "rgba(125,211,252,0.75)" }, // sky
  { core: "rgba(196,181,253,0.90)", glow: "rgba(196,181,253,0.65)" }, // violet
  { core: "rgba(248,113,113,0.90)", glow: "rgba(248,113,113,0.65)" }, // red
  { core: "rgba(147,197,253,0.90)", glow: "rgba(147,197,253,0.65)" }, // blue
  { core: "rgba(255,255,255,0.85)", glow: "rgba(255,255,255,0.55)" }, // white spark
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

function makeParticles(): ParticleSpec[] {
  const out: ParticleSpec[] = [];
  // 14 vertical bands × 5 horizontal columns = 70 particles.
  const tops = [4, 11, 18, 25, 32, 39, 46, 53, 60, 67, 74, 81, 88, 95] as const;
  for (const top of tops) {
    const cols = [9, 28, 47, 65, 86] as const;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i]!;
      const left = ((col + (top % 11) * 1.3 + i * 0.7) % 94) + 2;
      const sizeOpts = [4, 4, 5, 5, 6, 7];
      const size = sizeOpts[(top + i) % sizeOpts.length]!;
      const duration = 9 + ((top * 2 + i * 5) % 14); // 9 → 22s
      const delay = ((top * 0.41 + i * 0.83) % 9) - 1.5;
      const tintIndex = (top + i * 3) % PARTICLE_TINTS.length;
      const drift = 18 + ((top * 2 + i * 7) % 22); // 18 → 40px
      out.push({ top, left, size, duration, delay, tintIndex, drift });
    }
  }
  return out;
}

export function PlayAmbience() {
  const particles = useMemo(makeParticles, []);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Single mount log — confirms render on dev. Cheap to leave; can be
  // removed once we trust the layer.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line no-console
    console.log("[PlayAmbience] mounted", {
      particles: particles.length,
      tints: PARTICLE_TINTS.length,
      containerRect: rootRef.current?.getBoundingClientRect(),
    });
  }, [particles]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* ── 1. Drifting fog blobs — blue + red duality ── */}
      <div className="mio-pf mio-pf-1 absolute -start-[10%] top-[3%] h-[680px] w-[680px] rounded-full bg-[rgba(37,99,235,0.32)] blur-[120px]" />
      <div className="mio-pf mio-pf-2 absolute -end-[10%] top-[15%] h-[640px] w-[640px] rounded-full bg-[rgba(220,38,38,0.30)] blur-[120px]" />
      <div className="mio-pf mio-pf-3 absolute start-[35%] top-[40%] h-[540px] w-[540px] rounded-full bg-[rgba(124,58,237,0.32)] blur-[130px]" />
      <div className="mio-pf mio-pf-4 absolute -start-[6%] top-[60%] h-[620px] w-[620px] rounded-full bg-[rgba(29,78,216,0.30)] blur-[130px]" />
      <div className="mio-pf mio-pf-5 absolute -end-[8%] top-[78%] h-[580px] w-[580px] rounded-full bg-[rgba(185,28,28,0.32)] blur-[130px]" />
      <div className="mio-pf mio-pf-6 absolute start-[20%] top-[100%] h-[480px] w-[480px] rounded-full bg-[rgba(91,33,182,0.30)] blur-[140px]" />

      {/* ── 2. Floating particles ── */}
      <div className="absolute inset-0">
        {particles.map((p, i) => {
          const tint = PARTICLE_TINTS[p.tintIndex]!;
          return (
            <span
              key={i}
              className="mio-pp absolute rounded-full"
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
                ["--drift" as never]: `${p.drift}px`,
              }}
            />
          );
        })}
      </div>

      {/* ── 3. Grain overlay ── */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes mio-pf-a {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .55; }
              50%      { transform: translate3d(45px, -25px, 0) scale(1.1); opacity: .85; }
            }
            @keyframes mio-pf-b {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .55; }
              50%      { transform: translate3d(-35px, 30px, 0) scale(1.12); opacity: .85; }
            }
            @keyframes mio-pf-c {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: .50; }
              50%      { transform: translate3d(30px, -22px, 0) scale(1.08); opacity: .80; }
            }
            .mio-pf { will-change: transform, opacity; }
            .mio-pf-1 { animation: mio-pf-a 16s ease-in-out infinite; }
            .mio-pf-2 { animation: mio-pf-b 18s ease-in-out infinite; animation-delay: -3s; }
            .mio-pf-3 { animation: mio-pf-c 20s ease-in-out infinite; animation-delay: -7s; }
            .mio-pf-4 { animation: mio-pf-a 22s ease-in-out infinite; animation-delay: -10s; }
            .mio-pf-5 { animation: mio-pf-b 24s ease-in-out infinite; animation-delay: -5s; }
            .mio-pf-6 { animation: mio-pf-c 26s ease-in-out infinite; animation-delay: -12s; }

            @keyframes mio-pp-drift {
              0%   { transform: translate3d(0, calc(var(--drift) * 0.5), 0); opacity: 0; }
              15%  { opacity: 0.85; }
              50%  { transform: translate3d(0, calc(var(--drift) * -0.5), 0); opacity: 1; }
              85%  { opacity: 0.85; }
              100% { transform: translate3d(0, calc(var(--drift) * -1), 0); opacity: 0; }
            }
            .mio-pp {
              animation-name: mio-pp-drift;
              animation-iteration-count: infinite;
              animation-timing-function: ease-in-out;
              will-change: transform, opacity;
            }
            @media (prefers-reduced-motion: reduce) {
              .mio-pf, .mio-pp { animation: none !important; }
            }
          `,
        }}
      />
    </div>
  );
}
