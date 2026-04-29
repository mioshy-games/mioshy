"use client";

/**
 * Hero for /[locale]/adults — Mioshy's flagship after-dark surface.
 *
 * Composition
 * ───────────
 * - Centre stage: kicker → huge italic-gradient headline → lede → CTA → note.
 *   The closing-CTA's centred drama is the structural spine.
 * - Two TAROT-STYLE poster cards float at the start/end edges of the hero.
 *   They never overlap the centre. They're tilted, drift gently, and act
 *   as atmospheric "preview" hints — not a feature grid.
 * - Each card has a CLEAR, dashed-border image placeholder zone with an
 *   image icon + caption — invites "drop real artwork here" without breaking
 *   the dark aesthetic.
 *
 * Why two cards (not three)
 * ─────────────────────────
 * Three cards forced the third one into the centre, where it competed
 * with — and visually overlapped — the primary CTA. Two cards keep the
 * centre clean and let the headline + CTA breathe.
 */

import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Heart,
  Flame,
  ImageIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "@/navigation";

type Hero = {
  title: string;
  tagline: string;
  singlePrice: string;
  subPrice: string;
  singleEnabled: boolean;
  subEnabled: boolean;
  buyXGetX: { buy: number; get: number }[];
};

export function AdultsMarketingHero({
  isHe,
  hero,
  ctaHref = "#catalogue",
}: {
  isHe: boolean;
  hero: Hero;
  ctaHref?: string;
  /** Kept for backward compat; unused in this minimal hero. */
  secondaryHref?: string;
}) {
  return (
    <section className="relative" dir={isHe ? "rtl" : "ltr"}>
      {/* Hairline gradient rail at the very top — section rhythm. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/40 to-transparent"
      />

      {/* Local concentrated radial behind the headline — focal pool. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(900px 520px at 50% 38%, rgba(244,63,94,0.20), transparent 65%)",
        }}
      />

      {/* Breadcrumb — quiet, away from the headline. */}
      <nav
        aria-label="breadcrumb"
        className="relative z-20 mx-auto flex max-w-6xl items-center gap-2 px-4 pt-8 text-xs text-white/45"
      >
        <Link href="/" className="transition hover:text-white/80">
          {isHe ? "בית" : "Home"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-white/70">
          {isHe ? "למבוגרים בלבד" : "Adults only"}
        </span>
      </nav>

      {/* ── DESKTOP edge cards — two only, brought closer to the headline.
            start/end values bumped from 2% → 8% so the cards read as part
            of the headline cluster, not pinned to the screen edges.
            top values nudged ~30px down so the cards align with the
            headline's vertical centre rather than its top. ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
      >
        {/* Card peek — start (right in RTL) edge */}
        <motion.div
          initial={{ y: 8, rotate: -8 }}
          animate={{ y: [8, -8, 8], rotate: [-8, -6, -8] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[180px] start-[8%] h-[400px] w-[260px]"
        >
          <PosterCard
            tone="violet"
            Icon={Heart}
            level={isHe ? "מרגש" : "Touching"}
            hint={isHe ? "שאלות שמפיגות מרחק" : "Prompts that close distance"}
            placeholderLabel={isHe ? "תמונת המשחק" : "Game artwork"}
          />
        </motion.div>

        {/* Card peek — end (left in RTL) edge, slightly lower & opposite tilt */}
        <motion.div
          initial={{ y: -10, rotate: 8 }}
          animate={{ y: [-10, 10, -10], rotate: [8, 10, 8] }}
          transition={{
            duration: 13,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.7,
          }}
          className="absolute top-[240px] end-[8%] h-[400px] w-[260px]"
        >
          <PosterCard
            tone="rose"
            Icon={Flame}
            level={isHe ? "מעורר" : "Stirring"}
            hint={isHe ? "הזמנות לחוויה משותפת" : "Invitations into play"}
            placeholderLabel={isHe ? "תמונת המשחק" : "Game artwork"}
          />
        </motion.div>
      </div>

      {/* ── CENTRE STAGE — copy + CTA (always clear of the cards) ── */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-20 pt-14 text-center sm:pt-20">
        {/* Tiny flagship + 18+ kicker. */}
        <div className="flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em]">
          <span className="inline-flex items-center gap-1.5 text-rose-200/85">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]" />
            {isHe ? "המוצר הדגל" : "The flagship"}
          </span>
          <span aria-hidden className="h-3 w-px bg-white/15" />
          <span className="text-white/55">
            {isHe ? "למבוגרים בלבד · 18+" : "Adults only · 18+"}
          </span>
        </div>

        {/* The statement. Two lines, second in italic-gradient.
            Wrapped in a relative container so the on-load firework burst
            (HeroFireworks below) can emit sparks from the headline's centre. */}
        <div className="relative mt-9">
          <HeroFireworks />
          <h1
            className="relative z-[1] text-balance text-[44px] leading-[0.98] tracking-[-0.025em] sm:text-[60px] lg:text-[84px]"
            style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
          >
            <span className="block text-white">
              {isHe ? "לילה אחד." : "One night."}
            </span>
            <span
              className="mt-1 block bg-gradient-to-br from-rose-200 via-rose-400 to-amber-300 bg-clip-text text-transparent"
              style={{ fontStyle: "italic", fontWeight: 500 }}
            >
              {isHe ? "אחר לגמרי." : "Like nothing before."}
            </span>
          </h1>
        </div>

        {/* Lede — exactly 4 words. Names the game type, the outcome,
            and implicitly the problem it solves. */}
        <p
          className="mx-auto mt-8 max-w-xl text-pretty text-[20px] leading-[1.55] text-white/85 sm:text-[22px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 500 }}
        >
          {isHe ? (
            <>
              משחק מיני.{" "}
              <em
                className="text-rose-200"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                תשוקה שחוזרת.
              </em>
            </>
          ) : (
            <>
              Sexual game.{" "}
              <em
                className="text-rose-200"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                Desire returns.
              </em>
            </>
          )}
        </p>

        {/* Single primary CTA. */}
        <div className="mt-10">
          <Link
            href={ctaHref}
            className="group relative inline-flex min-h-[60px] items-center justify-center overflow-hidden rounded-full px-12 text-base font-semibold tracking-wide text-white shadow-2xl shadow-rose-600/40 transition hover:brightness-110"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(110deg,#f43f5e_0%,#ec4899_45%,#a855f7_100%)] bg-[length:220%_100%] mio-adults-gradient-shift"
            />
            <span className="relative z-10 inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {isHe ? "אל הקטלוג" : "Enter the catalogue"}
              <ArrowRight
                className={`h-5 w-5 transition group-hover:translate-x-1 ${
                  isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                }`}
              />
            </span>
          </Link>
        </div>

        {/* Reassurance line. */}
        <p
          className="mt-6 text-[13px] text-white/45"
          style={{
            fontFamily: "'Frank Ruhl Libre', serif",
            fontStyle: "italic",
          }}
        >
          {isHe
            ? "לזוגות סקרנים · ללא חוזה · ביטול בכל עת"
            : "For curious couples · no contract · cancel anytime"}
        </p>

        {/* ── MOBILE: small 2-card row beneath the CTA. ── */}
        <div className="mx-auto mt-14 grid max-w-md grid-cols-2 gap-4 lg:hidden">
          <MobilePosterCard
            tone="violet"
            Icon={Heart}
            level={isHe ? "מרגש" : "Touching"}
            placeholderLabel={isHe ? "תמונה" : "Artwork"}
          />
          <MobilePosterCard
            tone="rose"
            Icon={Flame}
            level={isHe ? "מעורר" : "Stirring"}
            placeholderLabel={isHe ? "תמונה" : "Artwork"}
          />
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes mio-adults-gradient-shift {
              0%, 100% { background-position: 0% 50%; }
              50%      { background-position: 100% 50%; }
            }
            .mio-adults-gradient-shift { animation: mio-adults-gradient-shift 7s ease-in-out infinite; }

            /* On-load firework burst around the headline.
               Each spark gets its own --dx/--dy via inline style; this single
               keyframe gives a fast hot flash, a held bright phase as the
               spark moves outward, then a long fading trail. iteration-count:
               1 (forwards) so the burst plays exactly once when the page
               loads. Total duration 4s — matches the user's spec. */
            @keyframes mio-hero-spark {
              0%   { transform: translate(0, 0) scale(0.3); opacity: 0; }
              4%   { transform: translate(0, 0) scale(1.4); opacity: 1; }
              12%  {
                transform: translate(calc(var(--dx, 0px) * 0.30), calc(var(--dy, 0px) * 0.30)) scale(1);
                opacity: 1;
              }
              45%  {
                transform: translate(calc(var(--dx, 0px) * 0.75), calc(var(--dy, 0px) * 0.75)) scale(0.85);
                opacity: 0.85;
              }
              80%  {
                transform: translate(calc(var(--dx, 0px) * 0.95), calc(var(--dy, 0px) * 0.95)) scale(0.5);
                opacity: 0.45;
              }
              100% {
                transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(0);
                opacity: 0;
              }
            }
            .mio-hero-spark {
              animation: mio-hero-spark 4s cubic-bezier(0.18, 0.7, 0.25, 1) 1 forwards;
            }

            /* Central pulse flash — the bright halo at the burst origin.
               Pops fast (peak at 6%) then expands + fades over the rest of
               the 4s. Plays once. */
            @keyframes mio-hero-flash {
              0%   { transform: scale(0.1); opacity: 0; }
              4%   { transform: scale(0.4); opacity: 1; }
              10%  { transform: scale(0.85); opacity: 0.95; }
              35%  { transform: scale(1.4); opacity: 0.55; }
              70%  { transform: scale(1.85); opacity: 0.20; }
              100% { transform: scale(2.2); opacity: 0; }
            }
            .mio-hero-flash {
              animation: mio-hero-flash 4s cubic-bezier(0.16, 0.7, 0.3, 1) 1 forwards;
              will-change: transform, opacity;
              filter: blur(2px);
            }

            /* Reduced-motion fallback — instead of hiding the burst entirely
               (was opacity: 0 !important), give a brief static fade-in/out
               so the user still gets the visual cue without movement. */
            @keyframes mio-hero-static-flash {
              0%   { opacity: 0; }
              10%  { opacity: 1; }
              60%  { opacity: 0.6; }
              100% { opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .mio-hero-spark {
                animation: mio-hero-static-flash 2.5s ease-out 1 forwards !important;
                /* Still position sparks at their target so the post-flash
                   ring shape is visible briefly without translating. */
                transform: translate(var(--dx, 0px), var(--dy, 0px)) !important;
              }
              .mio-hero-flash {
                animation: mio-hero-static-flash 2.5s ease-out 1 forwards !important;
                transform: scale(1.4) !important;
              }
            }
          `,
        }}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroFireworks — small one-shot firework burst around the headline.
//
// UX intent
// ─────────
// On page load, ~30 tiny coloured sparks burst outward from the headline's
// centre, travelling up to 200px before fading to zero. The whole burst lasts
// 4 seconds and never repeats — it's a punctuation mark, not ambience.
//
// Implementation notes
// ────────────────────
// - Pure CSS keyframe animation; no framer-motion. Sparks use CSS custom
//   properties (--dx / --dy) for their target offset so all 30 of them share
//   one keyframe rule.
// - Spark positions are deterministic (index-based math, not Math.random())
//   so SSR HTML and hydrated DOM agree — no React mismatch warnings.
// - Honours `prefers-reduced-motion` (the keyframe rule disables itself).
// ─────────────────────────────────────────────────────────────────────────────

function HeroFireworks() {
  const SPARK_COUNT = 36;
  // Five tints — rose, fuchsia, amber, pink, white — to fit the dark palette.
  // Hex literal so inline `box-shadow` colour can't be hijacked by an
  // inherited `currentColor` (the page wrapper sets `text-white`, which
  // would otherwise turn every glow halo white).
  const TINTS = [
    "#fda4af", // rose-300
    "#f0abfc", // fuchsia-300
    "#fcd34d", // amber-300
    "#f9a8d4", // pink-300
    "#ffffff", // white sparkle
  ];

  // Spread sparks evenly around 360° but jitter each angle so the pattern
  // doesn't look mechanical. Distance varies 110 → 200px for visual depth.
  const sparks = Array.from({ length: SPARK_COUNT }, (_, i) => {
    const baseAngle = (i / SPARK_COUNT) * 2 * Math.PI;
    const jitter = ((i * 13) % 7) * 0.05; // 0 → 0.3 rad
    const angle = baseAngle + jitter;
    const distance = 110 + ((i * 17) % 90); // 110 → 199 px
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const tint = TINTS[i % TINTS.length]!;
    // Sized up from 2-4px → 3-6px so they read against the bright fog.
    const size = 3 + (i % 4); // 3 → 6 px
    // 0 → ~0.4s stagger so the burst has texture instead of one global flash.
    const delay = ((i * 31) % 14) * 0.03;
    return { dx, dy, tint, size, delay };
  });

  // ── DEBUG INSTRUMENTATION ────────────────────────────────────────────
  // User reports the on-load burst isn't visible. Logs confirm the
  // component mounted, computed spark count, and the wrapper's bounding
  // box (which is where the burst originates).
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = wrapperRef.current;
    // eslint-disable-next-line no-console
    console.log("[HeroFireworks] burst started", {
      sparks: sparks.length,
      durationSec: 4,
      iteration: 1,
      // First spark's computed dx/dy/tint — quick sanity check.
      firstSpark: sparks[0],
      // The origin in viewport coords is `wrapperRect.x + wrapperRect.width/2`
      // and `wrapperRect.y + wrapperRect.height/2` (because the wrapper itself
      // is positioned with -translate to be centred on the headline).
      wrapperRect: el?.getBoundingClientRect(),
    });
  }, [sparks]);
  // ────────────────────────────────────────────────────────────────────

  return (
    <span
      ref={wrapperRef}
      aria-hidden
      data-testid="hero-fireworks"
      // z-[2] so sparks render ABOVE the headline (h1 is z-[1]). Previously
      // sparks were z-0 and the white-text headline drew on top of them,
      // making the burst near-invisible against its own light.
      className="pointer-events-none absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
    >
      {/* Central pulse flash — a large soft radial halo that pops bright at
          burst origin then expands and fades. This makes the firework
          impossible to miss even before individual sparks are noticed. */}
      <span
        className="mio-hero-flash absolute"
        style={{
          left: "50%",
          top: "50%",
          width: "220px",
          height: "220px",
          marginLeft: "-110px",
          marginTop: "-110px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,221,228,0.85) 0%, rgba(244,63,94,0.55) 30%, rgba(168,85,247,0.30) 55%, transparent 75%)",
        }}
      />

      {/* Individual sparks — fly outward from the same origin. */}
      {sparks.map((s, i) => (
        <span
          key={i}
          className="mio-hero-spark absolute rounded-full"
          style={{
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: s.tint,
            // Layered glow halo so each spark reads as a small light burst.
            boxShadow: `0 0 ${s.size * 4}px ${s.tint}, 0 0 ${
              s.size * 8
            }px ${s.tint}, 0 0 ${s.size * 12}px rgba(255,255,255,0.4)`,
            animationDelay: `${s.delay}s`,
            ["--dx" as never]: `${s.dx.toFixed(1)}px`,
            ["--dy" as never]: `${s.dy.toFixed(1)}px`,
            // Re-centre each spark on the burst origin.
            left: "50%",
            top: "50%",
            marginLeft: `-${s.size / 2}px`,
            marginTop: `-${s.size / 2}px`,
          }}
        />
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PosterCard — tarot/movie-poster aesthetic. NOT phone-shaped.
//
// Layout from top → bottom:
//   1. tiny tone-coloured rail (Mioshy mark)
//   2. LARGE image placeholder (dashed border + icon + caption)
//      ↳ Replace with <Image src=... fill object-cover /> when art lands.
//   3. Hairline divider
//   4. Italic serif level word
//   5. One-line hint
//   6. 3-dot intensity indicator
//
// No "phone status bar" decoration, no inset gradient art-frame inside the
// outer card. The poster IS the card.
// ─────────────────────────────────────────────────────────────────────────────

function PosterCard({
  tone,
  Icon,
  level,
  hint,
  placeholderLabel,
}: {
  tone: "violet" | "rose";
  Icon: typeof Heart;
  level: string;
  hint: string;
  placeholderLabel: string;
}) {
  const accent =
    tone === "violet"
      ? {
          railFrom: "from-violet-400/0",
          railVia: "via-violet-300/60",
          ring: "border-violet-300/30",
          glow: "shadow-[0_30px_70px_-15px_rgba(168,85,247,0.42)]",
          iconColor: "text-violet-200",
          dot: "bg-violet-300",
          intensity: 1,
        }
      : {
          railFrom: "from-rose-400/0",
          railVia: "via-rose-300/60",
          ring: "border-rose-300/30",
          glow: "shadow-[0_30px_70px_-15px_rgba(244,63,94,0.45)]",
          iconColor: "text-rose-200",
          dot: "bg-rose-300",
          intensity: 2,
        };

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-[24px] border ${accent.ring} bg-[rgba(8,4,12,0.55)] p-4 backdrop-blur-xl ${accent.glow}`}
    >
      {/* 1. Top rail — tone-coloured hair line + Mioshy mark */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
          <span
            className={`h-1.5 w-1.5 rounded-full ${accent.dot} shadow-[0_0_8px_rgba(255,255,255,0.5)]`}
          />
          Mioshy
        </span>
        <Icon className={`h-3.5 w-3.5 ${accent.iconColor}`} />
      </div>
      <span
        aria-hidden
        className={`mt-2 h-px w-full bg-gradient-to-r ${accent.railFrom} ${accent.railVia} to-transparent`}
      />

      {/* 2. IMAGE PLACEHOLDER — replace with <Image /> when art lands.
            The dashed border + icon + caption explicitly tell editors that
            this slot is meant for real artwork. */}
      <div className="relative mt-3 flex flex-1 items-center justify-center overflow-hidden rounded-[16px] border border-dashed border-white/20 bg-[rgba(255,255,255,0.025)]">
        <div className="flex flex-col items-center gap-2 text-white/40">
          <ImageIcon className="h-7 w-7 stroke-[1.4]" />
          <span
            className="text-[11px] uppercase tracking-[0.22em]"
            style={{
              fontFamily: "'Frank Ruhl Libre', serif",
              fontStyle: "italic",
            }}
          >
            {placeholderLabel}
          </span>
        </div>
        {/* corner ticks — subtle frame marks (helps it read as "frame", not "screen") */}
        <CornerTicks />
      </div>

      {/* 3. Hairline divider */}
      <span
        aria-hidden
        className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      {/* 4. Italic-serif level word */}
      <h3
        className="mt-2 text-[26px] leading-[1] text-white"
        style={{
          fontFamily: "'Frank Ruhl Libre', serif",
          fontStyle: "italic",
          fontWeight: 500,
        }}
      >
        {level}
      </h3>

      {/* 5. Hint */}
      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/55">
        {hint}
      </p>

      {/* 6. Intensity indicator — 3 dots, filled per tone */}
      <div className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`h-1 w-1 rounded-full ${
              n <= accent.intensity ? accent.dot : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </article>
  );
}

// Tiny corner ticks inside the placeholder zone — subtle "frame" marks
// borrowed from photography contact sheets / printer crop marks. Helps
// the placeholder read as "image frame" instead of "screen".
function CornerTicks() {
  const cls = "absolute h-3 w-3 border-white/30";
  return (
    <>
      <span aria-hidden className={`${cls} left-2 top-2 border-l border-t`} />
      <span aria-hidden className={`${cls} right-2 top-2 border-r border-t`} />
      <span
        aria-hidden
        className={`${cls} bottom-2 left-2 border-b border-l`}
      />
      <span
        aria-hidden
        className={`${cls} bottom-2 right-2 border-b border-r`}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MobilePosterCard — same poster aesthetic, smaller, simpler. Replaces the
// 3-up mobile row with a 2-up row for parity with desktop.
// ─────────────────────────────────────────────────────────────────────────────

function MobilePosterCard({
  tone,
  Icon,
  level,
  placeholderLabel,
}: {
  tone: "violet" | "rose";
  Icon: typeof Heart;
  level: string;
  placeholderLabel: string;
}) {
  const accent =
    tone === "violet"
      ? {
          ring: "border-violet-300/30",
          dot: "bg-violet-300",
          iconColor: "text-violet-200",
        }
      : {
          ring: "border-rose-300/30",
          dot: "bg-rose-300",
          iconColor: "text-rose-200",
        };

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl border ${accent.ring} bg-[rgba(8,4,12,0.55)] p-3 backdrop-blur-xl`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`h-1.5 w-1.5 rounded-full ${accent.dot} shadow-[0_0_8px_rgba(255,255,255,0.5)]`}
        />
        <Icon className={`h-3.5 w-3.5 ${accent.iconColor}`} />
      </div>
      {/* image slot */}
      <div className="relative mt-2 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-[rgba(255,255,255,0.025)]">
        <div className="flex flex-col items-center gap-1 text-white/40">
          <ImageIcon className="h-5 w-5 stroke-[1.4]" />
          <span
            className="text-[9px] uppercase tracking-[0.2em]"
            style={{
              fontFamily: "'Frank Ruhl Libre', serif",
              fontStyle: "italic",
            }}
          >
            {placeholderLabel}
          </span>
        </div>
      </div>
      <p
        className="mt-2 text-center text-[14px] text-white"
        style={{
          fontFamily: "'Frank Ruhl Libre', serif",
          fontStyle: "italic",
          fontWeight: 500,
        }}
      >
        {level}
      </p>
    </article>
  );
}
