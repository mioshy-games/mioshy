/**
 * GameAdapter — the common contract between the two play modes.
 *
 *   Local  (pass-the-phone, single device)  -> useLocalGameRoom
 *   Remote (multi-device via Supabase)      -> useGameRoom
 *
 * Both hooks return the *same shape*, so the Snakes UI never needs to know
 * which transport it's running on. This is what lets one codebase serve both
 * "phone in the middle of the table" play and "partners on two phones" play.
 *
 * The contract is intentionally minimal — everything the game UI actually
 * needs, and nothing more:
 *
 *   • reactive data (room, players, myPlayerId, error)
 *   • updateGameState(patch) — apply a partial state update
 *   • leaveRoom() — tear down / return to menu
 *   • mode — so the UI can render mode-specific affordances
 *     (e.g. "pass the phone to {{name}}" toast in local mode)
 */

import type { GamePlayer, GameRoom, GameState } from "./types";

export type GameMode = "local" | "remote";

export interface GameAdapter {
  /** "local" | "remote" — UI can branch on this for pass-the-phone hints */
  mode: GameMode;

  /** Reactive room (status, config, game_state). */
  room: GameRoom | null;

  /** Reactive ordered players list. */
  players: GamePlayer[];

  /**
   * In remote mode: the id of the authenticated player on this device.
   * In local mode:  always the id of the player whose turn it is (so
   *                 `isMyTurn` resolves true — the phone is being passed).
   */
  myPlayerId: string | null;

  /** Apply a partial update to game_state. Server-authoritative in remote. */
  updateGameState: (patch: Partial<GameState>) => Promise<void>;

  /** Leave the room / exit to menu. */
  leaveRoom: () => Promise<void>;

  /** Last user-facing error, if any. */
  error: string | null;
}
