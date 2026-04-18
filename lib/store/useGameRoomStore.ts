"use client";

/**
 * useGameRoomStore
 *
 * Zustand store for the Snake & Ladders multiplayer lobby/game room.
 *
 * Responsibilities:
 *  - Hold the current room and players list
 *  - Track "my player" identity
 *  - Expose derived helpers: takenAvatars, takenColors, myPlayer
 *  - Hold transient UI state: pending avatar/color the local player is hovering
 *    or has selected but hasn't yet "locked in"
 *  - Track lock-claim in-progress / error state
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { GamePlayer, GameRoom } from "@/lib/snakes/types";

// ─────────────────────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────────────────────

export interface GameRoomState {
  // ── Persistent room data ──────────────────────────────────────────────────
  room: GameRoom | null;
  players: GamePlayer[];
  myPlayerId: string | null;

  // ── Local (UI) draft selection ────────────────────────────────────────────
  /** The avatar the local player has clicked but not yet locked */
  draftAvatar: string;
  /** The colour the local player has clicked but not yet locked */
  draftColor: string;

  // ── Async state ───────────────────────────────────────────────────────────
  isLocking: boolean;
  lockError: string | null;

  // ── Derived (updated whenever players list changes) ───────────────────────
  /** Set of avatar values locked by *other* players in this room */
  takenAvatars: Set<string>;
  /** Set of color hex values locked by *other* players in this room */
  takenColors: Set<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions shape
// ─────────────────────────────────────────────────────────────────────────────

export interface GameRoomActions {
  setRoom: (room: GameRoom | null) => void;
  setPlayers: (players: GamePlayer[]) => void;
  upsertPlayer: (player: GamePlayer) => void;
  removePlayer: (playerId: string) => void;
  setMyPlayerId: (id: string | null) => void;

  setDraftAvatar: (avatar: string) => void;
  setDraftColor: (color: string) => void;

  setIsLocking: (v: boolean) => void;
  setLockError: (msg: string | null) => void;

  /** Reset everything (e.g. when leaving the room) */
  reset: () => void;
}

export type GameRoomStore = GameRoomState & GameRoomActions;

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_AVATAR = "💜";
const DEFAULT_COLOR  = "#c084fc";

const initialState: GameRoomState = {
  room:        null,
  players:     [],
  myPlayerId:  null,
  draftAvatar: DEFAULT_AVATAR,
  draftColor:  DEFAULT_COLOR,
  isLocking:   false,
  lockError:   null,
  takenAvatars: new Set(),
  takenColors:  new Set(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: recompute taken sets from the players list
// ─────────────────────────────────────────────────────────────────────────────

function recomputeTaken(
  players: GamePlayer[],
  myPlayerId: string | null,
): Pick<GameRoomState, "takenAvatars" | "takenColors"> {
  const takenAvatars = new Set<string>();
  const takenColors  = new Set<string>();
  for (const p of players) {
    if (!p.is_locked) continue;
    if (p.id === myPlayerId) continue;  // don't block our own locked choice
    takenAvatars.add(p.avatar);
    takenColors.add(p.color);
  }
  return { takenAvatars, takenColors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useGameRoomStore = create<GameRoomStore>()(
  immer((set) => ({
    ...initialState,

    setRoom: (room) =>
      set((s) => {
        s.room = room;
      }),

    setPlayers: (players) =>
      set((s) => {
        s.players = players;
        const { takenAvatars, takenColors } = recomputeTaken(players, s.myPlayerId);
        s.takenAvatars = takenAvatars;
        s.takenColors  = takenColors;

        // If my own locked choice changed in DB (shouldn't, but guard anyway),
        // keep draft in sync with actual locked value.
        const me = players.find((p) => p.id === s.myPlayerId);
        if (me?.is_locked) {
          s.draftAvatar = me.avatar;
          s.draftColor  = me.color;
        }
      }),

    upsertPlayer: (player) =>
      set((s) => {
        const idx = s.players.findIndex((p) => p.id === player.id);
        if (idx === -1) {
          s.players.push(player);
        } else {
          s.players[idx] = player;
        }
        const { takenAvatars, takenColors } = recomputeTaken(s.players, s.myPlayerId);
        s.takenAvatars = takenAvatars;
        s.takenColors  = takenColors;
      }),

    removePlayer: (playerId) =>
      set((s) => {
        s.players = s.players.filter((p) => p.id !== playerId);
        const { takenAvatars, takenColors } = recomputeTaken(s.players, s.myPlayerId);
        s.takenAvatars = takenAvatars;
        s.takenColors  = takenColors;
      }),

    setMyPlayerId: (id) =>
      set((s) => {
        s.myPlayerId = id;
        const { takenAvatars, takenColors } = recomputeTaken(s.players, id);
        s.takenAvatars = takenAvatars;
        s.takenColors  = takenColors;
      }),

    setDraftAvatar: (avatar) =>
      set((s) => {
        s.draftAvatar = avatar;
      }),

    setDraftColor: (color) =>
      set((s) => {
        s.draftColor = color;
      }),

    setIsLocking: (v) =>
      set((s) => {
        s.isLocking = v;
      }),

    setLockError: (msg) =>
      set((s) => {
        s.lockError = msg;
      }),

    reset: () =>
      set(() => ({ ...initialState })),
  })),
);

// ─────────────────────────────────────────────────────────────────────────────
// Convenience selectors
// ─────────────────────────────────────────────────────────────────────────────

export const selectMyPlayer = (s: GameRoomStore): GamePlayer | null =>
  s.players.find((p) => p.id === s.myPlayerId) ?? null;

export const selectIsMyPlayerLocked = (s: GameRoomStore): boolean =>
  s.players.find((p) => p.id === s.myPlayerId)?.is_locked ?? false;

export const selectAllLocked = (s: GameRoomStore): boolean =>
  s.players.length > 0 && s.players.every((p) => p.is_locked);
