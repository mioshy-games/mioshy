"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, Sparkles, Star } from "lucide-react";
import { Link } from "@/navigation";
import { Reveal } from "@/components/marketing/Reveal";
import { FloatingParticles } from "@/components/game/FloatingParticles";

export type HeroClassicDarkProps = {
  isHe: boolean;
  /** Full headline - if you want an accent word, wrap it in **bold** and it'll gradient. */
  headline: string;
  sub: string;
  trustBadge?: string | null;
  ctaPrimary: { text: string; href: string };
  ctaSecondary: { text: string; href: string };
  /** Optional url - if unset, a gradient-wheel placeholder is rendered. */
  sideImageUrl?: string | null;
  tagline?: string | null;
  foundedLine?: string | null;
};

/**
 * AnimatedOrb - a drifting blurred colour orb. Mirrors the Blob primitive
 * used by GamePageBackground so the hero's ambient motion reads as part of
 * the same visual family as the wheels page.
 */
function AnimatedOrb({
  size,
  x,
  y,
  color,
  dx,
  dy,
  dur,
  op = 0.8,
  blur = "110px",
  dir = 1,
}: {
  size: string;
  x: string;
  y: string;
  color: string;
  dx: number;
  dy: number;
  dur: number;
  op?: number;
  blur?: string;
  dir?: 1 | -1;
}) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        translateX: "-50%",
        translateY: "-50%",
        background: color,
        filter: `blur(${blur})`,
        opacity: op,
        willChange: "transform",
      }}
      animate={{
        x: [0, dx * dir, dx * dir * -0.6, 0],
        y: [0, dy, dy * -0.7, dy * 0.3, 0],
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

/**
 * ConvergingOrb - paired drifting orb. Two of these (side="left" and
 * side="right") slowly travel toward each other near the centre and back,
 * creating a "purple meets red" attraction effect. Both share the same
 * duration so the convergence stays in phase.
 */
function ConvergingOrb({
  side,
  size,
  x,
  y,
  color,
  blur,
}: {
  side: "left" | "right";
  size: string;
  x: string;
  y: string;
  color: string;
  blur: string;
}) {
  const sign = side === "left" ? 1 : -1; // left orb moves right, right orb moves left
  const travelX = 320 * sign;
  const travelY = side === "left" ? 80 : -80;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        translateX: "-50%",
        translateY: "-50%",
        background: color,
        filter: `blur(${blur})`,
        willChange: "transform",
      }}
      animate={{
        x: [0, travelX * 0.5, travelX, travelX * 0.5, 0],
        y: [0, travelY * 0.6, travelY, travelY * 0.6, 0],
        scale: [1, 1.06, 1.15, 1.06, 1],
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

/**
 * "Classic dark" hero - revival of the a0f6258 split layout:
 * - Deep purple/rose radial-gradient background
 * - Three animated drifting blobs (same FX family as the game wheels page)
 * - FloatingParticles layer (small drifting dots, colour-derived from
 *   the hero's purple base so they read as part of the game world)
 * - Scanline texture + vignette for the gaming-cabinet feel
 * - Copy column on start side, rotating wheel art on end side
 */
export function HeroClassicDark({
  isHe,
  headline,
  sub,
  trustBadge,
  ctaPrimary,
  ctaSecondary,
  sideImageUrl,
  tagline,
  foundedLine,
}: HeroClassicDarkProps) {
  useEffect(() => {
    console.log("[HeroClassicDark] mounted v2 - orbs converge/diverge + particles");
  }, []);

  return (
    <section
      className="noise-overlay relative isolate overflow-hidden bg-[#0d0a14] text-white"
      dir={isHe ? "rtl" : "ltr"}
    >
      {/* Warm gradient background */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(900px_circle_at_25%_20%,#3b0764,transparent_60%),radial-gradient(700px_circle_at_75%_30%,rgba(251,113,133,0.18),transparent_55%),radial-gradient(1200px_circle_at_50%_80%,#1a0a2e,transparent_70%),linear-gradient(180deg,#0d0a14,rgba(13,10,20,0.85),#0d0a14)]" />

      {/* ── Purple ↔ Red converging pair (slow attraction, mirrored) ───── */}
      <ConvergingOrb
        side="left"
        size="80vw"
        x="22%"
        y="42%"
        color="rgba(139,92,246,0.55)"
        blur="130px"
      />
      <ConvergingOrb
        side="right"
        size="72vw"
        x="78%"
        y="55%"
        color="rgba(244,63,94,0.48)"
        blur="120px"
      />

      {/* ── Secondary drifting orbs (ambient depth) ────────────────────── */}
      <AnimatedOrb
        size="55vw"
        x="45%"
        y="15%"
        color="rgba(217,70,239,0.32)"
        dx={180}
        dy={240}
        dur={30}
        op={0.55}
        blur="120px"
        dir={1}
      />
      <AnimatedOrb
        size="40vw"
        x="85%"
        y="85%"
        color="rgba(251,113,133,0.30)"
        dx={200}
        dy={-160}
        dur={24}
        op={0.5}
        blur="110px"
        dir={-1}
      />

      {/* ── Floating dot particles - same component the wheels page uses ─ */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        <FloatingParticles
          settings={{
            enabled: true,
            count: 36,
            shape: "circle",
            opacity: 0.85,
            speed: 3,
            sizeMin: 4,
            sizeMax: 12,
          }}
          bgSettings={{ type: "color", color: "#8b5cf6" }}
        />
      </div>

      {/* Subtle scanlines - gaming-cabinet texture, identical to GamePageBackground. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 5px)",
        }}
      />

      {/* Vignette - pulls the eye to centre without darkening copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[86dvh] max-w-6xl flex-col justify-center gap-12 px-4 py-20 lg:flex-row lg:items-center">
        {/* Copy column */}
        <div className="relative z-10 max-w-2xl lg:flex-1">
          {trustBadge ? (
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/25 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur-md">
                <Star className="h-4 w-4 text-rose-400" />
                <span>{trustBadge}</span>
              </div>
            </Reveal>
          ) : null}

          <Reveal delay={0.04}>
            <h1 className="mt-8 font-heading text-balance text-5xl font-bold leading-[1.08] tracking-tight sm:text-7xl lg:text-8xl">
              <span className="bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                {headline}
              </span>
            </h1>
          </Reveal>

          <Reveal delay={0.07}>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-white/80 sm:text-xl">
              {sub}
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={ctaPrimary.href}
                className="group inline-flex min-h-[56px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-fuchsia-500/30 transition hover:brightness-110 sm:min-w-[240px]"
              >
                {ctaPrimary.text}
                <ArrowRight
                  className={`ms-2 h-5 w-5 transition group-hover:translate-x-1 ${
                    isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                  }`}
                />
              </Link>
              <Link
                href={ctaSecondary.href}
                className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-purple-400/30 bg-purple-500/10 px-8 py-4 text-base font-semibold text-white/90 backdrop-blur-md transition hover:border-purple-400/50 hover:bg-purple-500/20 sm:min-w-[220px]"
              >
                {ctaSecondary.text}
                <ChevronDown className="ms-2 h-5 w-5 opacity-80" />
              </Link>
            </div>
          </Reveal>

          {(tagline || foundedLine) ? (
            <Reveal delay={0.12}>
              <div className="mt-10 flex flex-wrap gap-2 text-sm text-white/70">
                {tagline ? (
                  <span className="rounded-full border border-purple-500/20 bg-white/5 px-4 py-2 backdrop-blur-md">
                    {tagline}
                  </span>
                ) : null}
                {foundedLine ? (
                  <span className="rounded-full border border-purple-500/20 bg-white/5 px-4 py-2 backdrop-blur-md">
                    {foundedLine}
                  </span>
                ) : null}
              </div>
            </Reveal>
          ) : null}
        </div>

        {/* Visual column - rotating wheel art */}
        <Reveal delay={0.15} className="relative z-10 mt-12 lg:mt-0 lg:flex-1">
          <div className="mx-auto flex max-w-md items-center justify-center lg:max-w-none">
            <div className="relative">
              {/* Glow behind the wheel */}
              <div
                aria-hidden
                className="absolute inset-0 -z-10 scale-125 rounded-full bg-[radial-gradient(circle,rgba(232,121,249,0.20)_0%,rgba(251,113,133,0.10)_50%,transparent_80%)] blur-3xl"
              />
              {sideImageUrl ? (
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                  className="h-[280px] w-[280px] sm:h-[360px] sm:w-[360px] lg:h-[420px] lg:w-[420px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sideImageUrl}
                    alt=""
                    className="h-full w-full rounded-full object-cover shadow-2xl shadow-fuchsia-500/40"
                  />
                </motion.div>
              ) : (
                <WheelArt />
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Pure-CSS/SVG rotating wheel fallback - used when no side image is configured.
 * Conic-gradient disc with 8 romantic-themed sectors, rotating continuously,
 * with a small Sparkles emblem in the middle.
 */
function WheelArt() {
  // 8 evenly spaced sectors of alternating rose / fuchsia / purple / pink
  const sectors = [
    "#f43f5e",
    "#d946ef",
    "#a855f7",
    "#ec4899",
    "#f43f5e",
    "#d946ef",
    "#a855f7",
    "#ec4899",
  ];
  const stops = sectors
    .map((c, i) => `${c} ${(i * 360) / sectors.length}deg ${((i + 1) * 360) / sectors.length}deg`)
    .join(", ");

  return (
    <div className="relative h-[280px] w-[280px] sm:h-[360px] sm:w-[360px] lg:h-[420px] lg:w-[420px]">
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="h-full w-full rounded-full shadow-2xl shadow-fuchsia-500/40 ring-4 ring-white/10"
        style={{ backgroundImage: `conic-gradient(${stops})` }}
      />
      {/* Inner dark disc with emblem */}
      <div className="pointer-events-none absolute inset-[22%] flex items-center justify-center rounded-full bg-gradient-to-br from-[#1a0a2e] via-[#0d0a14] to-[#3b0764] shadow-inner ring-2 ring-white/15">
        <div className="text-center">
          <Sparkles className="mx-auto h-10 w-10 text-fuchsia-300" />
          <p className="mt-2 text-xs font-semibold tracking-[0.3em] text-white/70">
            MIOSHY
          </p>
        </div>
      </div>
      {/* Pointer pip at the top (non-rotating) */}
      <div className="pointer-events-none absolute -top-2 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 rounded-sm bg-gradient-to-br from-fuchsia-400 to-pink-500 shadow-md" />
    </div>
  );
}
