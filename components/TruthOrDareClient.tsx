"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";
import { GameLayout } from "./GameLayout";
import { Wheel, type WheelApi } from "./Wheel";
import { type Question, type QuestionType } from "@/lib/game-engine";
import type { GameRow, QuestionRow, WheelConfigRow } from "@/lib/types/database";
import type { GameSettings } from "@/lib/types/settings";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscriptions";
import {
  FREE_PLAYS_PER_GAME,
  getGuestGamePlays,
  getUserGamePlays,
  grantPostSignupBonus,
  hasGuestLeadCaptured,
  incrementGuestGamePlays,
  incrementUserGamePlays,
} from "@/lib/spins";
import { RegistrationModal } from "@/components/RegistrationModal";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { stopSpinSound } from "@/lib/sounds";
// 2026-05-20 — read the wheel-spin setter from the GameSurfaceShell
// context provider so the ambient blob animations on GamePageBackground
// only run while the wheel is actively spinning. Outside the shell
// (e.g. snakes-only games), the hook returns a noop setter, so this
// integration is safe to use regardless of wrapping.
import { useWheelSpin } from "@/components/game/WheelSpinContext";
import { QuestionPopup } from "@/components/game/QuestionPopup";
import { TutorialPopup } from "@/components/game/TutorialPopup";

export function TruthOrDareClient({
  game,
  wheel,
  questions,
  transparent = false,
  gameSettings,
}: {
  game: GameRow;
  wheel: WheelConfigRow;
  questions: QuestionRow[];
  /** When true, GameLayout renders without its own background image (parent supplies the bg). */
  transparent?: boolean;
  /** Visual settings from game_settings table. Falls back to wheel_configs values when absent. */
  gameSettings?: GameSettings | null;
}) {
  const t = useTranslations("game");
  const locale = useLocale();
  const wheelRef = useRef<WheelApi>(null);
  // 2026-05-20 — setter for the GameSurfaceShell wheel-spin context.
  // Toggled true on Wheel.onSpinStart, back to false on Wheel.onSettled.
  // Inside the shell, this controls the `frozen` state of the ambient
  // blobs in GamePageBackground. Outside the shell (e.g. snakes pages),
  // the hook returns a noop setter — no observable effect.
  const { setIsSpinning } = useWheelSpin();
  const gameTitle =
    locale === "he" ? (game.name_he ?? game.name_en ?? "") : (game.name_en ?? game.name_he ?? "");

  const [completedSpins, setCompletedSpins] = useState(0);
  const [current, setCurrent] = useState<Question | null>(null);
  const [spinSoundOn, setSpinSoundOn] = useState(true);
  const [players, setPlayers] = useState<string[]>([]);
  const [playerStarted, setPlayerStarted] = useState(false);
  const [playerDraft, setPlayerDraft] = useState("");

  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subLocked, setSubLocked] = useState(false);
  /** Local cache of whether the post-signup +3 bonus has been consumed for
   *  this game. When true, the paywall shows at play #{FREE_PLAYS_PER_GAME}+1
   *  (no more bonus); when false we grant the bonus right after signup and
   *  reset plays_used to 0 so the user gets a fresh 3-play window. */
  const [bonusConsumed, setBonusConsumed] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const authWaiterRef = useRef<{
    resolve: (uid: string | null) => void;
  } | null>(null);

  // ── Map GameSettings → Wheel props ──────────────────────────────────────
  // spinSpeed 1-10 maps to duration 6s-1.5s (higher speed = shorter duration)
  const spinDuration = gameSettings
    ? 6 - (gameSettings.motion.spinSpeed - 1) * (4.5 / 9)
    : 3.8;

  const EASING_MAP: Record<string, number[] | string> = {
    linear:       "linear",
    "ease-in":    [0.55, 0, 1, 0.45],
    "ease-out":   [0.12, 0.8, 0.12, 1],
    "ease-in-out":[0.45, 0, 0.55, 1],
  };
  const spinEasing = gameSettings
    ? (EASING_MAP[gameSettings.motion.easing] ?? [0.12, 0.8, 0.12, 1])
    : [0.12, 0.8, 0.12, 1];

  const outerBorder = gameSettings?.border ?? undefined;

  // ── Wheel size + label position: gameSettings.wheel takes priority over
  //    the legacy wheel_configs.marker_config values ─────────────────────
  const wheelSizeRemFromConfig =
    typeof (wheel.marker_config as Record<string, unknown>)?.wheel_size_rem === "number"
      ? (wheel.marker_config as Record<string, number>).wheel_size_rem
      : 22;
  const labelFractionFromConfig =
    typeof (wheel.marker_config as Record<string, unknown>)?.label_radius_fraction === "number"
      ? (wheel.marker_config as Record<string, number>).label_radius_fraction
      : 0.72;

  const resolvedSizeRem    = gameSettings?.wheel?.sizeRem    ?? wheelSizeRemFromConfig;
  const resolvedSizeRemMax = gameSettings?.wheel?.sizeRemMax ?? undefined; // undefined = fixed size (no responsive scaling)
  const resolvedLabelFraction = gameSettings?.wheel?.labelRadiusFraction ?? labelFractionFromConfig;
  const centerShadow = gameSettings?.wheel?.centerShadow;
  const dividerShadow = gameSettings?.wheel?.dividerShadow;

  // ── Wheel shape: only "circle" and "square" are implemented; "custom" falls back to circle ──
  const wheelShape =
    gameSettings?.shape?.enabled && gameSettings.shape.type !== "custom"
      ? (gameSettings.shape.type as "circle" | "square")
      : "circle";
  const labelFontSizePx  = gameSettings?.wheel?.labelFontSizePx ?? 12;
  const labelColor       = gameSettings?.wheel?.labelColor ?? "#ffffff";
  const labelOutline     = gameSettings?.wheel?.labelOutline;
  const labelOrientation = gameSettings?.wheel?.labelOrientation ?? "tangential";
  const pointerSvg       = gameSettings?.wheel?.pointerSvg;
  const pointerSvgWidth  = gameSettings?.wheel?.pointerSvgWidth;
  const pointerSvgHeight = gameSettings?.wheel?.pointerSvgHeight;

  // Gap (px) between wheel and its neighbours (title above, button below).
  // Large enough to visually clear the pointer tip + marker dot overflow.
  const wheelGapPx = gameSettings?.wheelGapPx ?? 32;

  // ── Wheel colors: gameSettings.wheel takes priority over legacy wheel_configs ──
  const resolvedPointerColor =
    gameSettings?.wheel?.pointerColor ?? wheel.pointer_color ?? "#ffffff";
  const resolvedPointerOffsetY = gameSettings?.wheel?.pointerOffsetY ?? 0;
  const resolvedInnerCircle =
    gameSettings?.wheel?.innerCircle?.enabled ?? wheel.inner_circle ?? true;
  const resolvedInnerCircleColor =
    gameSettings?.wheel?.innerCircle?.fillColor ?? wheel.inner_circle_color ?? "#fafafa";
  const resolvedInnerCircleBorderColor =
    gameSettings?.wheel?.innerCircle?.borderColor ?? wheel.inner_circle_border_color ?? "#e5e5e5";
  const resolvedDividerEnabled =
    gameSettings?.wheel?.divider?.enabled ?? wheel.divider_enabled ?? wheel.show_divider ?? true;
  const resolvedDividerColor =
    gameSettings?.wheel?.divider?.color ?? wheel.divider_color ?? "#ffffff";
  const resolvedDividerWidth =
    gameSettings?.wheel?.divider?.width ?? wheel.divider_width ?? 2;
  // Markers priority:
  //   1. gameSettings.wheel.markers - only when type is "circle" or "svg_icon"
  //      (type "none" = "no override"; fall through to wheel_configs legacy data)
  //   2. wheel_configs.marker_config - legacy fallback (set via GameForm)
  //
  // This prevents DEFAULT_GAME_SETTINGS markers.type="none" from silently
  // zeroing out circles that were configured in wheel_configs before
  // game_settings existed for the game.
  const resolvedMarkerConfig = {
    ...(wheel.marker_config as Record<string, unknown> ?? {}),
    ...(gameSettings?.wheel?.markers && gameSettings.wheel.markers.type !== "none"
      ? {
          marker_type:     gameSettings.wheel.markers.type,
          marker_color:    gameSettings.wheel.markers.color,
          marker_size:     gameSettings.wheel.markers.size,
          marker_count:    gameSettings.wheel.markers.count,
          marker_position: gameSettings.wheel.markers.position,
          svg_path_d:      gameSettings.wheel.markers.svgPath ?? "",
        }
      : {}),
  };

  // ── DIAG 2026-05-05 ────────────────────────────────────────────────────
  // Trace the exact values reaching the production Wheel so we can compare
  // them to what the admin slider claims to save. If `labelRadiusFraction`
  // here ≠ what the admin saved, the bug is in the save/load layer, not
  // in Wheel.tsx. If they match but the wheel still looks wrong, the
  // issue is in Wheel rendering. Look for [TruthOrDareClient/DIAG].
  if (typeof window !== "undefined") {
    console.log("[TruthOrDareClient/DIAG] BUILD=2026-05-05-wheel-trace v1", {
      gameSlug: game.slug,
      hasGameSettings: !!gameSettings,
      // What the admin saved in game_settings.settings.wheel:
      gs_wheel_sizeRem:                gameSettings?.wheel?.sizeRem,
      gs_wheel_sizeRemMax:             gameSettings?.wheel?.sizeRemMax,
      gs_wheel_labelRadiusFraction:    gameSettings?.wheel?.labelRadiusFraction,
      gs_wheel_labelOrientation:       gameSettings?.wheel?.labelOrientation,
      gs_wheel_labelFontSizePx:        gameSettings?.wheel?.labelFontSizePx,
      gs_wheel_innerCircle_enabled:    gameSettings?.wheel?.innerCircle?.enabled,
      gs_wheel_innerCircle_fillColor:  gameSettings?.wheel?.innerCircle?.fillColor,
      gs_wheel_innerCircle_borderColor:gameSettings?.wheel?.innerCircle?.borderColor,
      gs_wheel_pointerColor:           gameSettings?.wheel?.pointerColor,
      gs_wheel_pointerOffsetY:         gameSettings?.wheel?.pointerOffsetY,
      gs_wheel_pointerSvg_present:     !!gameSettings?.wheel?.pointerSvg,
      gs_wheel_pointerSvgWidth:        gameSettings?.wheel?.pointerSvgWidth,
      gs_wheel_pointerSvgHeight:       gameSettings?.wheel?.pointerSvgHeight,
      // Legacy values from wheel_configs.marker_config (fallback chain):
      legacy_wheel_size_rem:           wheelSizeRemFromConfig,
      legacy_label_radius_fraction:    labelFractionFromConfig,
      legacy_inner_circle:             wheel.inner_circle,
      legacy_inner_circle_color:       wheel.inner_circle_color,
      legacy_inner_circle_border:      wheel.inner_circle_border_color,
      legacy_pointer_color:            wheel.pointer_color,
      // RESOLVED - what actually goes into <Wheel>:
      resolved_sizeRem:                resolvedSizeRem,
      resolved_sizeRemMax:             resolvedSizeRemMax,
      resolved_labelRadiusFraction:    resolvedLabelFraction,
      resolved_labelOrientation:       labelOrientation,
      resolved_labelFontSizePx:        labelFontSizePx,
      resolved_innerCircle:            resolvedInnerCircle,
      resolved_innerCircleColor:       resolvedInnerCircleColor,
      resolved_innerCircleBorder:      resolvedInnerCircleBorderColor,
      resolved_pointerColor:           resolvedPointerColor,
      resolved_pointerOffsetY:         resolvedPointerOffsetY,
      resolved_markerConfig:           resolvedMarkerConfig,
    });
  }

  const options = useMemo(() => {
    const base = (wheel.slices ?? []).map((s) => ({
      type: s.question_type as QuestionType,
      label: locale === "he" ? s.label_he : s.label_en,
      color: s.color,
    }));
    if (!game.player_mode) return base;
    if (!playerStarted || players.length === 0) return [];
    const reps = (wheel.player_config as { player_repetitions?: number } | undefined)
      ?.player_repetitions ?? 8;
    const palette = [
      "#22c55e",
      "#3b82f6",
      "#f97316",
      "#a855f7",
      "#ef4444",
      "#06b6d4",
      "#eab308",
      "#ec4899",
    ];
    const perPlayer = Math.max(1, Number(reps) || 8);
    return players.flatMap((p, i) =>
      Array.from({ length: perPlayer }, () => ({
        type: p as QuestionType,
        label: p,
        color: palette[i % palette.length],
      })),
    );
  }, [wheel.slices, wheel.player_config, locale, game.player_mode, players, playerStarted]);

  const textFor = useCallback(
    (q: Question) => (locale === "he" ? q.text_he : q.text_en),
    [locale],
  );

  // ── Spin gate ─────────────────────────────────────────────────────────────
  // 1. subscribed         → unlimited
  // 2. guest, plays < 3   → free
  // 3. guest, plays >= 3 && no lead yet → lead signup modal
  // 4. guest, lead captured but still not logged in → paywall (locked)
  // 5. logged-in, plays < 3 → free
  // 6. logged-in, plays >= 3 → paywall (locked)
  const handleSpinClick = () => {
    if (!authReady) return;

    if (subscribed) {
      wheelRef.current?.spin();
      return;
    }

    // H (free game): a registered user plays a free game with no cap. Guests
    // fall through to the standard 3-spin teaser → RegistrationModal below.
    if (game.is_free && userId) {
      wheelRef.current?.spin();
      return;
    }

    const slug = game.slug;

    // ── Guest ────────────────────────────────────────────────────────────────
    if (!userId) {
      const used = getGuestGamePlays(slug);

      if (used < FREE_PLAYS_PER_GAME) {
        wheelRef.current?.spin();
        return;
      }

      // A.7 — the free game is unlocked by REGISTRATION alone (never a purchase).
      // A guest out of free spins is always prompted to register (dismissible),
      // and is NEVER escalated to the paywall — even if they already left a lead.
      if (game.is_free) {
        setSubLocked(false);
        setSubOpen(true);
        return;
      }

      // Free budget spent - ask for the lead (signup) first.
      if (!hasGuestLeadCaptured() && !leadCaptured) {
        setSubLocked(false);
        setSubOpen(true);
        return;
      }

      // Lead captured but the user never completed account creation. Hard
      // paywall - they must subscribe (or sign in elsewhere) to continue.
      setSubLocked(true);
      setSubOpen(true);
      return;
    }

    // ── Logged-in non-subscriber ─────────────────────────────────────────────
    if (completedSpins >= FREE_PLAYS_PER_GAME) {
      setSubLocked(true);
      setSubOpen(true);
      return;
    }

    wheelRef.current?.spin();
  };

  const lastTwoTypesRef = useRef<string[]>([]);
  const [forbiddenType, setForbiddenType] = useState<string | null>(null);

  const levels = useMemo(() => ["light", "flirty", "deep"] as const, []);
  type Level = (typeof levels)[number];

  const cycleRef = useRef<
    Map<
      string,
      {
        levelIdx: number;
        remainingByLevel: Record<Level, string[]>;
        allByLevel: Record<Level, string[]>;
        lastId: string | null;
      }
    >
  >(new Map());

  const pickNextQuestion = useCallback(
    (category: string) => {
      const pool = (questions ?? []).filter(
        (q) => q.type === category && q.is_active,
      );
      if (pool.length === 0) return null;

      const byLevel: Record<Level, string[]> = { light: [], flirty: [], deep: [] };
      for (const q of pool) {
        const lvl = (levels.includes(q.level as Level)
          ? (q.level as Level)
          : "light") as Level;
        byLevel[lvl].push(q.id);
      }

      const existing = cycleRef.current.get(category);
      const allByLevel = existing?.allByLevel ?? byLevel;
      const remainingByLevel =
        existing?.remainingByLevel ?? {
          light: [...allByLevel.light],
          flirty: [...allByLevel.flirty],
          deep: [...allByLevel.deep],
        };
      let levelIdx = existing?.levelIdx ?? 0;
      const lastId = existing?.lastId ?? null;

      // advance levels until we find one with remaining questions
      let safety = 0;
      while (
        safety < 6 &&
        levelIdx < levels.length &&
        remainingByLevel[levels[levelIdx]].length === 0
      ) {
        levelIdx += 1;
        safety += 1;
      }

      // if all levels exhausted, reset cycle
      if (levelIdx >= levels.length) {
        remainingByLevel.light = [...allByLevel.light];
        remainingByLevel.flirty = [...allByLevel.flirty];
        remainingByLevel.deep = [...allByLevel.deep];
        levelIdx = 0;
      }

      const lvl = levels[levelIdx];
      let remaining = remainingByLevel[lvl];
      if (remaining.length === 0) {
        // nothing in this level; recurse by advancing next tick
        cycleRef.current.set(category, {
          levelIdx: levelIdx + 1,
          remainingByLevel,
          allByLevel,
          lastId,
        });
        return pickNextQuestion(category);
      }

      // avoid immediate repeat when possible
      let candidates = remaining;
      if (lastId && remaining.length > 1) {
        const filtered = remaining.filter((id) => id !== lastId);
        if (filtered.length) candidates = filtered;
      }

      const chosenId =
        candidates[Math.floor(Math.random() * candidates.length)];
      remaining = remaining.filter((id) => id !== chosenId);
      remainingByLevel[lvl] = remaining;

      cycleRef.current.set(category, {
        levelIdx,
        remainingByLevel,
        allByLevel,
        lastId: chosenId,
      });

      const row = pool.find((q) => q.id === chosenId)!;
      return {
        id: row.id,
        type: row.type as QuestionType,
        text_he: row.text_he,
        text_en: row.text_en,
      } satisfies Question;
    },
    [questions, levels],
  );

  const handleSettled = useCallback(
    ({ type }: { index: number; type: QuestionType }) => {
      // 2026-05-20 — wheel landed → release the "spinning" flag so
      // GamePageBackground freezes its blobs again until the next
      // spin. Order matters: flip the flag BEFORE any state changes
      // that might cause a re-render so the frozen blobs are the
      // first thing the layout commits with the new question.
      setIsSpinning(false);
      const actualType = String(type);
      lastTwoTypesRef.current = [...lastTwoTypesRef.current.slice(-1), actualType];
      if (
        lastTwoTypesRef.current.length === 2 &&
        lastTwoTypesRef.current[0] === lastTwoTypesRef.current[1]
      ) {
        setForbiddenType(lastTwoTypesRef.current[0]);
      } else {
        setForbiddenType(null);
      }

      // Show question matching the slice where the wheel stopped.
      const category = game.player_mode ? "custom" : actualType;
      const q = pickNextQuestion(category) ?? pickNextQuestion(actualType);
      if (!q) return;
      setCurrent(q);
      setCompletedSpins((c) => c + 1);

      if (subscribed) return;
      // H (free game): registered users aren't play-capped on a free game, so
      // skip counting + the paywall. Guests still count toward the teaser.
      if (game.is_free && userId) return;

      const slug = game.slug;

      // Persist per-game play counter.
      if (!userId) {
        const next = incrementGuestGamePlays(slug);
        // Guest just hit the budget → pop the lead signup modal when they
        // try to spin again. We don't interrupt the current round.
        if (next >= FREE_PLAYS_PER_GAME && !hasGuestLeadCaptured() && !leadCaptured) {
          setSubLocked(false);
          setSubOpen(true);
        }
      } else {
        void incrementUserGamePlays(createBrowserSupabaseClient(), slug);
        const nextSpins = completedSpins + 1;
        if (nextSpins >= FREE_PLAYS_PER_GAME) {
          // Logged-in non-subscriber hit their per-game budget → hard paywall
          // on the next click.
          setSubLocked(true);
          setSubOpen(true);
        }
      }
    },
    [completedSpins, game.player_mode, game.slug, game.is_free, pickNextQuestion, subscribed, userId, leadCaptured, setIsSpinning],
  );

  const handleNext = () => setCurrent(null);

  // Stop sound whenever a question is revealed (spin ended → card shows)
  useEffect(() => {
    if (current) stopSpinSound();
  }, [current]);

  // Stop sound on unmount (user navigates away mid-spin)
  useEffect(() => {
    return () => { stopSpinSound(); };
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      const uid = user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const active = await hasActiveSubscription(supabase, uid);
        if (!cancelled) setSubscribed(active);
        const plays = await getUserGamePlays(supabase, game.slug);
        if (!cancelled) {
          setCompletedSpins(plays.plays_used);
          setBonusConsumed(plays.post_signup_bonus_used);
        }
      } else {
        setCompletedSpins(getGuestGamePlays(game.slug));
      }
      setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [game.slug]);

  // ── Layout: read from game settings, default to "centered" ────────────────
  const pageLayout = gameSettings?.layout ?? "centered";

  // ── Shared JSX pieces ───────────────────────────────────────────────────────

  /** Top bar: full-width centred logo. Per Itzik 2026-05-06 the mobile
   *  utility buttons (Back / Sound) moved from above the wheel to BELOW
   *  the spin button — see `mobileUtilityButtons` below. On desktop the
   *  Back/Sound buttons live in the fixed bottom corners (rendered at
   *  the bottom of this component). */
  const topBar = (
    <div className="flex w-full shrink-0 flex-col items-center gap-2 px-1">
      {/* Logo - full-width centred, prominent */}
      <div className="flex w-full justify-center py-1">
        <Image
          src="/mioshy-white.svg"
          alt="Mioshy"
          width={140}
          height={52}
          className="opacity-90 drop-shadow-md select-none pointer-events-none"
          priority
        />
      </div>
    </div>
  );

  /** Mobile-only utility buttons (Back + Sound). Rendered UNDER the spin
   *  button on mobile so the visual hierarchy is logo → wheel → spin →
   *  secondary actions. Per Itzik 2026-05-06. Desktop has its own
   *  fixed-corner versions, so this block is `md:hidden`. */
  const mobileUtilityButtons = (
    <div className="flex w-full items-center justify-between md:hidden">
      <Link
        href="/games"
        className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
      >
        {t("back")}
      </Link>
      <button
        type="button"
        onClick={() => setSpinSoundOn((m) => !m)}
        className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
      >
        {spinSoundOn ? t("spinSoundOn") : t("spinSoundOff")}
      </button>
    </div>
  );

  /** Wheel or player-mode setup card */
  const wheelOrSetup = game.player_mode && !playerStarted ? (
    <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <p className="text-sm font-semibold text-white">Enter player names</p>
      <p className="mt-1 text-xs text-white/70">Add at least 2 players.</p>
      <div className="mt-3 flex gap-2">
        <input
          value={playerDraft}
          onChange={(e) => setPlayerDraft(e.target.value)}
          className="w-full rounded-2xl border border-white/20 bg-black/20 px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
          placeholder="Name"
        />
        <button
          type="button"
          className="min-h-[44px] rounded-2xl bg-white/15 px-4 text-sm font-semibold text-white"
          onClick={() => {
            const n = playerDraft.trim();
            if (!n) return;
            setPlayers((p) => [...p, n]);
            setPlayerDraft("");
          }}
        >
          Add
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {players.map((p) => (
          <span key={p} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            {p}
          </span>
        ))}
      </div>
      <button
        type="button"
        disabled={players.length < 2}
        className="mt-4 min-h-[44px] w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
        onClick={() => setPlayerStarted(true)}
      >
        Start
      </button>
    </div>
  ) : (
    <Wheel
      ref={wheelRef}
      options={options}
      onSettled={handleSettled}
      // 2026-05-20 — spin starts → unfreeze blobs on GamePageBackground.
      // `handleSettled` re-freezes when the wheel lands. Outside a
      // GameSurfaceShell the setter is a noop (default context value).
      onSpinStart={() => setIsSpinning(true)}
      disabled={!authReady}
      isSpinSoundEnabled={spinSoundOn}
      pointerColor={resolvedPointerColor}
      pointerOffsetY={resolvedPointerOffsetY}
      borderColor={wheel.border_color}
      innerCircle={resolvedInnerCircle}
      innerCircleColor={resolvedInnerCircleColor}
      innerCircleBorderColor={resolvedInnerCircleBorderColor}
      dividerColor={resolvedDividerColor}
      dividerEnabled={resolvedDividerEnabled}
      dividerWidth={resolvedDividerWidth}
      markerConfig={resolvedMarkerConfig}
      forbiddenType={forbiddenType}
      spinDuration={spinDuration}
      spinEasing={spinEasing}
      outerBorder={outerBorder}
      wheelSizeRem={resolvedSizeRem}
      wheelSizeRemMax={resolvedSizeRemMax}
      // Budget = GameLayout padding (32) + topBar (60) + mt-2 (8) + title (40)
      //        + 2× wheelGapPx spacers + button (44) + breathing room (8)
      viewportBudgetPx={192 + wheelGapPx * 2}
      labelRadiusFraction={resolvedLabelFraction}
      centerShadow={centerShadow}
      dividerShadow={dividerShadow}
            labelFontSizePx={labelFontSizePx}
            labelColor={labelColor}
            labelOutline={labelOutline}
            labelOrientation={labelOrientation}
            wheelShape={wheelShape}
            pointerSvg={pointerSvg}
            pointerSvgWidth={pointerSvgWidth}
            pointerSvgHeight={pointerSvgHeight}
    />
  );

  /** Spin button */
  const spinControls = (
    <div className="w-full max-w-md space-y-3">
      <button
        type="button"
        onClick={handleSpinClick}
        disabled={!authReady || !!current}
        className="min-h-[44px] w-full rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-fuchsia-900/40 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:text-lg"
        style={{ fontFamily: "var(--font-heading-hebrew), var(--font-heading-latin), system-ui" }}
      >
        {t("spin")}
      </button>
    </div>
  );

  return (
    <GameLayout
      backgroundSrc={transparent ? false : undefined}
      showVignette={!transparent}
    >
      {/* First-visit tutorial — per game, shows once per device then stays
          reopenable via the corner button. Renders this game's own
          instructions when set, else the generic fallback. Self-gates on
          localStorage so safe to mount unconditionally. */}
      <TutorialPopup instructions={game.instructions} gameSlug={game.slug} />
      {pageLayout === "side-by-side" ? (
        /* ── SIDE-BY-SIDE LAYOUT ─────────────────────────────────────────────
           Desktop (≥ md): wheel on the left, controls on the right.
           Mobile (< md):  stacks exactly like the centered layout.
        ──────────────────────────────────────────────────────────────────── */
        <div className="flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-4 px-3 sm:px-5">
          {/* Top bar - full width */}
          {topBar}

          {/* Main content area */}
          <div className="flex flex-1 flex-col items-center gap-6 md:flex-row md:items-center md:gap-10">
            {/* Left column: wheel only - the logo lives inside `topBar`
                above (rendered at line ~586), so we don't render it
                again here. The earlier `{logo}` reference was a stale
                pointer left behind when the logo moved into topBar. */}
            <div className="flex flex-col items-center gap-4 md:flex-1">
              {wheelOrSetup}
            </div>

            {/* Right column: game title (big) + spin controls + mobile utilities */}
            <div className="flex w-full flex-col items-center justify-center gap-6 md:flex-1 md:items-start">
              <div className="text-center md:text-start">
                <h1
                  className="text-2xl font-bold leading-tight text-white drop-shadow-md sm:text-3xl md:text-4xl"
                  style={{ fontFamily: "var(--font-heading-hebrew), var(--font-heading-latin), system-ui" }}
                >
                  {gameTitle}
                </h1>
              </div>
              {spinControls}
              {/* Back/Sound — mobile only, below spin */}
              {mobileUtilityButtons}
            </div>
          </div>
        </div>
      ) : (
        /* ── CENTERED LAYOUT (default) ───────────────────────────────────────
           Order: top bar → big game title → wheel → spin button
           Logo moved into the top bar; game title is the main visual anchor.
           Spacing is kept compact so everything fits on a laptop viewport.
        ──────────────────────────────────────────────────────────────────── */
        <div className="flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center px-2 sm:px-0">
          {/* Top bar */}
          {topBar}

          {/* Game title */}
          <div className="mt-2 w-full shrink-0 px-4 text-center">
            <h1
              className="text-2xl font-bold leading-tight text-white drop-shadow-md sm:text-3xl lg:text-4xl line-clamp-2"
              style={{ fontFamily: "var(--font-heading-hebrew), var(--font-heading-latin), system-ui" }}
            >
              {gameTitle}
            </h1>
          </div>

          {/* Fixed spacer above wheel - clears pointer tip overflow */}
          <div className="shrink-0" style={{ height: wheelGapPx }} />

          {/* Wheel */}
          <div className="w-full flex justify-center">{wheelOrSetup}</div>

          {/* Fixed spacer below wheel - clears marker dot overflow */}
          <div className="shrink-0" style={{ height: wheelGapPx }} />

          {/* Spin button - sticky to the bottom of the viewport so it
              ALWAYS stays visible, even when the wheel + spacers push
              the natural-flow position below the fold. Itzik 2026-05-06:
              previously the button was getting clipped on shorter
              laptop viewports while the less-important Back / Sound
              buttons (corner-fixed) remained visible. */}
          <div
            className="sticky bottom-3 z-20 mt-auto flex w-full shrink-0 flex-col items-center gap-2 pb-[max(0px,env(safe-area-inset-bottom))]"
            style={{ pointerEvents: "none" }}
          >
            <div style={{ pointerEvents: "auto" }} className="w-full max-w-md">
              {spinControls}
            </div>
            {/* Back/Sound — mobile only, below spin. pointer-events:auto
                so taps register; the empty wrapper above this block is
                pointer-events:none to let the wheel scroll through. */}
            <div style={{ pointerEvents: "auto" }} className="w-full max-w-md">
              {mobileUtilityButtons}
            </div>
          </div>
        </div>
      )}

      {/* ── Question popup - rendered fixed over everything ── */}
      {(() => {
        const sliceColor =
          options.find((o) => o.type === current?.type)?.color ??
          (wheel.category_colors as Record<string, string> | undefined)?.[current?.type ?? ""] ??
          "#c084fc";
        const categoryLabel =
          options.find((o) => o.type === current?.type)?.label ??
          current?.type ??
          "";
        return (
          <QuestionPopup
            question={
              current
                ? {
                    type: current.type,
                    text: textFor(current),
                    categoryLabel,
                    accentColor: sliceColor,
                  }
                : null
            }
            onClose={handleNext}
            labelSpinAgain={t("spinAgain")}
            labelClose={t("closePopup")}
            isRtl={locale === "he"}
          />
        );
      })()}

      <RegistrationModal
        open={regOpen}
        onOpenChange={(v) => setRegOpen(v)}
        onSuccess={async () => {
          const supabase = createBrowserSupabaseClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const uid = user?.id ?? null;
          setUserId(uid);
          if (uid) {
            const plays = await getUserGamePlays(supabase, game.slug);
            setCompletedSpins(plays.plays_used);
            setBonusConsumed(plays.post_signup_bonus_used);
          }
          authWaiterRef.current?.resolve(uid);
          authWaiterRef.current = null;
          setRegOpen(false);
        }}
      />

      {/* ── Desktop corner buttons - fixed position, hidden on mobile ── */}
      <Link
        href="/games"
        className="hidden md:flex fixed bottom-5 right-5 z-30 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
      >
        {t("back")}
      </Link>
      <button
        type="button"
        onClick={() => setSpinSoundOn((m) => !m)}
        className="hidden md:flex fixed bottom-5 left-5 z-30 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
      >
        {spinSoundOn ? t("spinSoundOn") : t("spinSoundOff")}
      </button>

      <SubscriptionModal
        open={subOpen}
        onOpenChange={(v) => {
          setSubOpen(v);
        }}
        locked={subLocked}
        userId={userId}
        gameSlug={game.slug}
        onRequireAuth={async () => {
          if (userId) return userId;
          setRegOpen(true);
          return await new Promise<string | null>((resolve) => {
            authWaiterRef.current = { resolve };
          });
        }}
        onSubscribed={() => {
          setSubscribed(true);
          setSubLocked(false);
          setSubOpen(false);
        }}
        // ── Mode selection ─────────────────────────────────────────────────
        // "lead" while the user has never provided their details - guests on
        //   play 4+ land here, giving them a chance to sign up for +3 more.
        // "paywall" once they have a lead / are logged-in / bonus consumed.
        mode={
          // A.7 — the free game never shows the purchase ("paywall") UI; the
          // modal is always registration ("lead"). Registered users bypass the
          // modal entirely (handleSpinClick/handleSettled return early).
          game.is_free
            ? "lead"
            : !userId && !leadCaptured && !hasGuestLeadCaptured()
              ? "lead"
              : "paywall"
        }
        onLeadSaved={(_, newUserId) => {
          setLeadCaptured(true);
          setSubOpen(false);
          if (newUserId && !userId) {
            setUserId(newUserId);
            // Grant the one-time post-signup +3 bonus for this game: reset
            // plays_used to 0 server-side and mark the flag. We also clear
            // the guest counter locally so the UI doesn't gate the next
            // click before the server state catches up.
            (async () => {
              const supabase = createBrowserSupabaseClient();
              if (!bonusConsumed) {
                await grantPostSignupBonus(supabase, game.slug);
                setBonusConsumed(true);
              }
              // Re-read - this is the authoritative counter from here on.
              const plays = await getUserGamePlays(supabase, game.slug);
              setCompletedSpins(plays.plays_used);
              setBonusConsumed(plays.post_signup_bonus_used);
            })();
          }
        }}
      />
    </GameLayout>
  );
}
