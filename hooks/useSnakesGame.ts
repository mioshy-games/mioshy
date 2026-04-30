"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  DiceResult,
  GameConfig,
  GameLogEntry,
  GamePlayer,
  GameRoom,
  GameState,
  Question,
} from "@/lib/snakes/types";
import {
  applyPenalty,
  calculateNewPosition,
  getNextPlayerIndex,
  pickNextQuestion,
  rollDice,
} from "@/lib/snakes/gameEngine";

function nowIso() {
  return new Date().toISOString();
}

function pushLog(prev: GameLogEntry[], entry: GameLogEntry) {
  const next = [...prev, entry];
  return next.length > 50 ? next.slice(-50) : next;
}

function pushLogs(prev: GameLogEntry[], entries: GameLogEntry[]) {
  let out = prev;
  for (const e of entries) out = pushLog(out, e);
  return out;
}

export interface UseSnakesGame {
  state: GameState | null;
  config: GameConfig | null;
  currentPlayer: GamePlayer | null;
  isMyTurn: boolean;
  error: string | null;
  /** Roll the dice, apply movement + snake/ladder, advance phase. */
  roll: () => Promise<DiceResult | null>;
  /** Backward-compatible alias for the old coin-flip hook method. */
  flip: () => Promise<DiceResult | null>;
  answer: (didAnswer: boolean) => Promise<void>;
}

export function useSnakesGame({
  room,
  players,
  myPlayerId,
  updateGameState,
}: {
  room: GameRoom | null;
  players: GamePlayer[];
  myPlayerId: string | null;
  updateGameState: (patch: Partial<GameState>) => Promise<void>;
}): UseSnakesGame {
  const [error, setError] = useState<string | null>(null);

  const state = useMemo(() => {
    if (!room) return null;
    return room.game_state as unknown as GameState;
  }, [room]);

  const config = useMemo(() => {
    if (!room) return null;
    return room.config as unknown as GameConfig;
  }, [room]);

  const currentPlayer = useMemo(() => {
    if (!state) return null;
    return players[state.currentPlayerIndex] ?? null;
  }, [players, state]);

  const isMyTurn = useMemo(() => {
    if (!state || !myPlayerId) return false;
    const cp = players[state.currentPlayerIndex];
    return cp?.id === myPlayerId;
  }, [myPlayerId, players, state]);

  const roll = useCallback(async (): Promise<DiceResult | null> => {
    setError(null);
    if (!room || !state || !config) return null;
    if (!isMyTurn) {
      setError("זה לא התור שלך");
      return null;
    }
    if (state.phase !== "waiting_flip") return null;
    const me = currentPlayer;
    if (!me) return null;

    const result = rollDice();
    const steps = result; // dice face === steps
    const curPos = state.positions[me.id] ?? me.position ?? 1;

    const move = calculateNewPosition(curPos, steps, config, config.boardSize);
    // Non-repeating draw - the remaining pool is persisted in game_state so it
    // survives refreshes and is shared across all connected clients of a room.
    const { question: q, nextPool } = pickNextQuestion(
      state.questionPool,
      config.questions ?? [],
    );

    const logRoll: GameLogEntry = {
      timestamp: nowIso(),
      playerName: me.user_name,
      avatar: me.avatar,
      action: `קובייה: ${result} (+${steps})`,
      type: "flip",
    };

    const logMove: GameLogEntry = {
      timestamp: nowIso(),
      playerName: me.user_name,
      avatar: me.avatar,
      action: `זז/ה ל-${move.final}`,
      type: move.event === "win" ? "win" : "move",
    };

    const extra =
      move.event === "snake"
        ? ({
            timestamp: nowIso(),
            playerName: me.user_name,
            avatar: me.avatar,
            action: "נחש! ירידה למטה",
            type: "snake",
          } satisfies GameLogEntry)
        : move.event === "ladder"
          ? ({
              timestamp: nowIso(),
              playerName: me.user_name,
              avatar: me.avatar,
              action: "סולם! עלייה למעלה",
              type: "ladder",
            } satisfies GameLogEntry)
          : null;

    const nextPositions = { ...state.positions, [me.id]: move.final };
    const next: Partial<GameState> = {
      lastDiceResult: result,
      lastCoinResult: null,
      positions: nextPositions,
      phase: move.event === "win" ? "ended" : "question",
      currentQuestion: move.event === "win" ? null : (q as Question),
      // Persist the draw pool only when we actually consumed a question.
      // On win we end without drawing, so leave the pool untouched.
      ...(move.event === "win" ? {} : { questionPool: nextPool }),
      winner: move.event === "win" ? me.id : null,
      turnCount: (state.turnCount ?? 0) + 1,
      log: pushLogs(state.log ?? [], [logRoll, logMove, ...(extra ? [extra] : [])]),
    };

    await updateGameState(next);
    return result;
  }, [config, currentPlayer, isMyTurn, room, state, updateGameState]);

  // Back-compat alias for any call site still using .flip()
  const flip = roll;

  const answer = useCallback(
    async (didAnswer: boolean) => {
      setError(null);
      if (!room || !state || !config) return;
      if (!isMyTurn) {
        setError("זה לא התור שלך");
        return;
      }
      if (state.phase !== "question") return;
      const me = currentPlayer;
      if (!me) return;

      let nextPos = state.positions[me.id] ?? 1;
      const log: GameLogEntry[] = [];

      const q = state.currentQuestion;
      if (q) {
        log.push({
          timestamp: nowIso(),
          playerName: me.user_name,
          avatar: me.avatar,
          action: q.type === "challenge" ? "אתגר" : "שאלה",
          type: "question",
        });
      }

      if (!didAnswer) {
        nextPos = applyPenalty(nextPos, {
          penaltyType: config.penaltyType,
          penaltySteps: config.penaltySteps,
        });
        log.push({
          timestamp: nowIso(),
          playerName: me.user_name,
          avatar: me.avatar,
          action:
            config.penaltyType === "start"
              ? "דילוג → חזרה להתחלה"
              : `דילוג → חזרה ${config.penaltySteps} צעדים`,
          type: "penalty",
        });
      }

      const nextPositions = { ...state.positions, [me.id]: nextPos };
      const nextIndex = getNextPlayerIndex(state.currentPlayerIndex ?? 0, players.length);

      await updateGameState({
        positions: nextPositions,
        currentPlayerIndex: nextIndex,
        phase: "waiting_flip",
        currentQuestion: null,
        log: pushLogs(state.log ?? [], log),
      } as unknown as Partial<GameState>);
    },
    [config, currentPlayer, isMyTurn, players.length, room, state, updateGameState],
  );

  return { state, config, currentPlayer, isMyTurn, error, roll, flip, answer };
}

