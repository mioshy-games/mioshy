"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  GameConfig,
  GamePlayer,
  GameRoom,
  GameState,
  PlayerInfo,
} from "@/lib/snakes/types";

/**
 * useLocalSnakesStore - in-memory state for single-device (pass-the-phone)
 * play. Shapes itself like the remote Supabase data so the game UI can treat
 * both modes the same via GameAdapter.
 *
 * This store is deliberately small. It holds:
 *   • a synthetic GameRoom (status, game_state, config)
 *   • the ordered list of players
 *
 * No network, no auth, no realtime - everything is local, synchronous, and
 * reset-on-refresh. That's fine: pass-the-phone sessions are ephemeral by
 * nature.
 */

function synthId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export interface LocalSnakesStore {
  room: GameRoom | null;
  players: GamePlayer[];

  /** Create a fresh local room in lobby state with the given config. */
  createRoom: (config: GameConfig) => void;

  /** Add a player to the lobby. Returns the created player id. */
  addPlayer: (info: PlayerInfo & { avatar: string; color: string }) => string;

  /** Remove a player from the lobby by id. */
  removePlayer: (id: string) => void;

  /** Update a single player's avatar/color/name (lobby-only). */
  patchPlayer: (id: string, patch: Partial<Pick<GamePlayer, "avatar" | "color" | "user_name">>) => void;

  /** Move from lobby → playing with the given initial GameState. */
  startGame: (initialState: GameState) => void;

  /** Apply a partial update to game_state. */
  updateGameState: (patch: Partial<GameState>) => void;

  /** Clear everything (return to menu). */
  reset: () => void;
}

export const useLocalSnakesStore = create<LocalSnakesStore>()(
  immer((set) => ({
    room: null,
    players: [],

    createRoom: (config) =>
      set((s) => {
        s.room = {
          id: synthId("local-room"),
          code: "LOCAL",
          game_type: "snakes",
          status: "lobby",
          host_id: null,
          game_state: {
            currentPlayerIndex: 0,
            positions: {},
            phase: "waiting_flip",
            currentQuestion: null,
            lastCoinResult: null,
            lastDiceResult: null,
            winner: null,
            turnCount: 0,
            log: [],
          },
          config,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        s.players = [];
      }),

    addPlayer: (info) => {
      const id = synthId("local-player");
      set((s) => {
        if (!s.room) return;
        const orderIndex = s.players.length;
        s.players.push({
          id,
          room_id: s.room.id,
          user_id: null,
          user_name: info.userName,
          avatar: info.avatar,
          color: info.color,
          position: 1,
          order_index: orderIndex,
          is_host: orderIndex === 0,
          is_locked: true,
          is_ready: true,
          created_at: nowIso(),
        });
        // seed position in game_state too
        s.room.game_state.positions[id] = 1;
      });
      return id;
    },

    removePlayer: (id) =>
      set((s) => {
        s.players = s.players.filter((p) => p.id !== id);
        // re-number order_index
        s.players.forEach((p, i) => {
          p.order_index = i;
          p.is_host = i === 0;
        });
        if (s.room) {
          delete s.room.game_state.positions[id];
        }
      }),

    patchPlayer: (id, patch) =>
      set((s) => {
        const p = s.players.find((x) => x.id === id);
        if (!p) return;
        Object.assign(p, patch);
      }),

    startGame: (initialState) =>
      set((s) => {
        if (!s.room) return;
        s.room.status = "playing";
        s.room.game_state = initialState;
        s.room.updated_at = nowIso();
      }),

    updateGameState: (patch) =>
      set((s) => {
        if (!s.room) return;
        s.room.game_state = { ...s.room.game_state, ...patch } as GameState;
        s.room.updated_at = nowIso();
        if (patch.phase === "ended") {
          s.room.status = "ended";
        }
      }),

    reset: () =>
      set((s) => {
        s.room = null;
        s.players = [];
      }),
  })),
);
