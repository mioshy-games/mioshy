"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import confetti from "canvas-confetti";
import { SnakesBoard } from "@/components/game/snakes/SnakesBoard";
import { Dice } from "@/components/game/snakes/Dice";
import { QuestionModal } from "@/components/game/snakes/QuestionModal";
import { useSnakesGame } from "@/hooks/useSnakesGame";
import type { GameAdapter } from "@/lib/snakes/adapter";
import type { GamePlayer } from "@/lib/snakes/types";
import { cellToBoardPercent } from "@/lib/snakes/boardUtils";
import { playSound } from "@/lib/sounds";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
// Gating (mirrors TruthOrDareClient - same lead/paywall flow per Itzik
// 2026-05-06): non-subscribers get FREE_PLAYS_PER_GAME (=3) dice rolls
// before the lead modal pops, and another batch after signup before the
// hard paywall.
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

// Slug used for snakes & ladders in the per-game play counter. The snakes
// game has no row in the `games` table - it lives at /game, not /games/:slug
// - so we mint a stable slug here to namespace its play counter alongside
// every wheel-based game's slug.
const SNAKES_PLAYS_SLUG = "snakes-ladders";

/**
 * SnakesGameBoard - adapter-agnostic game screen.
 *
 * Layout (April 2026 redesign - see product brief with colour-coded zones):
 *
 *   • Green zone - top: Mioshy logo + game title + subtitle.
 *   • Yellow zone - board (large, responsive; vertical on mobile).
 *   • White zone - dice surface (desktop only; on mobile the dice
 *     shows as a floating popup overlay on the board).
 *   • Blue zone - players list (active + pending-approval), each with
 *     avatar icon and a host badge for the room host.
 *   • Red zone - exit button returning to the /games catalog (not the
 *     snakes lobby).
 *
 * Responsive:
 *   • Desktop (≥ md): CSS grid with a 18rem sidebar on the right (RTL
 *     handled by grid column ordering - sidebar sits in the first grid
 *     column which maps to the visual right in RTL), and the board
 *     filling the second column.
 *   • Mobile (< md): flex-col stack - header on top, board in the
 *     middle (with popup dice overlay), players list below.
 *
 * Extras:
 *   • Confetti fireworks for 3s whenever any player climbs a ladder.
 *   • Win overlay stays on top of everything else.
 */
export function SnakesGameBoard({
  adapter,
  onPlayAgain,
  onExit,
}: {
  adapter: GameAdapter;
  onPlayAgain?: () => void | Promise<void>;
  onExit?: () => void | Promise<void>;
}) {
  const t = useTranslations("snakesGame");
  const locale = useLocale();
  const isHe = locale === "he";
  const { room, players, myPlayerId, updateGameState, error, mode } = adapter;

  const { state, config, currentPlayer, isMyTurn, roll, answer } = useSnakesGame({
    room,
    players,
    myPlayerId,
    updateGameState,
  });

  const [toast, setToast] = useState<string | null>(null);
  const lastTurnPlayerId = useRef<string | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const lastLogLenRef = useRef<number>(-1); // -1 = uninitialised; seeded on first state load
  const winFiredRef = useRef(false);
  // Ref on the board section so we can compute viewport origin for confetti
  const boardSectionRef = useRef<HTMLElement>(null);

  // ── Analytics: play duration + abandonment (admin-analytics-spec §5.5) ────
  // game_start is emitted by the lobby (remote: game/ui.tsx, local:
  // game/local/ui.tsx). Here on the board we time the play: game_completed
  // with duration_ms on win, game_abandoned with duration_ms if the player
  // leaves before the game ends. startTimeRef is seeded on first state load.
  const playStartRef = useRef<number | null>(null);
  const playCompletedRef = useRef(false);
  // Latest state for the unmount cleanup (avoids a stale closure).
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Gating state (mirrors TruthOrDareClient) ────────────────────────────
  // 1. subscribed              → unlimited
  // 2. guest, rolls < 3        → free
  // 3. guest, rolls >= 3, no lead yet → lead modal
  // 4. guest, lead captured + not logged in → paywall
  // 5. logged-in, rolls < 3    → free
  // 6. logged-in, rolls >= 3   → paywall
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [completedRolls, setCompletedRolls] = useState(0);
  const [bonusConsumed, setBonusConsumed] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [subLocked, setSubLocked] = useState(false);
  const authWaiterRef = useRef<{
    resolve: (uid: string | null) => void;
  } | null>(null);

  // Load auth + subscription + plays counter on mount.
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
        const plays = await getUserGamePlays(supabase, SNAKES_PLAYS_SLUG);
        if (!cancelled) {
          setCompletedRolls(plays.plays_used);
          setBonusConsumed(plays.post_signup_bonus_used);
        }
      } else {
        setCompletedRolls(getGuestGamePlays(SNAKES_PLAYS_SLUG));
      }
      setAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Wrap the dice roll with the same gate as the wheel:
  //   • Subscribers always pass through to roll().
  //   • Guests roll free until FREE_PLAYS_PER_GAME, then see the lead modal.
  //   • Logged-in non-subscribers roll free until FREE_PLAYS_PER_GAME, then
  //     hit the hard paywall.
  // The counter increments AFTER a successful roll - the user always
  // gets the FREE_PLAYS_PER_GAME-th roll, and the modal opens right after
  // (matching the wheel's UX where the budget is "you used N of your free
  // plays" rather than "you tried to use one beyond N").
  const handleDiceRoll = async () => {
    if (!authReady) return;

    // 1. Subscribed → unlimited.
    if (subscribed) {
      playSound("dice");
      await roll();
      return;
    }

    // 2/5. Free budget still available → roll, then count.
    if (!userId) {
      const used = getGuestGamePlays(SNAKES_PLAYS_SLUG);
      if (used < FREE_PLAYS_PER_GAME) {
        playSound("dice");
        await roll();
        const next = incrementGuestGamePlays(SNAKES_PLAYS_SLUG);
        setCompletedRolls(next);
        // Just hit the budget → pop the lead modal so the next click finds
        // it already open.
        if (next >= FREE_PLAYS_PER_GAME && !hasGuestLeadCaptured() && !leadCaptured) {
          setSubLocked(false);
          setSubOpen(true);
        }
        return;
      }
      // 3. Guest budget spent, no lead yet → lead modal.
      if (!hasGuestLeadCaptured() && !leadCaptured) {
        setSubLocked(false);
        setSubOpen(true);
        return;
      }
      // 4. Lead captured but never registered → hard paywall.
      setSubLocked(true);
      setSubOpen(true);
      return;
    }

    // Logged-in non-subscriber.
    if (completedRolls < FREE_PLAYS_PER_GAME) {
      playSound("dice");
      await roll();
      const supabase = createBrowserSupabaseClient();
      void incrementUserGamePlays(supabase, SNAKES_PLAYS_SLUG);
      const nextRolls = completedRolls + 1;
      setCompletedRolls(nextRolls);
      if (nextRolls >= FREE_PLAYS_PER_GAME) {
        setSubLocked(true);
        setSubOpen(true);
      }
      return;
    }

    // 6. Logged-in budget spent → paywall.
    setSubLocked(true);
    setSubOpen(true);
  };

  // ── Step-by-step walk animation ─────────────────────────────────────────
  // `visualPositions` drives what PlayersOverlay actually renders.
  // It starts equal to state.positions and is updated one cell at a time
  // during a roll so the token hops across intermediate tiles.
  // The real Supabase state always holds the final (post-snake/ladder) position.
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>({});
  const [isWalking, setIsWalking] = useState(false);
  const [arrivingPlayerId, setArrivingPlayerId] = useState<string | null>(null);
  // Ref version of isWalking so synchronous effects can read current value
  // without being blocked by React's render cycle.
  const isWalkingRef = useRef(false);
  // Tracks positions as of the last completed turn (seed for walk start).
  const prevPositionsRef = useRef<Record<string, number> | null>(null);
  // Tracks the last turnCount we animated so we don't replay on re-renders.
  const prevTurnCountRef = useRef<number | null>(null);
  // Round 8 (2026-05-05) BUGFIX: explicit gate for modal opening.
  // Holds the turnCount of the most-recently-COMPLETED walk. The modal
  // is allowed to open only when state.turnCount === walkDoneForTurn -
  // i.e. only after the walk actually finished. Without this, the modal
  // could flash open the instant state.phase became "question" but
  // BEFORE the walk effect ran (since `isWalking` is set in a useEffect
  // that fires AFTER the first paint of the new state). User-reported
  // symptom: "I see one hop, popup pops up, then the token continues
  // moving in the background of the popup."
  const [walkDoneForTurn, setWalkDoneForTurn] = useState<number>(-1);

  // Diagnostic - log every change to the modal-open state so the
  // walk → modal sequence is visible in DevTools console.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const open =
      state?.phase === "question" &&
      !isWalking &&
      walkDoneForTurn === (state?.turnCount ?? 0);
    // eslint-disable-next-line no-console
    console.log("[snk-modal] gate", {
      open,
      phase: state?.phase,
      isWalking,
      walkDoneForTurn,
      turnCount: state?.turnCount,
    });
  }, [state?.phase, isWalking, walkDoneForTurn, state?.turnCount]);

  // Pass-the-phone toast + gentle turn indicator
  useEffect(() => {
    if (!currentPlayer) return;
    if (lastTurnPlayerId.current === currentPlayer.id) return;
    lastTurnPlayerId.current = currentPlayer.id;
    const msg =
      mode === "local"
        ? isHe
          ? `מעבירים את המכשיר ל-${currentPlayer.user_name} ${currentPlayer.avatar}`
          : `Pass the device to ${currentPlayer.user_name} ${currentPlayer.avatar}`
        : isHe
          ? `התור של ${currentPlayer.user_name}`
          : `${currentPlayer.user_name}'s turn`;
    setToast(msg);
    const tm = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(tm);
  }, [currentPlayer, mode, isHe]);

  // ── Idle sync: keep visualPositions up to date when NOT walking ──────────
  // On mount or after a walk completes, mirror the authoritative positions so
  // non-moving players (positions unchanged by the walk) stay correct, and so
  // that prevPositionsRef is seeded for the next turn's walk.
  //
  // CRITICAL ROUND 7 BUGFIX (2026-05-05): also bail when state.turnCount has
  // advanced past what we've processed. Without this guard, after a roll,
  // both the idle sync (deps: positions) and the walk effect (deps: turnCount)
  // fire - and React doesn't guarantee order. If idle sync wins the race, it
  // sets visualPositions to the FINAL post-roll position, making the token
  // visibly teleport to the destination, then the walk effect runs against
  // a corrupted prevPositionsRef and the token rewinds + re-walks. Itzik's
  // observed symptom: "player moves, comes back, then moves again."
  useEffect(() => {
    if (!state?.positions) return;
    if (isWalkingRef.current) return; // walk effect owns positions during walk
    // A new turn has been committed but the walk hasn't been scheduled yet.
    // Hold off - the walk effect is about to take over; jumping to the
    // final position now would create the rewind-then-walk-again artifact.
    if (
      prevTurnCountRef.current !== null &&
      (state.turnCount ?? 0) > prevTurnCountRef.current
    ) {
      return;
    }
    setVisualPositions({ ...state.positions });
    if (prevPositionsRef.current === null) {
      prevPositionsRef.current = { ...state.positions };
    }
    if (prevTurnCountRef.current === null) {
      prevTurnCountRef.current = state.turnCount ?? 0;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.positions]);

  // ── Walk effect: fires once per new dice roll ─────────────────────────────
  useEffect(() => {
    const t0 = performance.now();
    if (!state || !config) return;
    const turnCount = state.turnCount ?? 0;

    // Seed refs on first render without triggering animation
    if (prevTurnCountRef.current === null) {
      // eslint-disable-next-line no-console
      console.log("[snk-walk] seed", { turnCount, positions: state.positions });
      prevTurnCountRef.current = turnCount;
      prevPositionsRef.current = { ...state.positions };
      setVisualPositions({ ...state.positions });
      return;
    }
    // No new turn yet
    if (turnCount <= prevTurnCountRef.current) {
      // eslint-disable-next-line no-console
      console.log("[snk-walk] skip (no new turn)", {
        turnCount,
        prevTurnCount: prevTurnCountRef.current,
      });
      return;
    }

    const diceResult = state.lastDiceResult;
    if (!diceResult) {
      // eslint-disable-next-line no-console
      console.log("[snk-walk] skip (no dice)", { turnCount });
      prevTurnCountRef.current = turnCount;
      return;
    }

    // currentPlayer is still the roller (currentPlayerIndex changes only after answer())
    const playerId = currentPlayer?.id;
    if (!playerId) {
      // eslint-disable-next-line no-console
      console.log("[snk-walk] skip (no playerId)", { turnCount });
      prevTurnCountRef.current = turnCount;
      return;
    }

    const prevPos = prevPositionsRef.current?.[playerId] ?? 1;
    const finalPos = state.positions[playerId] ?? 1;
    const boardSize = config.boardSize || 100;
    // eslint-disable-next-line no-console
    console.log("[snk-walk] START", {
      turnCount,
      playerId,
      playerName: currentPlayer?.user_name,
      diceResult,
      prevPos,
      finalPos,
      phase: state.phase,
      walkDoneForTurn,
      effectStartTimestamp: Math.round(t0),
    });

    // Build the naive walk path (no snake/ladder resolution).
    // The visual token hops from prevPos+1 … min(prevPos+dice, boardSize).
    // After the interval finishes we snap to finalPos - if a snake/ladder
    // is involved, PlayersOverlay's spring glides the token there naturally.
    const naiveEnd = Math.min(prevPos + (diceResult as number), boardSize);
    const steps: number[] = [];
    for (let c = prevPos + 1; c <= naiveEnd; c++) steps.push(c);

    // Advance turn counter early so the guard above doesn't re-fire
    prevTurnCountRef.current = turnCount;

    if (steps.length === 0) {
      // eslint-disable-next-line no-console
      console.log("[snk-walk] zero-step (already at finalPos)", { turnCount, finalPos });
      setVisualPositions((prev) => ({ ...prev, [playerId]: finalPos }));
      prevPositionsRef.current = { ...(prevPositionsRef.current ?? {}), [playerId]: finalPos };
      setWalkDoneForTurn(turnCount);
      return;
    }
    // eslint-disable-next-line no-console
    console.log("[snk-walk] steps planned", { turnCount, steps, naiveEnd, finalPos, willTeleport: finalPos !== naiveEnd });

    // ms per tile hop. Round 6 (2026-05-05): tightened 370 → 200 so
    // the walk feels snappy - the previous pacing made the token
    // crawl. Spring inside PlayersOverlay settles in ~200ms at
    // stiffness 620, so 200ms is the floor before hops overlap.
    const STEP_MS = 200;
    // Hard upper bound: max 6 steps + 480ms teleport pause + 520ms bounce = ~3.5s.
    // If something goes wrong the modal must never stay blocked forever.
    const SAFETY_MS = steps.length * STEP_MS + 1200;

    isWalkingRef.current = true;
    setIsWalking(true);
    setArrivingPlayerId(null);

    // Delay before the token starts walking. Round 6 (2026-05-05):
    // dice tumble is 2500ms. Walk starts 200ms after tumble settles -
    // tight enough to feel snappy, long enough to read the number
    // since the dice STAYS VISIBLE during the walk (Itzik round 5).
    // Total click→walk-start ≈ 2.7s.
    const DICE_REVEAL_DELAY_MS = 2700;

    const safetyTimer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn("[snk-walk] SAFETY TIMER fired (walk took too long)", {
        turnCount,
        elapsed: Math.round(performance.now() - t0),
      });
      isWalkingRef.current = false;
      setIsWalking(false);
      setArrivingPlayerId(null);
      setVisualPositions((prev) => ({ ...prev, [playerId]: finalPos }));
      prevPositionsRef.current = { ...(prevPositionsRef.current ?? {}), [playerId]: finalPos };
      setWalkDoneForTurn(turnCount);
    }, SAFETY_MS + DICE_REVEAL_DELAY_MS);

    // Wait for the dice to settle, THEN start stepping. The interval
    // is set up after the delay so the token doesn't twitch early.
    // `clearInterval` accepts Timeout | undefined but NOT null in current
    // @types/node, so we keep the slot undefined-typed and rely on the
    // closure-captured value being set before any tick fires.
    let interval: ReturnType<typeof setInterval> | undefined;
    let stepIdx = 0;
    const startWalk = () => {
      // eslint-disable-next-line no-console
      console.log("[snk-walk] startWalk fired", {
        turnCount,
        elapsedSinceEffect: Math.round(performance.now() - t0),
      });
      interval = setInterval(() => {
      if (stepIdx < steps.length) {
        const cell = steps[stepIdx];
        // eslint-disable-next-line no-console
        console.log("[snk-walk] step", {
          turnCount,
          stepIdx,
          cell,
          totalSteps: steps.length,
          elapsedSinceEffect: Math.round(performance.now() - t0),
        });
        setVisualPositions((prev) => ({ ...prev, [playerId]: cell }));
        playSound("move");
        stepIdx++;
      } else {
        // eslint-disable-next-line no-console
        console.log("[snk-walk] all steps done - preparing bounce", {
          turnCount,
          elapsedSinceEffect: Math.round(performance.now() - t0),
        });
        clearInterval(interval);
        clearTimeout(safetyTimer); // walk completed normally - disarm the watchdog

        // Snap to final position (handles snake/ladder teleport).
        // The existing spring in PlayersOverlay glides the token there.
        setVisualPositions((prev) => ({ ...prev, [playerId]: finalPos }));
        prevPositionsRef.current = { ...(prevPositionsRef.current ?? {}), [playerId]: finalPos };

        // For snake/ladder, give the spring ~340 ms to visually travel
        // before the arrival bounce; for a plain landing, a near-zero
        // pause feels right. Tightened round 6 (2026-05-05): 480/80
        // → 340/40 so the modal pops faster after the token settles.
        const hasTeleport = finalPos !== naiveEnd;
        const preBounceMs = hasTeleport ? 340 : 40;

        setTimeout(() => {
          setArrivingPlayerId(playerId);

          setTimeout(() => {
            // eslint-disable-next-line no-console
            console.log("[snk-walk] DONE → modal will open", {
              turnCount,
              totalElapsed: Math.round(performance.now() - t0),
            });
            setArrivingPlayerId(null);
            isWalkingRef.current = false;
            setIsWalking(false);
            // Modal gate - only NOW (after token has fully settled and
            // the bounce has played) do we mark this turn as ready for
            // the question popup. The modal is gated on this matching
            // state.turnCount.
            setWalkDoneForTurn(turnCount);

            // Play event sound at the moment the token settles
            const lastLog = state.log[state.log.length - 1];
            if (lastLog?.type === "snake") {
              playSound("snake");
            } else if (lastLog?.type === "ladder") {
              playSound("ladder");
              // Fire the ladder confetti now that the token is at the top
              if (boardSectionRef.current) {
                const r = boardSectionRef.current.getBoundingClientRect();
                const o = {
                  x: (r.left + r.width / 2) / window.innerWidth,
                  y: (r.top + r.height * 0.45) / window.innerHeight,
                };
                const colors = ["#fde68a", "#fb923c", "#f472b6", "#a78bfa", "#34d399"];
                confetti({ particleCount: 55, spread: 75, origin: o, colors, startVelocity: 32, gravity: 1.1, scalar: 0.9, ticks: 90 });
                setTimeout(() => confetti({ particleCount: 35, spread: 55, origin: o, colors, startVelocity: 22, gravity: 1.3, scalar: 0.75, ticks: 70 }), 180);
              }
            }
          }, 280);
        }, preBounceMs);
      }
    }, STEP_MS);
    };

    // Kick off the walk after the dice reveal pause.
    const startTimer = setTimeout(startWalk, DICE_REVEAL_DELAY_MS);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
      clearTimeout(safetyTimer);
    };
  // Only fire when a new turn has been committed to Supabase
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.turnCount]);

  // Seed the play-timer the moment the board has a live game state.
  useEffect(() => {
    if (state && playStartRef.current === null) {
      playStartRef.current = Date.now();
    }
  }, [state]);

  // Abandonment: if the board unmounts (exit / route change) while the game is
  // still in progress, emit game_abandoned with the elapsed duration. Guarded
  // by playCompletedRef so a normal win never also counts as an abandon.
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (
        !playCompletedRef.current &&
        s &&
        s.phase !== "ended" &&
        playStartRef.current !== null
      ) {
        track("game_abandoned", {
          game_type:   "snakes",
          mode,
          duration_ms: Date.now() - playStartRef.current,
          turn_count:  s.turnCount ?? 0,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sound cues + confetti on win ──────────────────────────────────────────
  // Snake/ladder sounds are now handled by the walk effect at the right moment.
  // This effect only handles win confetti (and leaves the door open for other
  // non-turn-based audio cues later).
  useEffect(() => {
    if (!state) return;
    const prev = lastPhaseRef.current;
    // Walk effect handles snake / ladder / move sounds - skip them here
    if (state.phase === "ended" && prev !== "ended" && !winFiredRef.current) {
      winFiredRef.current = true;
      // Analytics: game completed (spec §5.5) - duration from board mount.
      if (!playCompletedRef.current && playStartRef.current !== null) {
        playCompletedRef.current = true;
        track("game_completed", {
          game_type:   "snakes",
          mode,
          duration_ms: Date.now() - playStartRef.current,
          turn_count:  state.turnCount ?? 0,
        });
      }
      playSound("win");
      // Win burst - centred on the board, not three full-screen fountains
      const getBoardOrigin = () => {
        if (!boardSectionRef.current) return { x: 0.5, y: 0.45 };
        const r = boardSectionRef.current.getBoundingClientRect();
        return {
          x: (r.left + r.width / 2) / window.innerWidth,
          y: (r.top + r.height * 0.4) / window.innerHeight,
        };
      };
      const o = getBoardOrigin();
      const colors = ["#fde68a", "#fb923c", "#f472b6", "#a78bfa", "#34d399"];
      confetti({ particleCount: 90, spread: 80, origin: o, colors, scalar: 1.1, startVelocity: 42 });
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: o, colors, scalar: 0.9, startVelocity: 30 }), 300);
      setTimeout(() => confetti({ particleCount: 40, spread: 60, origin: o, colors, scalar: 1.2, startVelocity: 50 }), 600);
    }
    if (state.phase !== "ended") {
      winFiredRef.current = false;
    }
    lastPhaseRef.current = state.phase;
  }, [state, mode]);

  // Local confetti burst when any player climbs a ladder.
  // We debounce by tracking log length so the same entry never re-triggers on
  // a re-render (and a full log replay on room join doesn't fire old bursts).
  // NOTE: when the walk animation is in progress we defer this effect - the
  // walk effect fires the burst itself after the token teleports, so the
  // confetti pops from the correct (ladder-top) cell position.
  useEffect(() => {
    if (!state) {
      lastLogLenRef.current = -1; // -1 = uninitialised; will seed on next call
      return;
    }
    const len = state.log.length;
    // On the very first render with a live state (including mid-game joins)
    // seed the ref to the current log length so we don't replay history.
    if (lastLogLenRef.current === -1) {
      lastLogLenRef.current = len;
      return;
    }
    const prevLen = lastLogLenRef.current;
    lastLogLenRef.current = len;
    if (len === 0 || len <= prevLen) return;
    const newEntries = state.log.slice(prevLen);
    if (!newEntries.some((e) => e.type === "ladder")) return;

    // Walk effect owns the timing when a roll just happened - skip here.
    if (isWalkingRef.current) return;

    // Compute the burst origin from the board's bounding box so the particles
    // appear to rise from the tile, not from the screen edges.
    const getBoardOrigin = () => {
      if (!boardSectionRef.current) return { x: 0.5, y: 0.5 };
      const r = boardSectionRef.current.getBoundingClientRect();
      return {
        x: (r.left + r.width / 2) / window.innerWidth,
        y: (r.top + r.height * 0.55) / window.innerHeight,
      };
    };
    const o = getBoardOrigin();
    const colors = ["#fde68a", "#fb923c", "#f472b6", "#a78bfa", "#34d399"];

    // Two quick pops - feels punchy without hijacking the whole screen
    confetti({ particleCount: 55, spread: 75, origin: o, colors, startVelocity: 32, gravity: 1.1, scalar: 0.9, ticks: 90 });
    setTimeout(() => confetti({ particleCount: 35, spread: 55, origin: o, colors, startVelocity: 22, gravity: 1.3, scalar: 0.75, ticks: 70 }), 180);
  }, [state]);

  // Players split into "active" (locked in - has claimed a character) and
  // "pending approval" (joined but not yet confirmed their identity). The
  // existing schema doesn't have a dedicated is_approved column, so the lock
  // state is the closest proxy for "ready to play". A future migration could
  // add an explicit approval field; the UI is already wired to render that
  // distinction so swapping the predicate is a one-line change.
  const { activePlayers, pendingPlayers } = useMemo(() => {
    const active: GamePlayer[] = [];
    const pending: GamePlayer[] = [];
    for (const p of players) {
      if (p.is_locked) active.push(p);
      else pending.push(p);
    }
    return { activePlayers: active, pendingPlayers: pending };
  }, [players]);

  if (!room || !state || !config) {
    return (
      <SnakesIntimateBackground>
        <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
          <div
            className="font-['Playfair_Display',Georgia,serif] text-[#C9A961]/85"
            dir={isHe ? "rtl" : "ltr"}
          >
            {t("loading")}
          </div>
        </main>
      </SnakesIntimateBackground>
    );
  }

  const winner = state.winner ? players.find((p) => p.id === state.winner) ?? null : null;

  // Where on the board the current player's token sits - used both as the
  // modal's animation origin and as the hint anchor for the floating dice.
  const currentCellCenter = currentPlayer
    ? cellToBoardPercent(
        state.positions?.[currentPlayer.id] ?? 1,
        config.boardSize || 100,
      )
    : null;

  return (
    <SnakesIntimateBackground>
      <main
        className={cn(
          "relative min-h-[100dvh] w-full",
          // Mobile: single column stack. Desktop: two-column grid.
          // Columns are [sidebar 18rem][board 1fr] so that under RTL the
          // sidebar visually sits on the right. Rows stack the sidebar
          // internals (header/dice/players/exit) top→bottom on desktop.
          "flex flex-col gap-3 p-3",
          "md:grid md:grid-cols-[18rem_1fr] md:grid-rows-[auto_1fr_auto] md:gap-5 md:p-5",
        )}
        dir={isHe ? "rtl" : "ltr"}
      >
        {/* ───────────────────── Header - intimate-dark redesign 2026-05-05.
              Glass-morphism over the burgundy/black page, gold hairline
              border, serif gold title with letter-spacing, lower-opacity
              subtitle. */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "order-1 md:order-none",
            "md:col-start-1 md:row-start-1",
            "flex items-center gap-3 rounded-3xl border border-[#C9A961]/25",
            "bg-[rgba(20,4,12,0.55)] backdrop-blur-xl",
            "px-4 py-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(201,169,97,0.10)]",
          )}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(201,169,97,0.10)] ring-1 ring-[#C9A961]/30">
            <Image
              src="/mioshy-white.svg"
              alt="Mioshy"
              width={36}
              height={36}
              className="opacity-90"
              priority
            />
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div
              className={cn(
                "truncate text-lg font-semibold leading-tight",
                "font-['Playfair_Display','Cormorant_Garamond',Georgia,serif]",
                "text-[#E6CB85] tracking-[0.02em]",
              )}
              style={{ letterSpacing: "0.04em" }}
            >
              {t("gameName")}
            </div>
            <div className="truncate text-[12px] text-[#E6CB85]/55 font-light">
              {t("gameSubtitle")}
            </div>
          </div>
          {/* On mobile the exit lives inline in the header. On desktop the
              red exit button sits at the bottom of the sidebar (see below). */}
          {onExit ? (
            <button
              type="button"
              className="rounded-full border border-[#9b2235]/50 bg-[#9b2235]/15 px-3 py-1.5 text-xs font-semibold text-[#f0c4cc] backdrop-blur transition hover:bg-[#9b2235]/25 md:hidden"
              onClick={() => void onExit()}
            >
              {t("leave")}
            </button>
          ) : null}
        </motion.header>

        {/* ───────────────────── Yellow zone - board */}
        <section
          ref={boardSectionRef}
          className={cn(
            "order-2 md:order-none",
            "md:col-start-2 md:row-start-1 md:row-span-3",
            "relative flex items-center justify-center",
          )}
        >
          <div className="relative w-full">
            <SnakesBoard
              config={config}
              positions={state.positions ?? {}}
              players={players}
              currentPlayerId={currentPlayer?.id ?? null}
              visualPositions={visualPositions}
              arrivingPlayerId={arrivingPlayerId}
              isWalking={isWalking}
              isRtl={isHe}
            />

            {/* Question modal - only opens after the walk animation finishes so
                the player sees the full journey before the question card erupts
                from their final tile. */}
            <QuestionModal
              // Round 8 (2026-05-05) gate: open ONLY when the walk for
              // the current turn has fully completed. Without the
              // walkDoneForTurn check, the modal could flash open the
              // instant state.phase became "question" - before the walk
              // even started - because isWalking is set inside a
              // useEffect that runs AFTER the first paint of the new
              // state. See walkDoneForTurn declaration above for full
              // reasoning and the user-reported symptom.
              open={
                state.phase === "question" &&
                !isWalking &&
                walkDoneForTurn === (state.turnCount ?? 0)
              }
              question={state.currentQuestion}
              playerName={currentPlayer?.user_name ?? ""}
              avatar={currentPlayer?.avatar ?? "💜"}
              penalty={{ penaltyType: config.penaltyType, penaltySteps: config.penaltySteps }}
              onAnswer={answer}
              originPct={currentCellCenter}
            />
          </div>
        </section>

        {/* ───────────────────── Dice surface (desktop) - intimate-dark
              2026-05-05. Deep wine→black felt with gold hairline border. */}
        <section
          className={cn(
            "hidden md:flex",
            "md:col-start-1 md:row-start-2",
            "items-center justify-center rounded-3xl",
            "border border-[#C9A961]/25",
            "bg-[radial-gradient(ellipse_at_50%_30%,#2a0810_0%,#150308_55%,#08020c_100%)]",
            "p-5 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(201,169,97,0.08)]",
          )}
          aria-label={t("diceSurfaceLabel")}
        >
          <AnimatePresence mode="wait">
            {isMyTurn ? (
              // Dice stays visible for the WHOLE turn - Itzik 2026-05-05
              // round 5. Previously the dice disappeared the moment phase
              // changed from "waiting_flip", so the player never got to
              // see the number they rolled before the modal popped. Now
              // the dice renders for every active phase of MY turn:
              //   waiting_flip → interactive (clickable to roll)
              //   walking / question → read-only, showing the result
              //                         face so the user can read it.
              // It's only replaced by the "turn of X" placeholder when
              // it's NOT my turn (i.e. someone else is rolling).
              <motion.div
                key="dice-desktop"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: "spring", stiffness: 360, damping: 26 }}
              >
                <Dice
                  onRoll={handleDiceRoll}
                  // Disabled while walking / question phase - but the
                  // dice still renders showing the result face.
                  disabled={state.phase !== "waiting_flip" || isWalking}
                  result={state.lastDiceResult ?? null}
                  playerColor={currentPlayer?.color ?? "#f59e0b"}
                  // Vocative caption: "{name}, תורך" - only shown when
                  // it's actually time to roll (handled inside Dice).
                  label={
                    currentPlayer
                      ? isHe
                        ? `${currentPlayer.user_name}, תורך`
                        : `${currentPlayer.user_name}, your turn`
                      : ""
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key="dice-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "text-center font-light",
                  "font-['Playfair_Display',Georgia,serif]",
                  "tracking-wide",
                )}
              >
                {currentPlayer ? (
                  <>
                    <div className="text-4xl">{currentPlayer.avatar}</div>
                    {/* Round 7 (2026-05-05): "turn of" label small, but the
                        PLAYER NAME 2× bigger so it's the focal point of
                        the dice surface when waiting between turns. */}
                    <div className="mt-2 text-sm text-[#C9A961]/65">
                      {isHe ? "התור של" : "Turn of"}
                    </div>
                    <div
                      className="mt-0.5 text-2xl font-semibold text-[#E6CB85]"
                      style={{ color: currentPlayer.color }}
                    >
                      {currentPlayer.user_name}
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-[#C9A961]/75">
                    {t("waiting")}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ───────────────────── Players list - intimate-dark glass-morphism
              with gold accents. Replaces the previous sky-blue panel. */}
        <section
          className={cn(
            "order-3 md:order-none",
            "md:col-start-1 md:row-start-3",
            "flex flex-col gap-3 rounded-3xl border border-[#C9A961]/22",
            "bg-[rgba(20,4,12,0.55)] backdrop-blur-xl",
            "p-4 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(201,169,97,0.08)]",
          )}
        >
          <div className="flex items-center justify-between">
            <h2
              className={cn(
                "text-sm font-medium tracking-[0.08em] uppercase",
                "font-['Playfair_Display',Georgia,serif]",
                "text-[#E6CB85]",
              )}
            >
              {t("playersActive")}
            </h2>
            <span className="rounded-full border border-[#C9A961]/30 bg-[#C9A961]/12 px-2 py-0.5 text-xs font-semibold text-[#E6CB85]">
              {activePlayers.length}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {activePlayers.map((p) => {
              const isCurrent = currentPlayer?.id === p.id;
              const isMe = p.id === myPlayerId;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-2 transition",
                    isCurrent
                      ? "border-[#C9A961]/55 bg-[#C9A961]/10 shadow-[inset_0_0_18px_rgba(201,169,97,0.10)]"
                      : "border-white/8 bg-white/[0.025]",
                  )}
                >
                  {/* Avatar icon on the leading edge of the line (visually
                      left in RTL since the container is already RTL). */}
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg shadow-inner ring-2"
                    style={{
                      background: `${p.color}22`,
                      borderColor: p.color,
                      color: p.color,
                    }}
                    aria-hidden
                  >
                    {p.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[#F2E4C9]">
                      {p.user_name}
                      {isMe ? (
                        <span className="ms-2 rounded-full bg-[#C9A961]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#E6CB85]">
                          {t("you")}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-[#C9A961]/55">
                      {p.is_host ? t("host") : `#${p.order_index + 1}`}
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="ms-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#E6CB85] shadow-[0_0_10px_#C9A961]" />
                  ) : null}
                </li>
              );
            })}
          </ul>

          {/* Pending-approval sub-list - only renders if somebody hasn't
              confirmed their character yet. Admin approval can be wired to
              a server action later; the button currently just surfaces the
              intent visually (no-op) because there is no approval endpoint
              to call yet without a schema migration. */}
          {pendingPlayers.length > 0 ? (
            <div className="mt-1 border-t border-white/10 pt-2">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-sky-200/70">
                {t("playersPending")}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {pendingPlayers.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 px-2.5 py-1.5"
                  >
                    <span className="text-base" aria-hidden>
                      {p.avatar || "👤"}
                    </span>
                    <span className="flex-1 truncate text-xs font-semibold text-amber-100/90">
                      {p.user_name}
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-100 transition hover:bg-emerald-500/25"
                      // Approval is deferred to a future server action - see
                      // the comment above. For now the button is rendered so
                      // the blue zone matches the spec visually; wire the
                      // onClick to a server action when the column exists.
                      disabled
                      aria-disabled
                    >
                      {t("approve")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Red zone - exit button (desktop). Tied to the sidebar so the
              board area stays clean. Mobile gets its exit inside the header. */}
          {onExit ? (
            <button
              type="button"
              onClick={() => void onExit()}
              className={cn(
                "mt-auto hidden md:block",
                "rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-2.5",
                "text-sm font-extrabold text-rose-100 backdrop-blur transition",
                "hover:bg-rose-500/25",
              )}
            >
              {t("leave")}
            </button>
          ) : null}
        </section>

        {/* Floating dice popup - MOBILE ONLY. Same lifecycle as the
            desktop dice (round 5, 2026-05-05): visible for the entire
            turn (waiting_flip → walking → question), so the player can
            actually see the rolled number rather than the dice
            disappearing the moment they tap. */}
        <AnimatePresence>
          {isMyTurn ? (
            <motion.div
              key="dice-dock-mobile"
              initial={{ y: 140, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 140, opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 md:hidden"
            >
              <div className="rounded-3xl border border-[#C9A961]/35 bg-[radial-gradient(ellipse_at_50%_25%,#2a0810_0%,#150308_60%,#08020c_100%)] p-3 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(201,169,97,0.08)]">
                <Dice
                  onRoll={handleDiceRoll}
                  disabled={state.phase !== "waiting_flip" || isWalking}
                  result={state.lastDiceResult ?? null}
                  playerColor={currentPlayer?.color ?? "#f59e0b"}
                  label={
                    currentPlayer
                      ? isHe
                        ? `${currentPlayer.user_name}, תורך`
                        : `${currentPlayer.user_name}, your turn`
                      : ""
                  }
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Waiting hint REMOVED 2026-05-05 per Itzik: when it's not
            the current user's turn, show NOTHING. The dice surface only
            displays "{name}, תורך" when it's actually their turn. */}

        {/* Error toast */}
        {error ? (
          <div className="pointer-events-none fixed top-14 left-1/2 z-40 -translate-x-1/2 rounded-full border border-rose-400/30 bg-rose-950/80 px-4 py-2 text-xs font-semibold text-rose-100 backdrop-blur">
            {error}
          </div>
        ) : null}

        {/* Pass-the-phone toast */}
        <AnimatePresence>
          {toast ? (
            <motion.div
              key="toast"
              initial={{ opacity: 0, y: -14, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className="pointer-events-none fixed left-1/2 top-14 z-40 -translate-x-1/2 rounded-full border border-amber-200/30 bg-black/70 px-5 py-2 text-sm font-semibold text-amber-50 backdrop-blur"
              dir={isHe ? "rtl" : "ltr"}
            >
              {toast}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Win overlay - sits above everything */}
        <AnimatePresence>
          {state.phase === "ended" ? (
            <motion.div
              key="win-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              dir={isHe ? "rtl" : "ltr"}
            >
              <motion.div
                initial={{ scale: 0.8, y: 24 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 24 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                className="w-full max-w-lg rounded-3xl border border-amber-200/25 bg-[rgba(2,6,23,0.92)] p-6 text-slate-100 shadow-2xl"
              >
                <div className="text-center">
                  <div className="text-6xl">{winner?.avatar ?? "🏆"}</div>
                  <div
                    className="mt-4 text-2xl font-extrabold"
                    style={{ color: winner?.color ?? "#fde68a" }}
                  >
                    {winner
                      ? isHe
                        ? `${winner.user_name} ניצח/ה!`
                        : `${winner.user_name} wins!`
                      : isHe
                        ? "יש מנצח!"
                        : "We have a winner!"}
                  </div>
                  <p className="mt-2 text-sm text-slate-300/80">
                    {mode === "local"
                      ? isHe
                        ? "שחקו שוב או צאו ללובי לעוד משחק"
                        : "Play again or head back to the games catalog."
                      : isHe
                        ? "המשחק הסתיים. המארח יכול להתחיל משחק חדש."
                        : "Game over. The host can start a new round."}
                  </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {onExit ? (
                    <button
                      type="button"
                      className="min-h-[48px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100 hover:bg-white/10"
                      onClick={() => void onExit()}
                    >
                      {isHe ? "חזרה למשחקים" : "Back to games"}
                    </button>
                  ) : null}
                  {onPlayAgain ? (
                    <button
                      type="button"
                      className="min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 to-rose-400 px-4 py-3 text-sm font-bold text-stone-900 hover:brightness-110 disabled:opacity-50"
                      onClick={() => void onPlayAgain()}
                    >
                      {isHe ? "משחק חדש" : "Play again"}
                    </button>
                  ) : null}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Gating modals - same pair as the wheel game ────────────── */}
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
              const plays = await getUserGamePlays(supabase, SNAKES_PLAYS_SLUG);
              setCompletedRolls(plays.plays_used);
              setBonusConsumed(plays.post_signup_bonus_used);
            }
            authWaiterRef.current?.resolve(uid);
            authWaiterRef.current = null;
            setRegOpen(false);
          }}
        />

        <SubscriptionModal
          open={subOpen}
          onOpenChange={(v) => setSubOpen(v)}
          locked={subLocked}
          userId={userId}
          gameSlug={SNAKES_PLAYS_SLUG}
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
          // "lead" mode while we still don't know who the user is -
          // first-budget-exhausted guests land here and can sign up for
          // the +3 post-signup bonus. Once they have a user id (or a
          // local lead), we switch to "paywall".
          mode={
            !userId && !leadCaptured && !hasGuestLeadCaptured()
              ? "lead"
              : "paywall"
          }
          onLeadSaved={(_, newUserId) => {
            setLeadCaptured(true);
            setSubOpen(false);
            if (newUserId && !userId) {
              setUserId(newUserId);
              (async () => {
                const supabase = createBrowserSupabaseClient();
                if (!bonusConsumed) {
                  await grantPostSignupBonus(supabase, SNAKES_PLAYS_SLUG);
                  setBonusConsumed(true);
                }
                const plays = await getUserGamePlays(
                  supabase,
                  SNAKES_PLAYS_SLUG,
                );
                setCompletedRolls(plays.plays_used);
                setBonusConsumed(plays.post_signup_bonus_used);
              })();
            }
          }}
        />
      </main>
    </SnakesIntimateBackground>
  );
}

// ─── SnakesIntimateBackground ──────────────────────────────────────────────────
//
// Page-level wrapper for the Snakes & Ladders couples game. Replaces the
// generic GamePageBackground (themed via gameSlug) with a fixed dark-
// candlelight aesthetic per Itzik's redesign brief 2026-05-05:
//
//   "mature, intimate, romantic-dark - candlelit bedroom, late night,
//    sensual. Background: deep midnight gradient (dark burgundy → black
//    → deep purple). NO cartoon elements."
//
// Layered stack (bottom→top):
//   1. Solid near-black base (#08020c).
//   2. Soft burgundy + deep-purple radial blobs that drift very slowly.
//   3. Velvet noise grain (mix-blend-overlay) - keeps the gradient from
//      banding on phones with limited bit-depth.
//   4. Floating dust particles - slow, sparse, warm gold, like dust
//      caught in candlelight (NOT party lights - explicitly no flashes).
//   5. Strong vignette pulling the eye to the board.
//
// The component imports framer-motion only for the slow blob drift; the
// dust particles are pure CSS animations to keep this layer cheap on
// mobile.
function SnakesIntimateBackground({ children }: { children: React.ReactNode }) {
  // Dust particles REMOVED 2026-05-05 round 7 (performance). The 14
  // gold orbs below provide the same atmospheric texture; running both
  // arrays (28 total animated DOM elements) was unnecessary GPU load.

  // Floating particles - Itzik 2026-05-05 round 7
  // PERFORMANCE FIX: previous round had 28 particles + 14 dust specks
  // = 42 animated elements + 3 animated blurred blobs. That was
  // causing the 10+ second gameplay lag because the GPU was
  // perpetually compositing, leaving little budget for click handlers
  // / state updates / walk timers. Cut the count + simplify the
  // animation (transform only, no `filter: brightness` repaints).
  const goldOrbs = useMemo(() => {
    const out: Array<{
      top: number;
      left: number;
      size: number;
      duration: number;
      delay: number;
      driftX: number;
      driftY: number;
      opacity: number;
    }> = [];
    // 14 particles - half the previous count. Still feels populated
    // but cuts compositing work in half.
    for (let i = 0; i < 14; i++) {
      // Deterministic spread (matches FloatingParticles.buildParticles
      // pattern - pseudo-random integer arithmetic so SSR + client
      // agree on positions).
      const t = (3 + (i * 53 + i * 7 + 17) % 88);
      const l = (3 + (i * 37 + i * i * 13) % 94);
      // 4-12px diameter - small distinct dots, like wheels.
      const size = 4 + ((i * 5) % 9);
      // 8-16s drift - faster than the previous orbs.
      const duration = 8 + ((i * 3) % 9);
      const delay = -((i * 0.4) % 4);
      // 8-direction quadrant pattern (same as FloatingParticles)
      const sector = i % 8;
      const magnitude = 22 + (i % 3) * 14;
      let driftX = 0;
      let driftY = 0;
      switch (sector) {
        case 0: driftY = -magnitude; break;
        case 1: driftX = magnitude; driftY = -magnitude * 0.6; break;
        case 2: driftX = magnitude; break;
        case 3: driftX = magnitude; driftY = magnitude * 0.6; break;
        case 4: driftY = magnitude; break;
        case 5: driftX = -magnitude; driftY = magnitude * 0.6; break;
        case 6: driftX = -magnitude; break;
        case 7: driftX = -magnitude; driftY = -magnitude * 0.6; break;
      }
      // High alpha (0.55-0.85) so each dot is visible - but small
      // size keeps them subtle individually.
      const opacity = 0.55 + ((i * 7) % 30) / 100;
      out.push({ top: t, left: l, size, duration, delay, driftX, driftY, opacity });
    }
    return out;
  }, []);

  // (Diagnostic console.log removed in round 7 - performance pass.)

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-[#08020c]">
      {/* Background gradient blobs - Itzik 2026-05-05 round 7
          PERFORMANCE FIX: previous round had 3 huge (80vw × 80vh)
          blurred blobs animating x+y with `filter: blur(80-110px)` on
          each. Animating large blurred filters repaints a massive GPU
          texture every frame and was the prime suspect for the 10s+
          gameplay lag. New approach: blobs are SMALLER (50vw × 50vh),
          blur is HALVED (40-50px), and instead of animating x/y on a
          BLURRED element we use a static blob with a `radial-gradient`
          that doesn't repaint. The atmosphere effect comes from the
          floating particles + grain overlay; the blobs are
          set-and-forget background color washes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -start-[10%] -top-[15%] h-[55vh] w-[55vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(91,8,28,0.55) 0%, rgba(91,8,28,0.0) 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-[8%] -bottom-[10%] h-[50vh] w-[50vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(46,16,68,0.60) 0%, rgba(46,16,68,0.0) 70%)",
          filter: "blur(45px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute start-[20%] top-[35%] h-[40vh] w-[40vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(70,12,56,0.40) 0%, rgba(70,12,56,0.0) 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* Velvet noise grain - purely decorative texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      {/* Floating gold particles - small distinct dots like the wheel
          pages' FloatingParticles. Round 6 (2026-05-05) replaces the
          previous big blurred blobs (which felt rough). Each dot has
          its own drift direction; collectively they look like ambient
          gold sparks. Solid color (no blur) so they read as crisp
          points of light. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {goldOrbs.map((o, i) => (
          <span
            key={`orb-${i}`}
            className="snk-orb absolute rounded-full"
            style={{
              top: `${o.top}%`,
              insetInlineStart: `${o.left}%`,
              width: `${o.size}px`,
              height: `${o.size}px`,
              background: "rgba(230,203,133,1)",
              boxShadow: `0 0 ${o.size * 2}px rgba(230,203,133,0.6), 0 0 ${o.size * 4}px rgba(201,169,97,0.3)`,
              opacity: o.opacity,
              animationDuration: `${o.duration}s`,
              animationDelay: `${o.delay}s`,
              ["--snk-orb-drift-x" as never]: `${o.driftX}px`,
              ["--snk-orb-drift-y" as never]: `${o.driftY}px`,
            }}
          />
        ))}
      </div>

      {/* Edge vignette - pushes the eye to the board */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      <div className="relative min-h-[100dvh]">{children}</div>

      {/* Keyframes - round 7 (2026-05-05) PERFORMANCE.
          TRANSFORM-ONLY animation, no opacity/filter changes. GPU
          compositor handles transform without rasterization. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes snk-orb-drift {
              0%, 100% { transform: translate3d(calc(var(--snk-orb-drift-x) *  0.5), calc(var(--snk-orb-drift-y) *  0.5), 0); }
              50%      { transform: translate3d(calc(var(--snk-orb-drift-x) * -0.5), calc(var(--snk-orb-drift-y) * -0.5), 0); }
            }
            .snk-orb {
              animation-name: snk-orb-drift;
              animation-iteration-count: infinite;
              animation-timing-function: ease-in-out;
              will-change: transform;
            }
            @media (prefers-reduced-motion: reduce) {
              .snk-orb { animation: none !important; }
            }
          `,
        }}
      />
    </div>
  );
}
