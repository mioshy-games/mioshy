"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import confetti from "canvas-confetti";
import { SnakesBoard } from "@/components/game/snakes/SnakesBoard";
import { Dice } from "@/components/game/snakes/Dice";
import { QuestionModal } from "@/components/game/snakes/QuestionModal";
import { GamePageBackground } from "@/components/game/GamePageBackground";
import { useSnakesGame } from "@/hooks/useSnakesGame";
import type { GameAdapter } from "@/lib/snakes/adapter";
import { cellToBoardPercent } from "@/lib/snakes/boardUtils";
import { playSound } from "@/lib/sounds";

/**
 * SnakesGameBoard — immersive, adapter-agnostic game screen.
 *
 * Layout (per Itzik's brief):
 *   • Full-viewport animated background — blobs + particles like the wheel games.
 *   • Centered board dominates the screen. No sidebar, no player list, no log.
 *   • A tiny floating header (game title + exit) at top-right.
 *   • The die appears only when it's the current player's turn, sliding in
 *     from the bottom; it animates out as soon as the turn transitions.
 *   • The question modal's animation origin is the *current player's cell*
 *     on the board — so it looks like the question is erupting from the
 *     exact tile they landed on.
 *   • Win screen overlays confetti + next steps.
 *
 * The component is dual-mode through the GameAdapter: remote (Supabase)
 * and local (pass-the-phone Zustand) both produce the same UI.
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
  const winFiredRef = useRef(false);

  // Pass-the-phone toast + gentle turn indicator
  useEffect(() => {
    if (!currentPlayer) return;
    if (lastTurnPlayerId.current === currentPlayer.id) return;
    lastTurnPlayerId.current = currentPlayer.id;
    const msg =
      mode === "local"
        ? `מעבירים את המכשיר ל-${currentPlayer.user_name} ${currentPlayer.avatar}`
        : `התור של ${currentPlayer.user_name}`;
    setToast(msg);
    const tm = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(tm);
  }, [currentPlayer, mode]);

  // Sound cues + confetti on win
  useEffect(() => {
    if (!state) return;
    const prev = lastPhaseRef.current;
    const lastLog = state.log[state.log.length - 1];
    if (lastLog?.type === "snake") playSound("snake");
    else if (lastLog?.type === "ladder") playSound("ladder");
    else if (lastLog?.type === "move") playSound("move");
    if (state.phase === "ended" && prev !== "ended" && !winFiredRef.current) {
      winFiredRef.current = true;
      playSound("win");
      const burst = (originX: number) =>
        confetti({
          particleCount: 110,
          spread: 70,
          origin: { x: originX, y: 0.55 },
          scalar: 1.1,
        });
      burst(0.2);
      setTimeout(() => burst(0.5), 250);
      setTimeout(() => burst(0.8), 500);
    }
    if (state.phase !== "ended") {
      winFiredRef.current = false;
    }
    lastPhaseRef.current = state.phase;
  }, [state]);

  if (!room || !state || !config) {
    return (
      <GamePageBackground gameSlug="snakes-couples" primaryColor="#16a34a">
        <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
          <div className="text-amber-50" dir="rtl">
            {t("loading")}
          </div>
        </main>
      </GamePageBackground>
    );
  }

  const winner = state.winner ? players.find((p) => p.id === state.winner) ?? null : null;

  // Where on the board the current player's token sits — used both as the
  // modal's animation origin and as the hint anchor for the floating dice.
  const currentCellCenter = currentPlayer
    ? cellToBoardPercent(
        state.positions?.[currentPlayer.id] ?? 1,
        config.boardSize || 100,
      )
    : null;

  return (
    <GamePageBackground gameSlug="snakes-couples" primaryColor="#16a34a">
      <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center px-3 py-4 sm:py-6" dir="rtl">
        {/* Minimal floating header — just the exit button; title + code are
            small enough not to steal focus from the board. */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="pointer-events-none absolute left-0 right-0 top-0 z-40 flex items-center justify-between gap-3 p-3 sm:p-4"
        >
          <div className="pointer-events-auto rounded-full border border-amber-200/20 bg-black/40 px-3 py-1.5 text-xs font-semibold text-amber-50 backdrop-blur">
            🐍 {mode === "local" ? "משחק מקומי" : room.code}
          </div>
          {onExit ? (
            <button
              type="button"
              className="pointer-events-auto rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs font-semibold text-slate-100 backdrop-blur transition hover:bg-white/10"
              onClick={() => void onExit()}
            >
              {t("leave")}
            </button>
          ) : null}
        </motion.div>

        {/* The board — hero element */}
        <div className="relative mt-10 sm:mt-6">
          <SnakesBoard
            config={config}
            positions={state.positions ?? {}}
            players={players}
            currentPlayerId={currentPlayer?.id ?? null}
          />

          {/* Question modal — the animation origin is the current player's
              cell percentage, so it pops out right from their token. */}
          <QuestionModal
            open={state.phase === "question"}
            question={state.currentQuestion}
            playerName={currentPlayer?.user_name ?? ""}
            avatar={currentPlayer?.avatar ?? "💜"}
            penalty={{ penaltyType: config.penaltyType, penaltySteps: config.penaltySteps }}
            onAnswer={answer}
            originPct={currentCellCenter}
          />
        </div>

        {/* Floating dice — only appears on your turn, animates in/out */}
        <AnimatePresence>
          {isMyTurn && state.phase === "waiting_flip" ? (
            <motion.div
              key="dice-dock"
              initial={{ y: 140, opacity: 0, scale: 0.7 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 140, opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2"
            >
              <div
                className="rounded-3xl border border-amber-200/30 bg-black/55 p-3 backdrop-blur-md shadow-[0_18px_40px_-10px_rgba(0,0,0,0.8)]"
              >
                <Dice
                  onRoll={async () => {
                    playSound("dice");
                    await roll();
                  }}
                  disabled={state.phase !== "waiting_flip"}
                  result={state.lastDiceResult ?? null}
                  playerColor={currentPlayer?.color ?? "#f59e0b"}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Waiting hint for non-turn players — tiny, unobtrusive */}
        <AnimatePresence>
          {!isMyTurn && state.phase === "waiting_flip" ? (
            <motion.div
              key="waiting-hint"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="pointer-events-none fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-semibold text-amber-50 backdrop-blur"
            >
              {mode === "local"
                ? `העבירו את המכשיר ל-${currentPlayer?.user_name ?? ""} ${currentPlayer?.avatar ?? ""}`
                : `ממתינים ל-${currentPlayer?.user_name ?? ""}…`}
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
              dir="rtl"
            >
              {toast}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Win overlay */}
        <AnimatePresence>
          {state.phase === "ended" ? (
            <motion.div
              key="win-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              dir="rtl"
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
                    {winner ? `${winner.user_name} ניצח/ה!` : "יש מנצח!"}
                  </div>
                  <p className="mt-2 text-sm text-slate-300/80">
                    {mode === "local"
                      ? "שחקו שוב או צאו ללובי לעוד משחק"
                      : "המשחק הסתיים. המארח יכול להתחיל משחק חדש."}
                  </p>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {onExit ? (
                    <button
                      type="button"
                      className="min-h-[48px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-100 hover:bg-white/10"
                      onClick={() => void onExit()}
                    >
                      חזרה ללובי
                    </button>
                  ) : null}
                  {onPlayAgain ? (
                    <button
                      type="button"
                      className="min-h-[48px] rounded-2xl bg-gradient-to-r from-amber-400 to-rose-400 px-4 py-3 text-sm font-bold text-stone-900 hover:brightness-110 disabled:opacity-50"
                      onClick={() => void onPlayAgain()}
                    >
                      משחק חדש
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
