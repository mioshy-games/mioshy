"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@/navigation";
import {
  ArrowRight,
  Heart,
  Infinity as InfinityIcon,
  RotateCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Wheel, type WheelApi, type WheelSegment } from "@/components/Wheel";
import { GamePageBackground } from "@/components/game/GamePageBackground";
import type { WheelConfigRow } from "@/lib/types/database";
import type { GameSettings } from "@/lib/types/settings";
import { normalizeRichText } from "@/lib/cms/render";
import { useCmsText } from "@/hooks/useCmsText";

/**
 * Mirrors `RICH_MARKUP_RE` from hooks/useCmsText.ts and the
 * `RICH_ALLOWED_TAGS` allow-list in lib/cms/sanitize.ts.
 *
 * Bug 2026-05-15 — when /games admins drop `<mark>...</mark>` into
 * the CMS row for `gamesHub.h1`, the value reaches LiveDemoHero as a
 * raw string prop (this component receives `title: string`, not a
 * `<CmsText>` node). React escaped the tags and showed them as
 * literal `<mark>...</mark>` characters on the public page.
 *
 * Strategy: if the prop string contains any allow-listed tag, emit
 * via `dangerouslySetInnerHTML` (+ `cms-rich` class so the same
 * brand styling that `<CmsText>` produces is applied here too).
 * Plain strings keep the text-node path so we don't expand the
 * dangerouslySetInnerHTML surface unnecessarily. Server-side
 * sanitisation in lib/cms/sanitize.ts is still the authoritative
 * gate — by the time a string reaches this prop it carries only
 * the 8-tag allow-list.
 */
const RICH_MARKUP_RE = /<\/?(?:em|strong|mark|br|p|ul|li|s)\b/i;

/**
 * LiveDemoHero - premium "Try-before-signup" hero for /games.
 *
 * Embeds the *production* Wheel.tsx component (same one used in
 * /games/honesty-or-challenge) - same colours, same divider, same
 * easing, same spin curve. Just smaller and silent.
 *
 * Behaviour:
 *   • Auto-spins ONCE ~1.2s after mount (delegates to Wheel.spin())
 *   • forbiddenType="dare" → wheel always lands on a Truth slice for
 *     a clean, on-brand first impression
 *   • Sound is muted (isSpinSoundEnabled={false}) - autoplay-friendly
 *   • After the wheel settles, a question card pops next to it with
 *     the sample question, and the primary CTA mutates to
 *     "המשיכו לשחק עם השאלה הזאת" → /games/honesty-or-challenge
 *
 * Slices, pointer colour, divider colour, inner circle colours all
 * arrive as props from the server-side fetch in /games/page.tsx -
 * so the demo wheel always mirrors the live game's configuration.
 * Falls back to a sensible wine-palette default if the DB lookup
 * doesn't return data.
 */

type Props = {
  isHe: boolean;
  title: string;
  lede: string;
  badge?: string;
  ctaPrimary: string;
  ctaPrimaryHref?: string;
  ctaSecondary?: string;
  ctaSecondaryHref?: string;
  trust?: { icon: "sparkles" | "heart" | "zap" | "infinity"; label: string }[];
  /** Where "Continue playing" navigates after the wheel lands. */
  gameHref: string;
  /** Sample question (locale-resolved) shown after the wheel lands. */
  sampleQuestion: string;
  /** Locale-resolved sample-question type label, e.g. "אמת" / "Truth". */
  sampleQuestionType: string;
  /** Wheel slices fetched from the live game's wheel_configs row. */
  slices: WheelSegment[] | null;
  /** Full wheel_configs row of the demo game - used for chrome (colors,
   *  marker_config, etc.) so the hero mirrors the admin-configured wheel. */
  wheelConfig: WheelConfigRow | null;
  /** GameSettings (markers, custom border, label fonts, motion easing,
   *  background, particles) - same source TruthOrDareClient consumes,
   *  so anything an admin tweaks shows up here too. */
  gameSettings: GameSettings | null;
  /** Used as a theme key for the contained GamePageBackground. */
  gameSlug: string;
  /** game.bg_value - solid/gradient base when gameSettings.background is absent. */
  gameBgValue: string | null;
};

type Phase = "idle" | "spinning" | "settled";

// Wine-palette fallback if the DB lookup fails (game not found, no wheel
// config, etc.) - keeps the hero functional in any environment.
const FALLBACK_SLICES: WheelSegment[] = [
  { type: "truth", label: "אמת",  color: "#B83C4D" },
  { type: "dare",  label: "אתגר", color: "#3D1F3D" },
  { type: "truth", label: "אמת",  color: "#8B2638" },
  { type: "dare",  label: "אתגר", color: "#1E0F1E" },
  { type: "truth", label: "אמת",  color: "#B83C4D" },
  { type: "dare",  label: "אתגר", color: "#3D1F3D" },
];

export function LiveDemoHero({
  isHe,
  title,
  lede,
  // `badge` arg renamed to `_badge` so ESLint's unused-args rule
  // (allows /^_/) accepts it. The pill that consumed `badge` was
  // removed earlier; the prop is still part of the public API so
  // callers don't need to change.
  badge: _badge,
  ctaPrimary,
  ctaPrimaryHref = "#catalogue",
  ctaSecondary,
  ctaSecondaryHref = "#why",
  trust,
  gameHref,
  sampleQuestionType,
  slices,
  wheelConfig,
  gameSettings,
  gameSlug,
  gameBgValue,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [landedSlice, setLandedSlice] = useState<WheelSegment | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const wheelRef = useRef<WheelApi>(null);
  const spinStartedRef = useRef(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Diagnostic: when the popup renders, log its bounding rect, its parent's
  // rect, the viewport width, and any inline transform Framer is applying.
  // Helps confirm whether centering math actually places the card in view
  // or whether something (transform: none, overflow, etc.) is shifting it.
  useEffect(() => {
    // 2026-05-20 — popup-rect diagnostic effect removed entirely.
    // Was logging 5 separate console.log calls per settle, each
    // capturing big object literals. Costed ~10-15ms of main-thread
    // work per spin. The popup positioning is stable now; if we ever
    // need to debug position again we can re-add via NODE_ENV gate.
    if (phase !== "settled" || !cardOpen) return;
    return undefined;
  }, [phase, cardOpen]);

  // Marketing demo wheel - intentionally simplified to TWO categories
  // (Truth + Challenge), repeating. The production game pulls dozens of
  // slices from the DB; that's reserved for the actual game page. Here
  // we just want a "taste" wheel with two fixed sample contents that
  // visitors can spin and feel before committing to a real game.
  //
  // Strategy: pull one Truth-typed slice and one Challenge-typed slice
  // from the production wheel config (so the colors/labels carry over),
  // then build a 6-segment alternating wheel from those two. Fall back
  // to FALLBACK_SLICES if production doesn't expose both types.
  const isChallengeType = (t: string) =>
    /dare|challenge|אתגר/i.test(t);
  const isTruthType = (t: string) =>
    /truth|honest|honesty|כנות|אמת/i.test(t);

  const effectiveSlices = useMemo<WheelSegment[]>(() => {
    if (!slices || slices.length === 0) return FALLBACK_SLICES;
    const truth =
      slices.find((s) => isTruthType(s.type) || isTruthType(s.label));
    const challenge =
      slices.find((s) => isChallengeType(s.type) || isChallengeType(s.label));
    if (!truth || !challenge) return FALLBACK_SLICES;
    // Preserve the production slice COUNT - if the admin configured a
    // 12-slice wheel, the demo also shows 12 (alternating). That keeps
    // the visual rhythm identical to the live game.
    const count = slices.length;
    return Array.from({ length: count }, (_, i) =>
      i % 2 === 0 ? { ...truth } : { ...challenge },
    );
  }, [slices]);

  // Demo content - fixed wording per slice type. The actual game pulls
  // questions fro- the DB; this is the marketing taste-tester.
  const isChallenge =
    !!landedSlice &&
    (isChallengeType(landedSlice.type) || isChallengeType(landedSlice.label));
  const displayedQuestion = isChallenge
    ? isHe
      ? "הקלט/י הודעה קולית אירוטית של דקה - שלח/י לי שאשמע מחר בבוקר בדרך לעבודה."
      : "Record a 1-minute erotic voice message - send it to me to hear tomorrow morning on my way to work."
    : isHe
      ? "מה היית מוחק/ת מהעבר שלנו אם יכולת?"
      : "What would you erase from our past, if you could?";

  // 2026-05-20 — first-render diagnostic console.log removed. Was
  // running on every initial render of LiveDemoHero and serializing
  // the entire effectiveSlices array. Cheap on its own but stacked
  // with all the other logs it was visible in main-thread profiles.

  // ── Resolved Wheel props - mirrors TruthOrDareClient's mapping so the demo
  //    wheel matches the adm-n-configured production wheel pixel-for-pixel.
  //    Priority: gameSettings → wheel_configs → safe defaults.
  const resolvedPointerColor =
    gameSettings?.wheel?.pointerColor ?? wheelConfig?.pointer_color ?? "#FAF6F7";
  const resolvedPointerOffsetY = gameSettings?.wheel?.pointerOffsetY ?? 0;
  const resolvedInnerCircle =
    gameSettings?.wheel?.innerCircle?.enabled ?? wheelConfig?.inner_circle ?? true;
  const resolvedInnerCircleColor =
    gameSettings?.wheel?.innerCircle?.fillColor ??
    wheelConfig?.inner_circle_color ??
    "#FAF6F7";
  const resolvedInnerCircleBorderColor =
    gameSettings?.wheel?.innerCircle?.borderColor ??
    wheelConfig?.inner_circle_border_color ??
    "#170E14";
  const resolvedDividerEnabled =
    gameSettings?.wheel?.divider?.enabled ??
    wheelConfig?.divider_enabled ??
    wheelConfig?.show_divider ??
    true;
  const resolvedDividerColor =
    gameSettings?.wheel?.divider?.color ??
    wheelConfig?.divider_color ??
    "#FAF6F7";
  const resolvedDividerWidth =
    gameSettings?.wheel?.divider?.width ?? wheelConfig?.divider_width ?? 2;

  // Markers (admin-configured circles or SVG icons around the rim)
  const resolvedMarkerConfig: Record<string, unknown> = {
    ...((wheelConfig?.marker_config as Record<string, unknown>) ?? {}),
    ...(gameSettings?.wheel?.markers && gameSettings.wheel.markers.type !== "none"
      ? {
          marker_type: gameSettings.wheel.markers.type,
          marker_color: gameSettings.wheel.markers.color,
          marker_size: gameSettings.wheel.markers.size,
          marker_count: gameSettings.wheel.markers.count,
          marker_position: gameSettings.wheel.markers.position,
          svg_path_d: gameSettings.wheel.markers.svgPath ?? "",
        }
      : {}),
  };

  // Outer border (custom ring around the wheel)
  const resolvedOuterBorder = gameSettings?.border ?? undefined;

  // Label styling lookups (font size / color / outline) used to live here
  // but are not consumed by the simplified hero preview. When the label
  // customisation work resumes, read them from gameSettings?.wheel directly
  // - the original lookups are 1-liners and don't need to be precomputed.
  const resolvedLabelFraction =
    gameSettings?.wheel?.labelRadiusFraction ??
    (typeof (wheelConfig?.marker_config as Record<string, unknown>)?.label_radius_fraction === "number"
      ? ((wheelConfig?.marker_config as Record<string, number>).label_radius_fraction)
      : 0.72);

  // Motion - for the marketing demo we always spin for exactly 4s
  // (per It-ik) regardless of admin spinSpeed, so the user gets a
  // predictable settle window for the question card to land.
  const resolvedSpinDuration = 4;
  const EASING_MAP: Record<string, number[] | string> = {
    linear: "linear",
    "ease-in": [0.55, 0, 1, 0.45],
    "ease-out": [0.12, 0.8, 0.12, 1],
    "ease-in-out": [0.45, 0, 0.55, 1],
  };
  const resolvedSpinEasing = gameSettings
    ? (EASING_MAP[gameSettings.motion.easing] ?? [0.12, 0.8, 0.12, 1])
    : [0.12, 0.8, 0.12, 1];

  // Pointer SVG (custom)
  const resolvedPointerSvg = gameSettings?.wheel?.pointerSvg;
  const resolvedPointerSvgWidth = gameSettings?.wheel?.pointerSvgWidth;
  const resolvedPointerSvgHeight = gameSettings?.wheel?.pointerSvgHeight;

  // Auto-spin immediately on mount - no entrance delay (per Itzik).
  // Production Wheel handles all the easing, duration and landing math -
  // we just trigger and listen.
  // 2026-05-20 — Re StrictMode double-spin: kept the original
  // "no-cleanup" pattern intentionally. Why we don't add cleanup:
  //   1. StrictMode dev runs effect → cleanup → effect again,
  //      synchronously.
  //   2. If cleanup `clearTimeout`s, the timer never fires (it was
  //      scheduled for the next macro-task) and the spin never
  //      starts in dev.
  //   3. The `spinStartedRef` guard on the second effect prevents
  //      double-spin; refs persist across the StrictMode pseudo-
  //      unmount, so the second mount correctly bails.
  // Net: spin runs exactly once in both dev (StrictMode) and prod.
  // The unmounted-component warning during real navigation is
  // suppressed by the wheelRef null-check below.
  useEffect(() => {
    if (spinStartedRef.current) return;
    spinStartedRef.current = true;

    setTimeout(() => {
      if (!wheelRef.current) return;
      if (effectiveSlices.length === 0) return;
      setPhase("spinning");
      wheelRef.current.spin();
    }, 0);
    // Intentionally no cleanup — see comment above.
  }, [effectiveSlices]);

  // Dynamic CTA - once the wheel has landed, the primary CTA invites the
  // user to continue with the very question they just got.
  //
  // 2026-05-19 — settled-state label was hardcoded inline. Itzik asked
  // for both a copy change ("מעבר למשחק כנות / אתגר") and to make it
  // editable via the CMS. Now wired through `useCmsText` so admins can
  // tweak it in /admin/content without a deploy. Fallback chain:
  // cms_texts (DB) → messages/he.json + en.json → key itself.
  const settledCtaLabel = useCmsText("homeV2.liveDemo.ctaSettledPlay");
  const isSettled = phase === "settled";
  const primaryLabel = isSettled ? settledCtaLabel.text : ctaPrimary;
  const primaryHref = isSettled ? gameHref : ctaPrimaryHref;

  return (
    <section
      dir={isHe ? "rtl" : "ltr"}
      className="relative isolate overflow-hidden"
    >
      {/* Hero background = the live game's full background (blobs +
          particles + vignette + scanlines). Replaces the previous
          wine-palette aurora; the entire hero now reads as a portal
          into the actual game. */}
      <GamePageBackground
        gameSlug={gameSlug}
        primaryColor={gameBgValue ?? undefined}
        bgSettings={gameSettings?.background}
        // 2026-05-20 — once the demo wheel has settled, freeze the
        // drifting blob animations so the marketing hero stops
        // consuming compositor frames. Itzik: "after the wheel lands
        // the page should go back to feeling fast." Hands the
        // GPU/compositor budget back for scroll, hydration of
        // sections below, and IntersectionObserver callbacks.
        frozen={phase === "settled"}
        // 2026-05-19 — particles disabled on the marketing hero per
        // Itzik. NOTE: passing `null` is NOT enough — the component
        // merges `DEFAULT_PARTICLES` (enabled: true, count: 18) over
        // `null`, so particles still render. We must pass an explicit
        // `{ enabled: false }` config to make `FloatingParticles`
        // bail out (early return at line ~208 of FloatingParticles.tsx).
        particlesSettings={{
          enabled: false,
          count: 0,
          shape: "circle",
          opacity: 0,
          speed: 0,
          sizeMin: 0,
          sizeMax: 0,
        }}
        containerClassName="relative w-full overflow-hidden"
      >
        {/* On mobile we open with the wheel - that's the product
            taste-test. The copy follows below, centered. On desktop
            the copy reads first on the start side, wheel on the other.
            flex-col-reverse achieves the swap without duplicating DOM. */}
        {/* 2026-05-20 — max-w-6xl → max-w-7xl. SiteHeader's top bar
            uses max-w-7xl (see SiteHeader.tsx line 280). All marketing
            sections were previously max-w-6xl, which left a ~64px gap
            on each side between the hero and the header's logo column.
            Itzik: the header is the reference width; everything else
            should align. */}
        <div className="mx-auto flex min-h-[700px] max-w-7xl flex-col-reverse items-center gap-10 px-4 pb-16 pt-6 lg:flex-row lg:items-stretch lg:gap-12 lg:pb-20 lg:pt-16">
        {/* ── COPY COLUMN ─────────────────────────────────────────── */}
        <div className="relative z-10 mx-auto max-w-2xl text-center lg:mx-0 lg:flex-1 lg:text-start">
          {/* 2026-05-19 — "טעימה חיה · Mioshy" sparkle pill removed per
              Itzik. The h1 alone carries the heading weight; the pill
              read as redundant chrome. `badge` prop kept on the
              component signature so callers don't need to change. */}

          {/* 2026-05-20 — All entrance motion.* `initial={{...}}`
              changed to `initial={false}`. Reason: now that we SSR the
              LiveDemoHero (Stage 1.1 of perf rollout), the SSR HTML
              would have shipped with `style="opacity:0"` and the user
              would see invisible content for ~0.8s on slow phones
              while waiting for hydration + entrance animation. With
              initial={false}, the element renders at its final state
              from the very first paint — no FOUC, no entrance
              animation. The fade-in was nice but optional; instant
              text is the right call for SSR + above-the-fold content. */}
          {RICH_MARKUP_RE.test(title) ? (
            <h1
              className="cms-rich mt-6 text-balance text-5xl leading-[1.05] tracking-[-0.02em] text-white sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
              dangerouslySetInnerHTML={{ __html: normalizeRichText(title) }}
            />
          ) : (
            <h1
              className="mt-6 text-balance text-5xl leading-[1.05] tracking-[-0.02em] text-white sm:text-6xl lg:text-7xl"
              style={{ fontFamily: "'Frank Ruhl Libre', serif", fontWeight: 600 }}
            >
              {title}
            </h1>
          )}

          {RICH_MARKUP_RE.test(lede) ? (
            <p
              className="cms-rich mx-auto mt-6 max-w-xl text-pretty text-[22px] leading-[1.55] text-white lg:mx-0"
              dangerouslySetInnerHTML={{ __html: normalizeRichText(lede) }}
            />
          ) : (
            <p
              className="mx-auto mt-6 max-w-xl text-pretty text-[22px] leading-[1.55] text-white lg:mx-0"
            >
              {lede}
            </p>
          )}

          {/* CTAs - primary mutates after settle (CTA copy/href flip
              is state-driven; the wrapping <div> is plain now). */}
          <div
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start"
          >
            <Link
              href={primaryHref}
              className="group relative inline-flex min-h-[56px] items-center justify-center overflow-hidden rounded-full px-8 text-[16px] font-semibold text-white shadow-xl shadow-[#B83C4D]/30 transition hover:brightness-110"
            >
              {/* 2026-05-20 — `animation: mio-gradient-shift` removed.
                  Was animating `background-position` to create a slow
                  horizontal shimmer across the CTA gradient. Lighthouse
                  flagged it as a non-composited animation (background-
                  position triggers paint every frame, not just
                  compositor work). Static gradient gives essentially
                  the same visual at zero per-frame cost. */}
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(110deg,#B83C4D_0%,#8B2638_45%,#3D1F3D_100%)]"
              />
              <span className="relative z-10 inline-flex items-center">
                {primaryLabel}
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
                className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 text-[16px] font-semibold text-white/90 backdrop-blur-md transition hover:border-white/40 hover:bg-white/10"
              >
                {ctaSecondary}
              </Link>
            ) : null}
          </div>

          {trust && trust.length > 0 ? (
            <div
              className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] text-white/90 lg:justify-start"
            >
              {trust.map((t, i) => {
                const Icon =
                  t.icon === "heart"
                    ? Heart
                    : t.icon === "zap"
                      ? Zap
                      : t.icon === "infinity"
                        ? InfinityIcon
                        : Sparkles;
                const tint =
                  t.icon === "heart"
                    ? "text-[#E9C4CA]"
                    : t.icon === "zap"
                      ? "text-[#D4A574]"
                      : t.icon === "infinity"
                        ? "text-[#E9C4CA]"
                        : "text-[#E9C4CA]";
                return (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${tint}`} />
                    {t.label}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* ── WHEEL COLUMN ────────────────────────────────────────── */}
        {/* On mobile the wheel surfaces FIRST (flex-col-reverse) and
            takes a sensible viewport-relative size so it never gets
            clipped by the section edge - even on narrow phones. */}
        <div className="relative z-10 flex w-full items-center justify-center pt-4 lg:flex-1 lg:pt-0">
          {/* Wheel column - vertically centred to hero height; question
              card is absolutely positioned ABOVE the wheel so the wheel
              itself never shifts when the card lands. */}
          <div className="relative mx-auto flex w-full max-w-[min(92vw,560px)] items-center justify-center">
            {/* Sample question card - appears ABOVE the wheel after settle.
                Dismissable via the X-button (revealing the wheel fully). */}
            <AnimatePresence>
              {phase === "settled" && cardOpen ? (
                <motion.div
                  ref={popupRef}
                  initial={{ opacity: 0, y: -16, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.95 }}
                  transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
                  className="absolute inset-x-0 top-[-4%] z-30 mx-auto w-[78%] max-w-[300px] rounded-[24px] border border-[#E9C4CA]/40 bg-[#FBF5F2] p-5 text-[#170E14] shadow-[0_28px_56px_-12px_rgba(14,8,16,0.7)] sm:p-6 lg:w-[88%] lg:max-w-[480px]"
                >
                  {/* Close (X) - sits in the corner above the wheel area. */}
                  <button
                    type="button"
                    onClick={() => setCardOpen(false)}
                    aria-label={isHe ? "סגירה" : "Close"}
                    className="absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#EAE0E3] bg-[#FBF5F2] text-[#4A3A45] transition hover:border-[#B83C4D]/40 hover:bg-[#FBE9EC] hover:text-[#B83C4D]"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="flex items-center gap-3 pe-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B83C4D] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                      <Sparkles className="h-3 w-3" />
                      {landedSlice?.label ?? sampleQuestionType}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8B2638]">
                      {isHe ? "טעימה חיה" : "live taste"}
                    </span>
                  </div>
                  <p
                    className="mt-4 text-[24px] leading-[1.35] text-[#170E14] sm:text-[28px]"
                    style={{
                      fontFamily: "'Frank Ruhl Libre', serif",
                      fontStyle: "italic",
                      fontWeight: 700,
                    }}
                  >
                    {displayedQuestion}
                  </p>

                  {/* Single prominent CTA - "Spin again" actually drops the
                      user straight into th- live game where their next
                      spin (and the rest of the flow) continues. */}
                  <Link
                    href={gameHref}
                    className="group mt-5 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[linear-gradient(110deg,#B83C4D_0%,#8B2638_55%,#3D1F3D_100%)] px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#B83C4D]/30 transition hover:brightness-110"
                  >
                    <RotateCw className="h-4 w-4 transition duration-500 group-hover:rotate-180" />
                    <span>{isHe ? "סיבוב נוסף" : "Spin again"}</span>
                    <ArrowRight
                      className={`h-4 w-4 transition group-hover:translate-x-1 ${
                        isHe ? "rotate-180 group-hover:-translate-x-1" : ""
                      }`}
                    />
                  </Link>
                  <p className="mt-2 text-center text-[14px] text-[#7A6A75]">
                    {isHe
                      ? "הסיבוב הבא ממשיך את הערב - בתוך המשחק עצמו."
                      : "The next spin continues y-ur evening - inside the game itself."}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Production Wheel - identical to the live game.
                550px (≈34.375rem-. Sound muted; auto-spins once via ref.
                All chrome resolved from gameSettings → wheel_configs. */}
            <Wheel
              ref={wheelRef}
              options={effectiveSlices}
              onSettled={(result) => {
                // 2026-05-20 — onSpinStart/onSettled console.log
                // diagnostics removed; the state transition itself
                // (setPhase("settled")) is the source of truth.
                setLandedSlice(effectiveSlices[result.index] ?? null);
                setPhase("settled");
                setCardOpen(true);
              }}
              isSpinSoundEnabled={false}
              pointerColor={resolvedPointerColor}
              pointerOffsetY={resolvedPointerOffsetY}
              innerCircle={resolvedInnerCircle}
              innerCircleColor={resolvedInnerCircleColor}
              innerCircleBorderColor={resolvedInnerCircleBorderColor}
              dividerEnabled={resolvedDividerEnabled}
              dividerColor={resolvedDividerColor}
              dividerWidth={resolvedDividerWidth}
              markerConfig={resolvedMarkerConfig}
              outerBorder={resolvedOuterBorder}
              pointerSvg={resolvedPointerSvg}
              pointerSvgWidth={resolvedPointerSvgWidth}
              pointerSvgHeight={resolvedPointerSvgHeight}
              spinDuration={resolvedSpinDuration}
              spinEasing={resolvedSpinEasing}
              labelRadiusFraction={resolvedLabelFraction}
              wheelSizeRem={34.375}
              wheelSizeRemMax={34.375}
            />
          </div>
        </div>
        </div>
      </GamePageBackground>

      {/* 2026-05-20 — `mio-gradient-shift` keyframes block removed
          along with its only consumer (the CTA shimmer animation
          above). Was an inline <style jsx> island; gone now. */}
    </section>
  );
}

