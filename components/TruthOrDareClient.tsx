"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/navigation";
import { GameLayout } from "./GameLayout";
import { Wheel, type WheelApi } from "./Wheel";
import { type Question, type QuestionType } from "@/lib/game-engine";
import type { GameRow, QuestionRow, WheelConfigRow } from "@/lib/types/database";
import type { GameSettings } from "@/lib/types/settings";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscriptions";
import {
  ASSESSMENT_OFFER_MIN_SPINS,
  FREE_PLAYS_PER_GAME,
  getGuestGamePlays,
  getUserGamePlays,
  grantPostSignupBonus,
  hasGuestLeadCaptured,
  incrementGuestGamePlays,
  incrementUserGamePlays,
} from "@/lib/spins";
import { AssessmentOfferCard } from "@/components/marketing/AssessmentOfferCard";
import {
  fetchEligibility,
  fetchOfferTexts,
  markOfferShown,
  shouldSuppress,
  wasOfferShownThisSession,
  type OfferEligibility,
  type OfferTexts,
} from "@/lib/marketing/assessment-offer";
import { RegistrationModal } from "@/components/RegistrationModal";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { stopSpinSound } from "@/lib/sounds";
import { track } from "@/lib/analytics";
import { useDwellTracking } from "@/hooks/useDwellTracking";
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

  // Dwell-time tracking for this wheel game (admin-analytics-spec §6). Doubles
  // as the Phase-0 end-to-end smoke test of the beacon → intake → analytics
  // pipeline, and is the permanent per-game dwell mount for Phase 1.
  useDwellTracking("games", game.slug);

  const [completedSpins, setCompletedSpins] = useState(0);
  const [current, setCurrent] = useState<Question | null>(null);
  // A.6 — true between the wheel's visible stop and the result popup (the ~1s
  // gap). Disables the spin button so the player can't re-spin during the gap.
  const [resultPending, setResultPending] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ~1s pause between the wheel visibly stopping and the question card appearing.
  const POPUP_DELAY_MS = 1000;
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
  // ── End-of-round-3 CTA (funnel capture, Itzik 2026-06-18) ──────────────────
  // Instead of auto-popping the capture modal the moment the free-play budget
  // (FREE_PLAYS_PER_GAME) is spent, we show a user-initiated "continue" CTA at
  // the emotional peak. Its button opens the SAME capture (SubscriptionModal,
  // mode=lead). `roundGateLocked` mirrors the lock the original gate path
  // intended (free game → false; non-free hard paywall → true). Shared on
  // desktop + mobile; UI is mobile-first. The spin-gating itself is unchanged.
  const [roundGateOpen, setRoundGateOpen] = useState(false);
  const [roundGateLocked, setRoundGateLocked] = useState(false);
  // Set when the budget is spent ON the settling spin, so the CTA appears only
  // AFTER the player closes that round's question (handleNext) — never flashes
  // over it.
  const gatePendingRef = useRef(false);

  // ── Quick-assessment offer: round-6 + exit-intent (Itzik 2026-06-18) ───────
  // Free / games-only players without journey; suppressed if assessment done or
  // journey owned. CRM copy; ONE offer per session (shared global ceiling).
  // Eligibility is fetched once and reused by both triggers.
  const router = useRouter();
  const offerLocale: "he" | "en" = locale === "en" ? "en" : "he";
  const eligibilityRef = useRef<OfferEligibility | null>(null);
  const [eligLoaded, setEligLoaded] = useState(false);
  const spin6HandledRef = useRef(false);
  const pendingExitRef = useRef<string | null>(null);
  const [offerTrigger, setOfferTrigger] = useState<"ingame" | "exitintent" | null>(null);
  const [offerTexts, setOfferTexts] = useState<OfferTexts | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchEligibility().then((e) => {
      if (cancelled) return;
      eligibilityRef.current = e;
      setEligLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Claim the global ceiling and show the offer. Returns false if it couldn't
  // (already shown this session / suppressed / eligibility not loaded yet).
  const requestOffer = useCallback(
    async (trigger: "ingame" | "exitintent"): Promise<boolean> => {
      if (wasOfferShownThisSession()) return false;
      const elig = eligibilityRef.current;
      if (!elig || shouldSuppress(elig)) return false;
      const t = await fetchOfferTexts(offerLocale, trigger);
      if (wasOfferShownThisSession()) return false;
      markOfferShown();
      setOfferTexts(t);
      setOfferTrigger(trigger);
      return true;
    },
    [offerLocale],
  );

  // Round-6 trigger — runs once eligibility is loaded and the threshold is hit.
  useEffect(() => {
    if (completedSpins < ASSESSMENT_OFFER_MIN_SPINS || !eligLoaded) return;
    if (spin6HandledRef.current) return;
    spin6HandledRef.current = true;
    void requestOffer("ingame");
  }, [completedSpins, eligLoaded, requestOffer]);

  // Exit-intent — intercept the in-game back/exit control. Last chance for a
  // player who hasn't met any other offer this session. Falls through to a
  // normal navigation when the offer can't show.
  const handleExitClick = (e: React.MouseEvent) => {
    if (wasOfferShownThisSession()) return; // let the link navigate
    const elig = eligibilityRef.current;
    if (!elig || shouldSuppress(elig)) return; // navigate normally
    e.preventDefault();
    pendingExitRef.current = "/games";
    void requestOffer("exitintent");
  };
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
  // spinSpeed 1-10 maps to duration 6s-1.5s (higher speed = shorter duration).
  // A.6 — extend the total spin by ~2s for more suspense; the wheel also spins
  // FASTER (more rotations, see Wheel.spin fullSpins) so the start feels snappy.
  const SPIN_EXTRA_S = 2;
  const spinDuration =
    (gameSettings ? 6 - (gameSettings.motion.spinSpeed - 1) * (4.5 / 9) : 3.8) +
    SPIN_EXTRA_S;

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

  // ── Analytics: play duration + abandonment (spec §5.5) ────────────────────
  // Wheel games are open-ended (no winner / completion), so per §6 the session
  // end IS the abandonment signal: game_start fires on the first real spin, and
  // game_abandoned (carrying duration_ms + spins) fires when the player leaves.
  const playStartRef = useRef<number | null>(null);
  const playStartedRef = useRef(false);
  const completedSpinsRef = useRef(0);
  completedSpinsRef.current = completedSpins;

  const triggerSpin = useCallback(() => {
    if (!playStartedRef.current) {
      playStartedRef.current = true;
      playStartRef.current = Date.now();
      track("game_start", {
        game_type:   "wheel",
        game_slug:   game.slug,
        player_mode: !!game.player_mode,
      });
    }
    wheelRef.current?.spin();
  }, [game.slug, game.player_mode]);

  // Emit game_abandoned with the elapsed duration when the player leaves a
  // started wheel session (unmount / route change).
  useEffect(() => {
    return () => {
      if (playStartedRef.current && playStartRef.current !== null) {
        track("game_abandoned", {
          game_type:   "wheel",
          game_slug:   game.slug,
          player_mode: !!game.player_mode,
          duration_ms: Date.now() - playStartRef.current,
          spins:       completedSpinsRef.current,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      triggerSpin();
      return;
    }

    // H (free game): a registered user plays a free game with no cap. Guests
    // fall through to the standard 3-spin teaser → RegistrationModal below.
    if (game.is_free && userId) {
      triggerSpin();
      return;
    }

    const slug = game.slug;

    // ── Guest ────────────────────────────────────────────────────────────────
    if (!userId) {
      const used = getGuestGamePlays(slug);

      if (used < FREE_PLAYS_PER_GAME) {
        triggerSpin();
        return;
      }

      // A.7 — the free game is unlocked by REGISTRATION alone (never a purchase).
      // A guest out of free spins is always prompted to register (dismissible),
      // and is NEVER escalated to the paywall — even if they already left a lead.
      if (game.is_free) {
        openRoundGate(false);
        return;
      }

      // Free budget spent - ask for the lead (signup) first.
      if (!hasGuestLeadCaptured() && !leadCaptured) {
        openRoundGate(false);
        return;
      }

      // Lead captured but the user never completed account creation. Hard
      // paywall - they must subscribe (or sign in elsewhere) to continue.
      openRoundGate(true);
      return;
    }

    // ── Logged-in non-subscriber ─────────────────────────────────────────────
    if (completedSpins >= FREE_PLAYS_PER_GAME) {
      openRoundGate(true);
      return;
    }

    triggerSpin();
  };

  // Show the end-of-round CTA (replaces the old auto-pop of SubscriptionModal).
  // `locked` mirrors the lock the gate path intended, carried to the modal when
  // the player taps the CTA button.
  const openRoundGate = (locked: boolean) => {
    setRoundGateLocked(locked);
    setRoundGateOpen(true);
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
      // A.3/A.6 — this callback fires at the wheel's VISIBLE stop (the wheel's
      // transitionend). Reveal the result card ~1s later so the player clearly
      // sees where it landed first. `resultPending` blocks a re-spin in the gap.
      setResultPending(true);
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      popupTimerRef.current = setTimeout(() => {
        setCurrent(q);
        setResultPending(false);
        popupTimerRef.current = null;
      }, POPUP_DELAY_MS);
      setCompletedSpins((c) => c + 1);

      if (subscribed) return;
      // H (free game): registered users aren't play-capped on a free game, so
      // skip counting + the paywall. Guests still count toward the teaser.
      if (game.is_free && userId) return;

      const slug = game.slug;

      // Persist per-game play counter.
      if (!userId) {
        const next = incrementGuestGamePlays(slug);
        // Guest just spent the free budget on THIS spin. Don't interrupt the
        // round — mark the gate pending so the CTA appears right after the
        // player closes this question (handleNext). Lock=false (free game →
        // registration is dismissible).
        if (next >= FREE_PLAYS_PER_GAME && !hasGuestLeadCaptured() && !leadCaptured) {
          gatePendingRef.current = true;
          setRoundGateLocked(false);
        }
      } else {
        void incrementUserGamePlays(createBrowserSupabaseClient(), slug);
        const nextSpins = completedSpins + 1;
        if (nextSpins >= FREE_PLAYS_PER_GAME) {
          // Logged-in non-subscriber spent their per-game budget. Same deferred
          // CTA; lock=true (non-free hard paywall path).
          gatePendingRef.current = true;
          setRoundGateLocked(true);
        }
      }
    },
    [completedSpins, game.player_mode, game.slug, game.is_free, pickNextQuestion, subscribed, userId, leadCaptured, setIsSpinning],
  );

  // Closing a question. If the budget was spent on the round just closed, raise
  // the end-of-round CTA now (so it never flashes over the question).
  const handleNext = () => {
    setCurrent(null);
    if (gatePendingRef.current) {
      gatePendingRef.current = false;
      setRoundGateOpen(true);
    }
  };

  // A.6 — clear the pending result-popup timer on unmount so it never fires
  // setState on an unmounted component.
  useEffect(
    () => () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    },
    [],
  );

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
        onClick={handleExitClick}
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
        disabled={!authReady || !!current || resultPending}
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

      {/* ── End-of-round-3 CTA (funnel capture, Itzik 2026-06-18) ──────────────
          Appears after the player closes the round that spent the free budget
          (or when they tap spin while gated). Experience-led; the button opens
          the existing capture (SubscriptionModal mode=lead). Mobile-first:
          bottom sheet on phones, centered card on desktop. Same logic both. */}
      {roundGateOpen && !current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="round-gate-title"
          dir={locale === "he" ? "rtl" : "ltr"}
          className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setRoundGateOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-gradient-to-br from-[#2a0a3e] to-[#140225] p-6 pt-7 text-center text-white shadow-2xl">
            <button
              type="button"
              onClick={() => setRoundGateOpen(false)}
              aria-label={locale === "he" ? "סגירה" : "Close"}
              className="absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <h2 id="round-gate-title" className="text-2xl font-extrabold leading-tight sm:text-[28px]">
              {locale === "he" ? "הגעתם לרגע הכי טוב" : "You're at the best part"}
            </h2>
            <p className="mt-2 text-[17px] leading-snug text-white/85">
              {locale === "he"
                ? "שלושה סיבובים מאחוריכם, והאווירה כבר בוערת. רוצים לרדת לעומק?"
                : "Three rounds in and the air is already on fire. Want to go deeper?"}
            </p>

            <button
              type="button"
              onClick={() => {
                setRoundGateOpen(false);
                setSubLocked(roundGateLocked);
                setSubOpen(true);
              }}
              className="mt-5 w-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400 px-5 py-3.5 text-base font-bold text-stone-900 shadow-lg transition hover:brightness-105"
            >
              {locale === "he" ? "כן, בואו נמשיך" : "Yes, let's continue"}
            </button>

            <Link
              href="/journey"
              className="mt-4 inline-block text-sm leading-snug text-white/70 underline underline-offset-4 transition hover:text-white"
            >
              {locale === "he"
                ? "החוויה המלאה מחכה לכם — המסע הזוגי של מיאושי, מ-9 ₪ לשבוע"
                : "The full experience awaits — Mioshy's couples journey, from ₪9/week"}
            </Link>
          </div>
        </div>
      ) : null}

      {/* Quick-assessment offer (round 6 OR exit-intent). Non-blocking bottom
          banner; hidden while a question popup is up so it never clashes. On
          exit-intent dismiss we honour the player's original intent (leave). */}
      {offerTrigger && offerTexts && !current ? (
        <AssessmentOfferCard
          trigger={offerTrigger}
          title={offerTexts.title}
          body={offerTexts.body}
          cta={offerTexts.cta}
          dismiss={offerTexts.dismiss}
          locale={offerLocale}
          onAccept={() => {
            setOfferTrigger(null);
            router.push("/journey/assessment");
          }}
          onDismiss={() => {
            const dest = pendingExitRef.current;
            const wasExit = offerTrigger === "exitintent";
            pendingExitRef.current = null;
            setOfferTrigger(null);
            if (wasExit && dest) router.push(dest);
          }}
        />
      ) : null}

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
        onClick={handleExitClick}
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
