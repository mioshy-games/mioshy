"use client";

/**
 * Hero for /[locale]/adults - Mioshy's flagship after-dark surface.
 *
 * Composition
 * ───────────
 * - Centre stage: kicker → huge italic-gradient headline → lede → CTA → note.
 *   The closing-CTA's centred drama is the structural spine.
 * - Two TAROT-STYLE poster cards float at the start/end edges of the hero.
 *   They never overlap the centre. They're tilted, drift gently, and act
 *   as atmospheric "preview" hints - not a feature grid.
 * - Each card has a CLEAR, dashed-border image placeholder zone with an
 *   image icon + caption - invites "drop real artwork here" without breaking
 *   the dark aesthetic.
 *
 * Why two cards (not three)
 * ─────────────────────────
 * Three cards forced the third one into the centre, where it competed
 * with - and visually overlapped - the primary CTA. Two cards keep the
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
import Image from "next/image";
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
  ctaHref = "#catalogue",
}: {
  isHe: boolean;
  // `hero` is in the contract for forward-compat but the simplified
  // hero variant doesn't read it.
  hero: Hero;
  ctaHref?: string;
  /** Kept for backward compat; unused in this minimal hero. */
  secondaryHref?: string;
}) {
  return (
    <section className="relative" dir={isHe ? "rt-" : "ltr"}>
      {/* Hairline gradient rail at the very top - section rhythm. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/40 to-transparent"
      />
-
      {/* Animated two-tone DARK gradient pool behind the headline.
          Two dark radials drift via `animate-aurora-drift` (defined in
          tailwind.config). Mirrors the journey-page hero treatment but
          in the wine/plum after-dark palette: deep burgundy on one side,
          deep violet on the other. Low chroma + low alpha keeps the
          backdrop feeling like ambient room light, not a poster splash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 animate-aurora-drift"
        style={{
          background:
            "radial-gradient(900px 520px at 28% 32%, rgba(76,29,49,0.65), transparent 60%), " +
            "radial-gradient(820px 480px at 76% 60%, rgba(46,18,56,0.65), transparent 62%)",
        }}
      />
-
      {/* Breadcrumb - quiet, away from the headline. Tighter top
          padding on mobile to remove the dead air the user flagged. */}
      <nav
        aria-label="breadcrumb"
        className="relative z-20 mx-auto hidden max-w-6xl items-center gap-2 px-4 pt-4 text-[13px] text-white/55 sm:flex sm:pt-8 sm:text-xs sm:text-white/45"
      >
        <Link href="/" className="transition hover:text-white/80">
          {isHe ? "בית" : "Home"}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-white/80 sm:text-white/70">
          {isHe ? "למבוגרים בלבד" : "Adults only"}
        </span>
      </nav>
-

      {/* ── DESKTOP edge cards - two only, brought closer to the headline.
            start/end values bumped from 2% → 8% so the cards read as part
            of the headline cluster, not pinned to the screen edges.
            top values nudged ~30px down so the cards align with the
            headline's vertical centre rather than its top. ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
      >-
        {/* Card peek - start (right in RTL) edge.
            Position iterations: 8% → 4% (out to edges) → 6.5% (gentle pull
            back toward centre per user feedback). Aligned around the
            headline's vertical centre at top:200px. */}
        <motion.div
          initial={{ y: 8, rotate: -8 }}
          animate={{ y: [8, -8, 8], rotate: [-8, -6, -8] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[200px] start-[6.5%] h-[360px] w-[240px]"
        >
          <PosterCard
            tone="violet"
            Icon={Heart}
            level={isHe ? "מרגש" : "Touching"}
            hint={isHe ? "שאלות שמפיגות מרחק" : "Prompts that close distance"}
            placeholderLabel={isHe ? "תמונת המשחק" : "Game artwork"}
            imageSrc="/images/woman-mioshy.webp"
            imageAlt={isHe ? "מרגש - תמונת המשחק" : "Touching - game artwork"}
          />
        </motion.div>

        {/* Card peek - end (left in RTL) edge, slightly lower & opposite tilt */}
        <motion.div
          initial={{ y: -10, rotate: 8 }}
          animate={{ y: [-10, 10, -10], rotate: [8, 10, 8] }}
          transition={{
            duration: 13,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.7,
          }}
          className="absolute top-[260px] end-[6.5%] h-[360px] w-[240px]"
        >
          <PosterCard
            tone="rose"
            Icon={Flame}
            level={isHe ? "מעורר" : "Stirring"}
            hint={isHe ? "הזמנות לחוויה משותפת" : "Invitations into play"}
            placeholderLabel={isHe ? "תמונת המשחק" : "Game artwork"}
            imageSrc="/images/woman-sexy.webp"
            imageAlt={isHe ? "מעורר - תמונת המשחק" : "Stirring - game artwork"}
          />
        </motion.div>
      </div>
-
      {/* ── CENTRE STAGE - copy + CTA.
          Mobile redesign:
          - Top padding cut from pt-10 → pt-4 to remove dead air.
          - Headline capped at 40px on mobile so the long Hebrew
            second line ("חוויה מינית חדשה") doesn't break each
            word onto its own line. The previous 66px forced a 3-line
            wrap that looked broken; 40px keeps it on 1–2 lines.
          - Kicker bumped to 13px (was 11px - unreadable).
          - Lede 17px (was 20px) so it breathes vs. the headline.
          - All vertical margins ~30% tighter to keep the CTA visible
            without scrolling on common phone heights. */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-10 pt-4 text-center sm:pb-14 sm:pt-14">
        {/* Flagship + 18+ kicker - bigger text + wraps on tiny screens
            so the divider line doesn't push pieces out of view. */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] font-semibold uppercase tracking-[0.22em] sm:text-[11px] sm:tracking-[0.28em]">
          <span className="inline-flex items-center gap-1.5 text-rose-200/90">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.7)]" />
            {isHe ? "המוצר הדגל" : "The flagship"}
          </span>
          <span aria-hidden className="hidden h-3 w-px bg-white/15 sm:inline" />
          <span className="text-white/65 sm:text-white/55">
            {isHe ? "למבוגרים בלבד · 18+" : "Adults only · 18+"}
          </span>
        </div>

        {/* The statement. Two lines, second in italic SOLID rose-300.
            (Was a 3-stop gradient via bg-clip-text - Hebrew italic letters
            with descenders rendered with visible cropping artifacts on
            many browsers, same root cause as the homepage closer fix.
            Solid colour renders identically across UAs and avoids the
            bug at large display sizes.) */}
        <div className="mt-5 sm:mt-8">
          <h1
            className="mx-auto max-w-[360px] text-balance text-[58px] leading-[1.02] tracking-[-0.025em] sm:max-w-none sm:text-[66px] sm:leading-[1.02] md:text-[86px] lg:text-[99px]"
            style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
          >
            <span className="block text-white">
              {isHe ? "ערב אחד." : "One evening."}
            </span>
            <span
              className="mt-1 block text-rose-300 sm:mt-2"
              style={{ fontStyle: "italic", fontWeight: 500 }}
            >
              {isHe ? "חוויה מינית חדשה." : "A new sexual experience."}
            </span>
          </h1>
        </div>

        {/* Lede - names the product type + the emotional payoff. */}
        <p
          className="mx-auto mt-4 max-w-[300px] text-pretty text-[20px] leading-[1.5] text-white/85 sm:mt-7 sm:max-w-xl sm:text-[20px] sm:leading-[1.6] md:text-[22px]"
          style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 500 }}
        >
          {isHe ? (
            <>
              משחקים שכתבו מומחים בעולם.{" "}
              <em
                className="text-rose-200"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                לזוגות שמוכנים לזה.
              </em>
            </>
          ) : (
            <>
              Games written by world-class experts.{" "}
              <em
                className="text-rose-200"
                style={{ fontStyle: "italic", fontWeight: 500 }}
              >
                For couples ready for it.
              </em>
            </>
          )}
        </p>

        {/* Mobile-only inline poster pair - sits between the lede and CTA,
            in document flow, replacing the prior absolute "edge peeks"
            that were overlapping the headline. Two cards side-by-side,
            slightly tilted toward each other, give the section visual
            atmosphere without competing with the title. Hidden on lg+
            because desktop already has its own larger floating cards. */}
        <div
          aria-hidden
          className="mt-7 flex justify-center gap-3 lg:hidden"
        >
          <div className="h-[180px] w-[120px] -rotate-[6deg]">
            <MiniPosterCard
              tone="violet"
              Icon={Heart}
              imageSrc="/images/woman-mioshy.webp"
              imageAlt={isHe ? "מרגש - תמונת המשחק" : "Touching - game artwork"}
            />
          </div>
          <div className="h-[180px] w-[120px] rotate-[6deg]">
            <MiniPosterCard
              tone="rose"
              Icon={Flame}
              imageSrc="/images/woman-sexy.webp"
              imageAlt={isHe ? "מעורר - תמונת המשחק" : "Stirring - game artwork"}
            />
          </div>
        </div>

        {/* Single primary CTA. Slightly tighter on mobile so the whole
            "headline → CTA" stack fits within one screen. */}
        <div className="mt-6 sm:mt-10">
          <Link
            href={ctaHref}
            className="group relative inline-flex min-h-[56px] items-center justify-center overflow-hidden rounded-full px-8 text-[16px] font-semibold tracking-wide text-white shadow-2xl shadow-rose-600/40 transition hover:brightness-110 sm:min-h-[60px] sm:px-12 sm:text-base"
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
          className="mt-4 text-[18px] text-white/75 sm:mt-7 sm:text-[15px] sm:text-white/55"
          style={{
            fontFamily: "'Frank Ruhl Libre', serif",
            fontStyle: "italic",
          }}
        >
          {isHe
            ? "לזוגות סקרנים · ללא חוזה · ביטול בכל עת"
            : "For curious couples · no contract · cancel anytime"}
        </p>

        {/* The tiny mobile edge cards now flank the headline at the
            top of the hero (see "MOBILE edge cards" block above), so
            we no longer stack a large 2-card row under the CTA - that
            duplicated space and pushed the catalogue offscreen. */}
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
               1 (forwards) so the burst-plays exactly once when the page
               loads. Total duration 4s - matches the user's spec. */
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
-
            /* Central pulse flash - the bright halo at the burst origin.
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
-
            /* Reduced-motion fallback - instead of hiding the burst entirely
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

// ──────────────-──────────────────────────────────────────────────────────────
// HeroFireworks - small one-shot firework burst around the headline.
//
// UX intent
// ─────────
// On page load, ~30 tiny coloured sparks burst outward from the headline's
// centre, travelling up to 200-x before fading to zero. The whole burst lasts
// 4 seconds and never repeats - it's a punctuation mark, not ambience.
//
// Implementation notes
// ────────────────────
// - Pure CSS keyframe animation; no framer-motion. Sparks use CSS custom
//   properties (--dx / --dy) for their target offset so all 30 of them share
//   one keyframe rule.
// - Spark positions are deterministic (-ndex-based math, not Math.random())
//   so SSR HTML and hydrated DOM agree - no React mismatch warnings.
// - Honours `prefers-reduced-motion` (the keyframe rule disables itself).
// ─────────────────────────────────────────────────────────────────────────────

// HeroFireworks is currently unused - the on-load burst was disabled
// when the hero copy was redesigned. Keeping the implementation in place
// (instead of deleting) so we can re-enable it cheaply if the burst comes
// back. The eslint-disable below tells lint to allow the dead function.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HeroFireworks() {
  const SPARK_COUNT = 36;
  // Five tints - rose, fuchsia, amber, pink, white - to fit the dark palette.
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
      // First spark's computed dx/dy/tint - quick sanity check.
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
    >-
      {/* Central pulse flash - a large soft radial halo that pops bright at
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
-
      {/* Individual sparks - fly outward from the same origin. */}
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

// ────────────────────────────────────────────────────────────────────────────
// PosterCard - tarot/movie-poster aesthetic. NOT phone-shaped.
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
  imageSrc,
  imageAlt,
}: {
  tone: "violet" | "rose";
  Icon: typeof Heart;
  level: string;
  hint: string;
  placeholderLabel: string;
  /** Optional artwork. When present, replaces the dashed placeholder zone. */
  imageSrc?: string;
  imageAlt?: string;
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
      className={`group flex h-full flex-col overflow-hidden rounded-[24px] border ${accent.ring} bg-[rgba(8,4,12,0.30)] p-3 backdrop-blur-xl ${accent.glow}`}
    >
      {/* TOP ROW - single tight line: Mioshy mark + tone icon. No divider
          (was eating ~10px of vertical real estate that the artwork
          needed). */}
      <div className="flex items-center justify-between px-1 py-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">
          <span
            className={`h-1.5 w-1.5 rounded-full ${accent.dot} shadow-[0_0_8px_rgba(255,255,255,0.5)]`}
          />
          Mioshy
        </span>
        <Icon className={`h-3.5 w-3.5 ${accent.iconColor}`} />
      </div>

      {/* ARTWORK ZONE - dominates the card. flex-1 + tight outer chrome
          gives the image roughly 90% of the card's vertical real estate. */}
      {imageSrc ? (
        <div className="relative mt-2 flex-1 overflow-hidden rounded-[16px] border border-white/10 bg-[rgba(255,255,255,0.02)]">
          {/* Image sized to 90% of the frame area (5% inset on every side).
              Corner ticks live in that thin strip and act as photographic
              crop marks. */}
          <Image
            src={imageSrc}
            alt={imageAlt ?? placeholderLabel}
            fill
            sizes="(max-width: 768px) 90vw, 450px"
            className="absolute h-[90%] w-[90%] rounded-[10px] object-cover"
            style={{ inset: "5%" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute h-[90%] w-[90%] rounded-[10px]"
            style={{
              inset: "5%",
              background:
                "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)",
            }}
          />
          <CornerTicks />
        </div>
      ) : (
        <div className="relative mt-2 flex flex-1 items-center justify-center overflow-hidden rounded-[16px] border border-dashed border-white/20 bg-[rgba(255,255,255,0.025)]">
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
          <CornerTicks />
        </div>
      )}

      {/* BOTTOM ROW - level + intensity dots on a single line, hint as a
          micro-caption beneath. The hairline divider that used to sit
          here was removed; the artwork edge already provides the visual
          break. */}
      <div className="mt-2 flex items-baseline justify-between px-1">
        <h3
          className="text-[22px] leading-[1] text-white"
          style={{
            fontFamily: "'Frank Ruhl Libre', serif",
            fontStyle: "italic",
            fontWeight: 500,
          }}
        >
          {level}
        </h3>
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1 w-1 rounded-full ${
                n <= accent.intensity ? accent.dot : "bg-white/15"
              }`}
            />
          ))}
        </div>
      </div>
      <p className="mt-0.5 line-clamp-1 px-1 text-[11px] leading-snug text-white/55">
        {hint}
      </p>
    </article>
  );
}

// Tiny corner ticks inside the placeholder zone - subtle "frame" marks
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

// ────────────────────────────────────────────────────────────────────────────
// MobilePosterCard - same poster aesthetic, smaller, simpler. Replaces the
// 3-up mobile row with a 2-up row for parity with desktop.
// ─────────────────────────────────────────────────────────────────────────────

// MiniPosterCard - mobile-only edge peek used to flank the headline.
// Tiny, decorative, no copy inside. Renders just the framed artwork
// silhouette + a tone dot + a small icon. Sits behind the text via
// pointer-events-none so it never blocks taps.
function MiniPosterCard({
  tone,
  Icon,
  imageSrc,
  imageAlt,
}: {
  tone: "violet" | "rose";
  Icon: typeof Heart;
  /** Optional artwork - when present, replaces the dashed placeholder. */
  imageSrc?: string;
  imageAlt?: string;
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
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl border ${accent.ring} bg-[rgba(8,4,12,0.55)] p-1.5 backdrop-blur-md shadow-lg shadow-black/40`}
    >
      <div className="flex items-center justify-between">
        <Icon className={`h-3 w-3 ${accent.iconColor}`} />
        <span
          className={`h-1 w-1 rounded-full ${accent.dot} shadow-[0_0_6px_rgba(255,255,255,0.5)]`}
        />
      </div>
      <div className="relative mt-1 flex flex-1 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[rgba(255,255,255,0.025)]">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={imageAlt ?? ""}
            fill
            sizes="92px"
            className="object-cover"
          />
        ) : (
          <ImageIcon className="h-3.5 w-3.5 stroke-[1.4] text-white/35" />
        )}
      </div>
    </div>
  );
}

// Kept for cheap reuse if we re-introduce a stacked mobile card row
// elsewhere on the page. The hero itself now uses MiniPosterCard.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
