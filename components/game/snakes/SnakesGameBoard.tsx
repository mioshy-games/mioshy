"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import confetti from "canvas-confetti";
import { SnakesBoard } from "@/components/game/snakes/SnakesBoard";
import { Dice } from "@/components/game/snakes/Dice";
import { QuestionModal } from "@/components/game/snakes/QuestionModal";
import { GamePageBackground } from "@/components/game/GamePageBackground";
import { useSnakesGame } from "@/hooks/useSnakesGame";
import type { GameAdapter } from "@/lib/snakes/adapter";
import type { DiceResult, GamePlayer } from "@/lib/snakes/types";
import { cellToBoardPercent } from "@/lib/snakes/boardUtils";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

// Dice presentation timing. Tumble + read pause must add up to roughly the
// budget agreed in the redesign brief (~1.2s) — long enough that any player
// can clearly read the number, short enough that the rhythm doesn't drag
// after several turns. Bump READ_PAUSE_MS if playtesting shows it's too quick.
const TUMBLE_MS = 700;
const READ_PAUSE_MS = 500;
const PRESENTATION_MS = TUMBLE_MS + READ_PAUSE_MS;

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

  // ── Step-by-step walk animation ─────────────────────────────────────────
  // `visualPositions` drives what PlayersOverlay actually renders.
  // It starts equal to state.positions and is updated one cell at a time
  // during a roll so the token hops across intermediate tiles.
  // The real Supabase state always holds the final (post-snake/ladder) position.
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>({});
  const [isWalking, setIsWalking] = useState(false);
  const [arrivingPlayerId, setArrivingPlayerId] = useState<string | null>(null);
  // Held during the dice presentation window (tumble + read pause). When
  // set, the dice is rendered to BOTH the roller and the opponent showing
  // this value, and the question modal / token walk are suppressed until
  // the window closes.
  const [dicePresentation, setDicePresentation] = useState<DiceResult | null>(null);
  // Ref version of isWalking so synchronous effects can read current value
  // without being blocked by React's render cycle.
  const isWalkingRef = useRef(false);
  // Tracks positions as of the last completed turn (seed for walk start).
  const prevPositionsRef = useRef<Record<string, number> | null>(null);
  // Tracks the last turnCount we animated so we don't replay on re-renders.
  const prevTurnCountRef = useRef<number | null>(null);

  // ── Timer tracking for unmount cleanup ──────────────────────────────────
  // The walk animation schedules nested setTimeouts (pre-bounce → arrival
  // bounce → confetti follow-up) that previously fired on unmounted
  // components when the user exited mid-walk. Every setTimeout / setInterval
  // we create goes into one of these refs so the unmount cleanup can
  // cancel the lot.
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const pendingIntervalsRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set());

  const trackTimeout = useCallback((id: ReturnType<typeof setTimeout>) => {
    pendingTimeoutsRef.current.add(id);
    return id;
  }, []);
  const clearTrackedTimeout = useCallback((id: ReturnType<typeof setTimeout>) => {
    clearTimeout(id);
    pendingTimeoutsRef.current.delete(id);
  }, []);
  const trackInterval = useCallback((id: ReturnType<typeof setInterval>) => {
    pendingIntervalsRef.current.add(id);
    return id;
  }, []);
  const clearTrackedInterval = useCallback((id: ReturnType<typeof setInterval>) => {
    clearInterval(id);
    pendingIntervalsRef.current.delete(id);
  }, []);

  useEffect(() => {
    const timeouts = pendingTimeoutsRef.current;
    const intervals = pendingIntervalsRef.current;
    return () => {
      timeouts.forEach(clearTimeout);
      timeouts.clear();
      intervals.forEach(clearInterval);
      intervals.clear();
    };
  }, []);

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
    const tm = trackTimeout(setTimeout(() => {
      pendingTimeoutsRef.current.delete(tm);
      setToast(null);
    }, 2000));
    return () => clearTrackedTimeout(tm);
  }, [currentPlayer, mode, isHe, trackTimeout, clearTrackedTimeout]);

  // ── Idle sync: keep visualPositions up to date when NOT walking ──────────
  // On mount or after a walk completes, mirror the authoritative positions so
  // non-moving players (positions unchanged by the walk) stay correct, and so
  // that prevPositionsRef is seeded for the next turn's walk.
  //
  // Critical: bail if state.turnCount has advanced past what we've animated.
  // The walk effect (declared after this one) hasn't run yet at this point,
  // so prevTurnCountRef still holds the OLD turn count. Without this guard,
  // we'd snap visualPositions to the post-roll/snake/ladder destination
  // before the dice presentation even begins — which would visibly skip the
  // step-by-step walk and the read pause.
  useEffect(() => {
    if (!state?.positions) return;
    if (isWalkingRef.current) return; // walk effect owns positions during walk
    if (
      prevTurnCountRef.current !== null &&
      (state.turnCount ?? 0) > prevTurnCountRef.current
    ) {
      // A new turn just landed — leave visualPositions where the walk
      // effect can pick them up. Otherwise the token would teleport ahead
      // of (and during) the dice tumble.
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
  // Two stages:
  //   1. Dice presentation (PRESENTATION_MS). The Dice tumbles + settles +
  //      a brief read pause so the player can clearly see the rolled number.
  //      During this window the question modal stays closed and the token
  //      stays put. Both roller and opponent see the same dice value.
  //   2. Token walk. Step-by-step hop across intermediate tiles, then a
  //      snap to the final position (which handles snake/ladder teleport).
  useEffect(() => {
    if (!state || !config) return;
    const turnCount = state.turnCount ?? 0;

    // Seed refs on first render without triggering animation
    if (prevTurnCountRef.current === null) {
      prevTurnCountRef.current = turnCount;
      prevPositionsRef.current = { ...state.positions };
      setVisualPositions({ ...state.positions });
      return;
    }
    // No new turn yet
    if (turnCount <= prevTurnCountRef.current) return;

    const diceResult = state.lastDiceResult;
    if (!diceResult) {
      prevTurnCountRef.current = turnCount;
      return;
    }

    // currentPlayer is still the roller (currentPlayerIndex changes only after answer())
    const playerId = currentPlayer?.id;
    if (!playerId) {
      prevTurnCountRef.current = turnCount;
      return;
    }

    // Don't advance prevTurnCountRef yet: in React StrictMode (Next.js dev)
    // every effect mount/cleanup/remounts. If we advanced it here, the
    // second mount would see `turnCount <= prevTurnCountRef.current` and
    // bail — leaving the walk un-scheduled because the cleanup cancelled
    // the first mount's timer. Instead, advance the ref inside the timer
    // callback once the walk actually begins, after which a re-fire is
    // protected by the same comparison.

    // ── Stage 1: dice presentation ─────────────────────────────────────────
    setDicePresentation(diceResult);

    // Local handles for every timer we schedule in this cycle. The cleanup
    // function below must cancel all of them if the effect re-fires (e.g.
    // a new turn lands very fast) or if the component unmounts mid-walk.
    let interval: ReturnType<typeof setInterval> | null = null;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let preBounceTimer: ReturnType<typeof setTimeout> | null = null;
    let arrivalTimer: ReturnType<typeof setTimeout> | null = null;
    let confettiFollowUpTimer: ReturnType<typeof setTimeout> | null = null;

    const presentationTimer = trackTimeout(setTimeout(() => {
      pendingTimeoutsRef.current.delete(presentationTimer);
      // Advance the turn ref only when the walk actually fires. Until this
      // point a StrictMode remount can re-schedule the same turn; after
      // this point the early-return guard at the top of the effect will
      // dedupe any further re-renders.
      prevTurnCountRef.current = turnCount;
      setDicePresentation(null);

      // ── Stage 2: token walk ─────────────────────────────────────────────
      const prevPos = prevPositionsRef.current?.[playerId] ?? 1;
      const finalPos = state.positions[playerId] ?? 1;
      const boardSize = config.boardSize || 100;

      // Build the naive walk path (no snake/ladder resolution).
      // The visual token hops from prevPos+1 … min(prevPos+dice, boardSize).
      // After the interval finishes we snap to finalPos - if a snake/ladder
      // is involved, PlayersOverlay's spring glides the token there naturally.
      const naiveEnd = Math.min(prevPos + (diceResult as number), boardSize);
      const steps: number[] = [];
      for (let c = prevPos + 1; c <= naiveEnd; c++) steps.push(c);

      if (steps.length === 0) {
        // Already at destination - just sync
        setVisualPositions((prev) => ({ ...prev, [playerId]: finalPos }));
        prevPositionsRef.current = { ...(prevPositionsRef.current ?? {}), [playerId]: finalPos };
        return;
      }

      const STEP_MS = 370; // ms per tile hop - spring settles in ~200 ms at stiffness 620
      // Hard upper bound: max 6 steps + 480ms teleport pause + 520ms bounce = ~3.5s.
      // If something goes wrong the modal must never stay blocked forever.
      const SAFETY_MS = steps.length * STEP_MS + 1200;

      isWalkingRef.current = true;
      setIsWalking(true);
      setArrivingPlayerId(null);

      safetyTimer = trackTimeout(setTimeout(() => {
        if (safetyTimer) pendingTimeoutsRef.current.delete(safetyTimer);
        isWalkingRef.current = false;
        setIsWalking(false);
        setArrivingPlayerId(null);
        setVisualPositions((prev) => ({ ...prev, [playerId]: finalPos }));
        prevPositionsRef.current = { ...(prevPositionsRef.current ?? {}), [playerId]: finalPos };
      }, SAFETY_MS));

      let stepIdx = 0;
      interval = trackInterval(setInterval(() => {
        if (stepIdx < steps.length) {
          const cell = steps[stepIdx];
          setVisualPositions((prev) => ({ ...prev, [playerId]: cell }));
          playSound("move");
          stepIdx++;
        } else {
          if (interval) clearTrackedInterval(interval);
          if (safetyTimer) clearTrackedTimeout(safetyTimer); // walk completed normally - disarm the watchdog

          // Snap to final position (handles snake/ladder teleport).
          // The existing spring in PlayersOverlay glides the token there.
          setVisualPositions((prev) => ({ ...prev, [playerId]: finalPos }));
          prevPositionsRef.current = { ...(prevPositionsRef.current ?? {}), [playerId]: finalPos };

          // For snake/ladder, give the spring ~450 ms to visually travel before
          // the arrival bounce; for a plain landing, a short pause feels right.
          const hasTeleport = finalPos !== naiveEnd;
          const preBounceMs = hasTeleport ? 480 : 80;

          preBounceTimer = trackTimeout(setTimeout(() => {
            if (preBounceTimer) pendingTimeoutsRef.current.delete(preBounceTimer);
            setArrivingPlayerId(playerId);

            arrivalTimer = trackTimeout(setTimeout(() => {
              if (arrivalTimer) pendingTimeoutsRef.current.delete(arrivalTimer);
              setArrivingPlayerId(null);
              isWalkingRef.current = false;
              setIsWalking(false);

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
                  confettiFollowUpTimer = trackTimeout(setTimeout(() => {
                    if (confettiFollowUpTimer) pendingTimeoutsRef.current.delete(confettiFollowUpTimer);
                    confetti({ particleCount: 35, spread: 55, origin: o, colors, startVelocity: 22, gravity: 1.3, scalar: 0.75, ticks: 70 });
                  }, 180));
                }
              }
            }, 520));
          }, preBounceMs));
        }
      }, STEP_MS));
    }, PRESENTATION_MS));

    return () => {
      // Cancel everything from the current cycle. Component-unmount cleanup
      // (the empty-deps effect above) is a backstop for anything still in
      // the tracker sets.
      clearTrackedTimeout(presentationTimer);
      if (interval) clearTrackedInterval(interval);
      if (safetyTimer) clearTrackedTimeout(safetyTimer);
      if (preBounceTimer) clearTrackedTimeout(preBounceTimer);
      if (arrivalTimer) clearTrackedTimeout(arrivalTimer);
      if (confettiFollowUpTimer) clearTrackedTimeout(confettiFollowUpTimer);
    };
  // Only fire when a new turn has been committed to Supabase
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.turnCount]);

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
      const winFollowUp1 = trackTimeout(setTimeout(() => {
        pendingTimeoutsRef.current.delete(winFollowUp1);
        confetti({ particleCount: 60, spread: 100, origin: o, colors, scalar: 0.9, startVelocity: 30 });
      }, 300));
      const winFollowUp2 = trackTimeout(setTimeout(() => {
        pendingTimeoutsRef.current.delete(winFollowUp2);
        confetti({ particleCount: 40, spread: 60, origin: o, colors, scalar: 1.2, startVelocity: 50 });
      }, 600));
    }
    if (state.phase !== "ended") {
      winFiredRef.current = false;
    }
    lastPhaseRef.current = state.phase;
  }, [state, trackTimeout]);

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
    const ladderFollowUp = trackTimeout(setTimeout(() => {
      pendingTimeoutsRef.current.delete(ladderFollowUp);
      confetti({ particleCount: 35, spread: 55, origin: o, colors, startVelocity: 22, gravity: 1.3, scalar: 0.75, ticks: 70 });
    }, 180));
  }, [state, trackTimeout]);

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

  // Synchronous "is the post-roll animation sequence in progress?" check.
  // dicePresentation/isWalking are React state, so they're not yet updated
  // in the very first render after a state commit — leaving a one-frame
  // window where state.phase === "question" but neither flag is set, which
  // briefly flashes the question modal open before the dice tumble starts.
  // prevTurnCountRef is mutated synchronously inside the walk effect, so
  // comparing it to state.turnCount catches that one-frame race.
  const turnAnimationActive =
    isWalking ||
    dicePresentation !== null ||
    (state != null &&
      prevTurnCountRef.current !== null &&
      (state.turnCount ?? 0) > prevTurnCountRef.current);

  if (!room || !state || !config) {
    return (
      <GamePageBackground gameSlug="snakes-couples" primaryColor="#16a34a">
        <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
          <div className="text-amber-50" dir={isHe ? "rtl" : "ltr"}>
            {t("loading")}
          </div>
        </main>
      </GamePageBackground>
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
    <GamePageBackground gameSlug="snakes-couples" primaryColor="#16a34a">
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
        {/* ───────────────────── Green zone - header (logo + game title) */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            "order-1 md:order-none",
            "md:col-start-1 md:row-start-1",
            "flex items-center gap-3 rounded-3xl border border-emerald-400/25",
            "bg-gradient-to-br from-emerald-900/60 via-slate-900/50 to-emerald-900/50",
            "px-4 py-3 backdrop-blur-md shadow-[0_10px_30px_-12px_rgba(16,185,129,0.45)]",
          )}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/8 ring-1 ring-white/15">
            <Image
              src="/mioshy-white.svg"
              alt="Mioshy"
              width={36}
              height={36}
              className="opacity-95"
              priority
            />
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="truncate text-base font-extrabold tracking-tight text-amber-50">
              {t("gameName")}
            </div>
            <div className="truncate text-xs text-amber-50/70">
              {t("gameSubtitle")}
            </div>
          </div>
          {/* On mobile the exit lives inline in the header. On desktop the
              red exit button sits at the bottom of the sidebar (see below). */}
          {onExit ? (
            <button
              type="button"
              className="rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-100 backdrop-blur transition hover:bg-rose-500/25 md:hidden"
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
            />

            {/* Question modal - only opens once the entire post-roll
                animation sequence (dice tumble + read pause + token walk +
                arrival bounce) has finished. The synchronous turnAnimationActive
                check above prevents a one-frame flash of the modal between
                the state commit and the walk effect firing. */}
            <QuestionModal
              open={state.phase === "question" && !turnAnimationActive}
              question={state.currentQuestion}
              playerName={currentPlayer?.user_name ?? ""}
              avatar={currentPlayer?.avatar ?? "💜"}
              penalty={{ penaltyType: config.penaltyType, penaltySteps: config.penaltySteps }}
              onAnswer={answer}
              originPct={currentCellCenter}
            />
          </div>
        </section>

        {/* ───────────────────── White zone - dice surface (desktop) */}
        <section
          className={cn(
            "hidden md:flex",
            "md:col-start-1 md:row-start-2",
            "items-center justify-center rounded-3xl",
            "border border-[#a07040]/30",
            // Premium dark table surface - deep felt / baize
            "bg-[radial-gradient(ellipse_at_50%_30%,_#152b1e_0%,_#0a1810_55%,_#060d09_100%)]",
            "p-5 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.04)]",
          )}
          aria-label={t("diceSurfaceLabel")}
        >
          <AnimatePresence mode="wait">
            {(isMyTurn && state.phase === "waiting_flip") || turnAnimationActive ? (
              <motion.div
                key="dice-desktop"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: "spring", stiffness: 360, damping: 26 }}
              >
                <Dice
                  onRoll={async () => {
                    playSound("dice");
                    await roll();
                  }}
                  // Disabled during the presentation window (or when it's not
                  // your turn) so a roll can't be triggered while we're
                  // showing the result of the previous one.
                  disabled={
                    dicePresentation !== null ||
                    !isMyTurn ||
                    state.phase !== "waiting_flip"
                  }
                  // During the presentation window, both roller and opponent
                  // see the same dice value; once the window closes, the
                  // dice unmounts (or returns to the waiting face).
                  result={dicePresentation ?? state.lastDiceResult ?? null}
                  presenting={dicePresentation !== null}
                  playerColor={currentPlayer?.color ?? "#f59e0b"}
                />
              </motion.div>
            ) : (
              <motion.div
                key="dice-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center text-sm font-semibold text-slate-600"
              >
                {currentPlayer ? (
                  <>
                    <div className="text-3xl">{currentPlayer.avatar}</div>
                    <div className="mt-1">{t("turnOf", { name: currentPlayer.user_name })}</div>
                  </>
                ) : (
                  t("waiting")
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ───────────────────── Blue zone - players list */}
        <section
          className={cn(
            "order-3 md:order-none",
            "md:col-start-1 md:row-start-3",
            "flex flex-col gap-3 rounded-3xl border border-sky-400/25",
            "bg-gradient-to-br from-sky-950/55 via-slate-900/55 to-sky-900/55",
            "p-4 backdrop-blur-md shadow-[0_10px_30px_-12px_rgba(56,189,248,0.45)]",
          )}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-tight text-sky-100">
              {t("playersActive")}
            </h2>
            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-100">
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
                      ? "border-amber-300/60 bg-amber-400/10"
                      : "border-white/10 bg-white/[0.04]",
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
                    <div className="truncate text-sm font-semibold text-slate-100">
                      {p.user_name}
                      {isMe ? (
                        <span className="ms-2 rounded-full bg-white/10 px-1.5 py-0.5 text-xs font-bold text-slate-200">
                          {t("you")}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {p.is_host ? t("host") : `#${p.order_index + 1}`}
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="ms-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-300 shadow-[0_0_10px_#fcd34d]" />
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

        {/* Floating dice popup - MOBILE ONLY. Slides up from the bottom when
            it's the user's turn. On desktop the dice lives in the white
            surface above. */}
        <AnimatePresence>
          {(isMyTurn && state.phase === "waiting_flip") || turnAnimationActive ? (
            <motion.div
              key="dice-dock-mobile"
              initial={{ y: 140, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 140, opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 md:hidden"
            >
              <div className="rounded-3xl border border-[#a07040]/35 bg-[radial-gradient(ellipse_at_50%_25%,_#152b1e_0%,_#0a1810_60%,_#060d09_100%)] p-3 shadow-[0_18px_40px_-10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <Dice
                  onRoll={async () => {
                    playSound("dice");
                    await roll();
                  }}
                  disabled={
                    dicePresentation !== null ||
                    !isMyTurn ||
                    state.phase !== "waiting_flip"
                  }
                  result={dicePresentation ?? state.lastDiceResult ?? null}
                  presenting={dicePresentation !== null}
                  playerColor={currentPlayer?.color ?? "#f59e0b"}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Waiting hint for non-turn players on mobile only */}
        <AnimatePresence>
          {!isMyTurn && state.phase === "waiting_flip" ? (
            <motion.div
              key="waiting-hint"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-semibold text-amber-50 backdrop-blur md:hidden"
            >
              {mode === "local"
                ? isHe
                  ? `העבירו את המכשיר ל-${currentPlayer?.user_name ?? ""} ${currentPlayer?.avatar ?? ""}`
                  : `Pass the device to ${currentPlayer?.user_name ?? ""} ${currentPlayer?.avatar ?? ""}`
                : isHe
                  ? `ממתינים ל-${currentPlayer?.user_name ?? ""}…`
                  : `Waiting for ${currentPlayer?.user_name ?? ""}…`}
            </motion.div>
          ) : null}
        </AnimatePresence>

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
      </main>
    </GamePageBackground>
  );
}
