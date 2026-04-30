"use client";

import { useCallback, useMemo } from "react";
import { useLocalSnakesStore } from "@/lib/store/useLocalSnakesStore";
import type { GameAdapter } from "@/lib/snakes/adapter";
import type { GameState } from "@/lib/snakes/types";

/**
 * useLocalGameRoom - single-device, pass-the-phone adapter.
 *
 * Mirrors the surface of `useGameRoom` so the Snakes game UI can run
 * unchanged. The key quirk: in local mode `myPlayerId` is always the id of
 * whoever's turn it currently is. That way `isMyTurn` inside
 * `useSnakesGame` resolves true for every player as the phone is handed
 * around.
 *
 * Everything here is synchronous but awaited to preserve the async contract
 * of the remote hook - this lets the UI await updateGameState() uniformly.
 */
export function useLocalGameRoom(): GameAdapter {
  const room = useLocalSnakesStore((s) => s.room);
  const players = useLocalSnakesStore((s) => s.players);
  const updatePatch = useLocalSnakesStore((s) => s.updateGameState);
  const resetStore = useLocalSnakesStore((s) => s.reset);

  const myPlayerId = useMemo(() => {
    if (!room || players.length === 0) return null;
    const idx = room.game_state.currentPlayerIndex ?? 0;
    return players[idx]?.id ?? null;
  }, [room, players]);

  const updateGameState = useCallback(
    async (patch: Partial<GameState>) => {
      updatePatch(patch);
    },
    [updatePatch],
  );

  const leaveRoom = useCallback(async () => {
    resetStore();
  }, [resetStore]);

  return {
    mode: "local",
    room,
    players,
    myPlayerId,
    updateGameState,
    leaveRoom,
    error: null,
  };
}
