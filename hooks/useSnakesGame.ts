"use client";

import { useCallback, useMemo, useState } from "react";
import type { GameConfig, GameLogEntry, GamePlayer, GameRoom, GameState, Question } from "@/lib/snakes/types";
import { applyPenalty, calculateNewPosition, flipCoin, getNextPlayerIndex, getRandomQuestion } from "@/lib/snakes/gameEngine";

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
  flip: () => Promise<void>;
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

  const flip = useCallback(async () => {
    setError(null);
    if (!room || !state || !config) return;
    if (!isMyTurn) {
      setError("זה לא התור שלך");
      return;
    }
    if (state.phase !== "waiting_flip") return;
    const me = currentPlayer;
    if (!me) return;

    const result = flipCoin();
    const steps = result === "heads" ? config.coinHeadsSteps : config.coinTailsSteps;
    const curPos = state.positions[me.id] ?? me.position ?? 1;

    const move = calculateNewPosition(curPos, steps, config, config.boardSize);
    const q = getRandomQuestion(config.questions ?? []);

    const logFlip: GameLogEntry = {
      timestamp: nowIso(),
      playerName: me.user_name,
      avatar: me.avatar,
      action: result === "heads" ? `עץ (+${steps})` : `פלי (+${steps})`,
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
      lastCoinResult: result,
      positions: nextPositions,
      phase: move.event === "win" ? "ended" : "question",
      currentQuestion: move.event === "win" ? null : (q as Question),
      winner: move.event === "win" ? me.id : null,
      turnCount: (state.turnCount ?? 0) + 1,
      log: pushLogs(state.log ?? [], [logFlip, logMove, ...(extra ? [extra] : [])]),
    } as unknown as Partial<GameState>;

    await updateGameState(next);
  }, [config, currentPlayer, isMyTurn, room, state, updateGameState]);

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

  return { state, config, currentPlayer, isMyTurn, error, flip, answer };
}

