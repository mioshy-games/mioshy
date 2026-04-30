"use client";

/**
 * Premium hero for the /[locale]/games landing page.
 *
 * Distinct visual identity from /adults:
 *   - Palette is cool / electric (indigo → violet → fuchsia → cyan), signalling
 *     playful gaming energy. /adults uses warm rose/amber/violet for intimacy.
 *   - Visual column is a floating "wheel + dice + card" stack - an homage to
 *     the catalogue's wheel and snakes-and-ladders games. /adults uses tilted
 *     glass cards hinting at private conversations.
 *   - Background motion is larger, bouncier (longer travel, shorter duration),
 *     reading as "play" rather than "intimacy".
 */

import { motion } from "framer-motion";
import {
  ArrowRight,
  Gamepad2,
  Heart,
  Infinity as InfinityIcon,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "@/navigation";

type HeroProps = {
  isHe: boolean;
  title: string;
  lede: string;
  ctaPrimary: string;
  ctaPrimaryHref?: string;
  ctaSecondary?: string;
  ctaSecondaryHref?: string;
  badge?: string;
  trust?: { icon: "sparkles" | "heart" | "zap" | "infinity"; label: string }[];
};

export function GamesMarketingHero({
  isHe,
  title,
  lede,
  ctaPrimary,
  ctaPrimaryHref = "#catalogue",
  ctaSecondary,
  ctaSecondaryHref = "#why",
  badge,
  trust,
}: HeroProps) {
  return (
    <section
      dir={isHe ? "rtl" : "ltr"}
      className="relative isolate overflow-hidden"
    >
      {/* Ambient aurora orbs - large, slow, high-blur */}
      <AuroraOrb className="start-[-10%] top-[-10%] h-[520px] w-[520px]" tint="indigo" />
      <AuroraOrb className="end-[-12%] top-[8%] h-[440px] w-[440px]" tint="fuchsia" />
      <AuroraOrb className="bottom-[-15%] start-[20%] h-[420px] w-[420px]" tint="cyan" />

      {/* Subtle grid texture - gaming-console-like */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)",
        }}
      />

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-4 pb-20 pt-16 lg:flex-row lg:items-center lg:gap-10 lg:pt-24">
        {/* Copy column */}
        <div className="relative z-10 max-w-2xl text-center lg:flex-1 lg:text-start">
          {badge ? (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-100 backdrop-blur-md"
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>{badge}</span>
            </motion.div>
          ) : null}

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.05 }}
            className="mt-6 font-heading text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
          >
            <span className="bg-gradient-to-br from-white via-violet-100 to-cyan-200 bg-clip-text text-transparent">
              {title}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
            className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-white/80 sm:text-xl lg:mx-0"
          >
            {lede}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.25 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start"
          >
            <Link
              href={ctaPrimaryHref}
              className="group relative inline-flex min-h-[56px] items-center justify-center overflow-hidden rounded-full px-8 text-base font-semibold text-white shadow-xl shadow-fuchsia-500/30 transition hover:brightness-110"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(110deg,#4f46e5_0%,#7c3aed_30%,#d946ef_60%,#22d3ee_100%)] bg-[length:220%_100%]"
                style={{ animation: "mio-gradient-shift 6s ease-in-out infinite" }}
              />
              <span className="relative z-10 inline-flex items-center">
                {ctaPrimary}
                <ArrowRight
                  className={`ms-2 h-5 w-5 transition group-hover:translate-x-1 ${
                    isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                  }`}
                />
              </span>
            </Link>

            {ctaSecondary ? (
              <Link
                href={ctaSecondaryHref}
                className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 text-base font-semibold text-white/90 backdrop-blur-md transition hover:border-white/35 hover:bg-white/10"
              >
                {ctaSecondary}
              </Link>
            ) : null}
          </motion.div>

          {trust && trust.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
              className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/65 lg:justify-start"
            >
              {trust.map((t, i) => {
                const Icon =
                  t.icon === "heart"    ? Heart :
                  t.icon === "zap"      ? Zap :
                  t.icon === "infinity" ? InfinityIcon :
                                          Sparkles;
                const tint =
                  t.icon === "heart"    ? "text-rose-300" :
                  t.icon === "zap"      ? "text-amber-300" :
                  t.icon === "infinity" ? "text-cyan-300" :
                                          "text-violet-300";
                return (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${tint}`} />
                    {t.label}
                  </span>
                );
              })}
            </motion.div>
          ) : null}
        </div>

        {/* Visual column - spinning wheel + floating dice + cards */}
        <div className="relative z-10 lg:flex-1">
          <FloatingGamingStack isHe={isHe} />
        </div>
      </div>

      {/* Local keyframes - kept inline so the component is drop-in. */}
      <style jsx>{`
        @keyframes mio-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AuroraOrb({
  className,
  tint,
}: {
  className: string;
  tint: "indigo" | "fuchsia" | "cyan";
}) {
  const bg =
    tint === "indigo"
      ? "bg-indigo-600/35"
      : tint === "fuchsia"
        ? "bg-fuchsia-500/30"
        : "bg-cyan-400/25";
  // Slightly different travel / duration per orb so they never sync up.
  const anim =
    tint === "indigo"
      ? { x: [0, 80, -60, 0], y: [0, -60, 40, 0], dur: 22 }
      : tint === "fuchsia"
        ? { x: [0, -70, 50, 0], y: [0, 50, -40, 0], dur: 26 }
        : { x: [0, 60, -80, 0], y: [0, -70, 60, 0], dur: 30 };
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0.45 }}
      animate={{ x: anim.x, y: anim.y, opacity: [0.35, 0.6, 0.35] }}
      transition={{ duration: anim.dur, repeat: Infinity, ease: "easeInOut" }}
      className={`pointer-events-none absolute -z-10 rounded-full blur-[130px] ${bg} ${className}`}
      style={{ willChange: "transform, opacity" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual column - a spinning wheel behind, dice floating top-right,
// and a playing card tilted at bottom. Three elements, three motion patterns.

function FloatingGamingStack({ isHe }: { isHe: boolean }) {
  return (
    <div className="relative mx-auto h-[360px] w-full max-w-md sm:h-[440px] lg:h-[500px]">
      {/* Outer glow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.35),transparent_65%)] blur-2xl"
      />

      {/* Wheel - always spinning */}
      <motion.div
        aria-hidden
        className="absolute start-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, #7c3aed 0deg, #d946ef 60deg, #f59e0b 120deg, #22d3ee 180deg, #4f46e5 240deg, #ec4899 300deg, #7c3aed 360deg)",
          boxShadow:
            "0 30px 80px -20px rgba(124,58,237,0.55), inset 0 0 0 10px rgba(255,255,255,0.08), inset 0 0 60px rgba(0,0,0,0.35)",
          willChange: "transform",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        {/* Inner ring */}
        <div className="absolute inset-[9%] rounded-full bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-black/90 shadow-inner" />
        {/* Hub */}
        <div className="absolute start-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-white via-violet-200 to-cyan-200 shadow-[0_0_30px_rgba(255,255,255,0.7)]" />
        {/* Pointer */}
        <div
          className="absolute start-1/2 top-[-2%] -translate-x-1/2"
          aria-hidden
        >
          <div className="h-8 w-2 -translate-y-1/4 rounded-b-full bg-white shadow-lg shadow-white/50" />
        </div>
      </motion.div>

      {/* Floating dice (top-end) */}
      <motion.div
        className="absolute end-[6%] top-[6%] h-24 w-24 rounded-2xl border border-white/25 bg-gradient-to-br from-white to-slate-200 shadow-2xl shadow-fuchsia-500/30"
        initial={{ y: 0, rotate: -8 }}
        animate={{
          y:      [0, -14, 0, -8, 0],
          rotate: [-8, 6, -4, 10, -8],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <Dice5Face />
      </motion.div>

      {/* Playing card (bottom-start) */}
      <motion.div
        className="absolute bottom-[4%] start-[2%] h-36 w-28 rounded-2xl border border-white/20 p-3 text-white shadow-2xl shadow-indigo-500/30 backdrop-blur-md"
        style={{
          background:
            "linear-gradient(145deg, rgba(76,29,149,0.85), rgba(14,165,233,0.55))",
        }}
        initial={{ y: 0, rotate: -10 }}
        animate={{
          y:      [0, 10, -6, 8, 0],
          rotate: [-10, -6, -12, -8, -10],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        aria-hidden
      >
        <div className="flex items-center justify-between">
          <Heart className="h-4 w-4 fill-rose-400 text-rose-400" />
          <span className="text-xs font-semibold text-white/80">Mioshy</span>
        </div>
        <div className="mt-4 flex h-20 items-center justify-center">
          <Heart className="h-10 w-10 fill-rose-400 text-rose-400 drop-shadow" />
        </div>
        <div className="mt-2 flex justify-end">
          <Heart className="h-4 w-4 rotate-180 fill-rose-400 text-rose-400" />
        </div>
      </motion.div>

      {/* Sparkle chip (top-start) */}
      <motion.div
        className="absolute start-[8%] top-[14%] inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-50 shadow-lg shadow-cyan-400/30 backdrop-blur-md"
        initial={{ y: 0 }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      >
        <Sparkles className="h-3 w-3" />
        <span>{isHe ? "זוגי · בחינם" : "2-player · free"}</span>
      </motion.div>
    </div>
  );
}

function Dice5Face() {
  // 5-pip dice face - positioned as absolute children inside the 24-unit square.
  const dot = "absolute h-3.5 w-3.5 rounded-full bg-slate-900 shadow-inner";
  return (
    <div className="relative h-full w-full">
      <span className={`${dot} start-3 top-3`} />
      <span className={`${dot} end-3 top-3`} />
      <span className={`${dot} start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`} />
      <span className={`${dot} start-3 bottom-3`} />
      <span className={`${dot} end-3 bottom-3`} />
    </div>
  );
}
