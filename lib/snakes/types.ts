export interface SnakeOrLadder {
  from: number;
  to: number;
  emoji: string;
  label: string;
}

export interface Question {
  id: string;
  type: "question" | "challenge";
  text_he: string;
  text_en: string;
  category: string;
}

export interface GameConfig {
  boardSize: number;
  coinHeadsSteps: number;
  coinTailsSteps: number;
  penaltyType: "back5" | "start";
  penaltySteps: number;
  snakes: SnakeOrLadder[];
  ladders: SnakeOrLadder[];
  questions: Question[];
  name?: string;
}

export type CoinResult = "heads" | "tails";

/**
 * A regular 1..6 die roll. The dice replaces the coin flip as the primary
 * turn mechanic; `CoinResult` is kept so existing rooms finish cleanly.
 */
export type DiceResult = 1 | 2 | 3 | 4 | 5 | 6;

export type GamePhase = "waiting_flip" | "moving" | "question" | "ended";

export interface GameLogEntry {
  timestamp: string;
  playerName: string;
  avatar: string;
  action: string;
  type: "flip" | "move" | "snake" | "ladder" | "question" | "penalty" | "win";
}

export interface GameState {
  currentPlayerIndex: number;
  positions: Record<string, number>; // game_players.id -> cell number
  phase: GamePhase;
  currentQuestion: Question | null;
  /** @deprecated kept for backward compatibility with rooms using a coin */
  lastCoinResult: CoinResult | null;
  /** Primary turn mechanic going forward — value shown on the die */
  lastDiceResult: DiceResult | null;
  winner: string | null; // game_players.id
  turnCount: number;
  log: GameLogEntry[];
}

export interface GameRoom {
  id: string;
  code: string;
  game_type: "wheel" | "snakes";
  status: "lobby" | "playing" | "ended";
  host_id: string | null;
  game_state: GameState;
  config: GameConfig;
  created_at: string;
  updated_at: string;
}

export interface GamePlayer {
  id: string;
  room_id: string;
  user_id: string | null;
  user_name: string;
  avatar: string;
  color: string;
  position: number;
  order_index: number;
  is_host: boolean;
  /** true once the player has confirmed their avatar+colour in the lobby */
  is_locked: boolean;
  /** true when the player signals they are ready to start */
  is_ready: boolean;
  created_at: string;
}

export interface PlayerInfo {
  userName: string;
  /** Player joins first with a default avatar; confirmed later via claimCharacter */
  avatar?: string;
  /** Player joins first with a default colour; confirmed later via claimCharacter */
  color?: string;
}

