import type { CoinResult, GameConfig, Question, SnakeOrLadder } from "./types";
import { getSnakeOrLadderAt } from "./boardUtils";

export function flipCoin(): CoinResult {
  return Math.random() > 0.5 ? "heads" : "tails";
}

export function calculateNewPosition(
  current: number,
  steps: number,
  config: Pick<GameConfig, "snakes" | "ladders">,
  boardSize: number,
): { raw: number; final: number; event: "snake" | "ladder" | "normal" | "win" } {
  const raw = Math.max(0, current + Math.max(0, steps));
  if (raw >= boardSize) {
    return { raw: boardSize, final: boardSize, event: "win" };
  }
  const landed = raw;
  const hit = getSnakeOrLadderAt(config, landed);
  if (!hit) return { raw: landed, final: landed, event: "normal" };
  const final = hit.item.to;
  return { raw: landed, final, event: hit.kind };
}

export function applyPenalty(
  current: number,
  config: Pick<GameConfig, "penaltyType" | "penaltySteps">,
): number {
  if (config.penaltyType === "start") return 1;
  const steps = Math.max(0, config.penaltySteps ?? 0);
  return Math.max(1, current - steps);
}

export function getRandomQuestion(questions: Question[]): Question {
  if (!questions.length) {
    return {
      id: "fallback",
      type: "question",
      text_he: "שתפו משהו קטן שאתם מעריכים אחד בשני.",
      text_en: "Share one small thing you appreciate about each other.",
      category: "love",
    };
  }
  const idx = Math.floor(Math.random() * questions.length);
  return questions[idx]!;
}

export function getNextPlayerIndex(current: number, totalPlayers: number): number {
  if (totalPlayers <= 0) return 0;
  return (current + 1) % totalPlayers;
}

export function validateNoOverlap(snakes: SnakeOrLadder[], ladders: SnakeOrLadder[]) {
  const froms = new Set<number>();
  for (const s of snakes) {
    if (froms.has(s.from)) return { ok: false as const, reason: "duplicate_from" };
    froms.add(s.from);
  }
  for (const l of ladders) {
    if (froms.has(l.from)) return { ok: false as const, reason: "snake_ladder_overlap" };
    froms.add(l.from);
  }
  return { ok: true as const };
}

