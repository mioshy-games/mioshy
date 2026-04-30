import type { CoinResult, DiceResult, GameConfig, Question, SnakeOrLadder } from "./types";
import { getSnakeOrLadderAt } from "./boardUtils";

export function flipCoin(): CoinResult {
  return Math.random() > 0.5 ? "heads" : "tails";
}

/**
 * rollDice - returns a fair 1..6 result.
 * Kept deliberately simple; tuning (weighted dice, etc.) would happen in a
 * wrapper, not here.
 */
export function rollDice(): DiceResult {
  return (Math.floor(Math.random() * 6) + 1) as DiceResult;
}

export function calculateNewPosition(
  current: number,
  steps: number,
  config: Pick<GameConfig, "snakes" | "ladders">,
  boardSize: number,
): { raw: number; final: number; event: "snake" | "ladder" | "normal" | "win" } {
  const raw = Math.max(1, current + Math.max(0, steps));
  if (raw >= boardSize) {
    return { raw: boardSize, final: boardSize, event: "win" };
  }
  const landed = raw;
  const hit = getSnakeOrLadderAt(config, landed);
  if (!hit) return { raw: landed, final: landed, event: "normal" };
  // Clamp the snake/ladder destination to valid board range (1..boardSize).
  // Misconfigured `to` values (0, negative, or > boardSize) should never
  // silently send a token off-screen or to an illegal cell.
  const dest = Math.max(1, Math.min(boardSize, hit.item.to));
  if (dest >= boardSize) return { raw: landed, final: boardSize, event: "win" };
  return { raw: landed, final: dest, event: hit.kind };
}

export function applyPenalty(
  current: number,
  config: Pick<GameConfig, "penaltyType" | "penaltySteps">,
): number {
  if (config.penaltyType === "start") return 1;
  const steps = Math.max(0, config.penaltySteps ?? 0);
  return Math.max(1, current - steps);
}

const FALLBACK_QUESTION: Question = {
  id: "fallback",
  type: "question",
  text_he: "שתפו משהו קטן שאתם מעריכים אחד בשני.",
  text_en: "Share one small thing you appreciate about each other.",
  category: "love",
};

/**
 * @deprecated Prefer {@link pickNextQuestion} - it avoids repeats until the
 * pool is exhausted. Kept for any legacy room that still calls it directly.
 */
export function getRandomQuestion(questions: Question[]): Question {
  if (!questions.length) return FALLBACK_QUESTION;
  const idx = Math.floor(Math.random() * questions.length);
  return questions[idx]!;
}

/**
 * Fisher–Yates shuffle (non-mutating). Used to reseed the draw pool so the
 * order of questions varies across cycles without ever biasing toward
 * insertion order.
 */
function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Level-aware pool seeding.
 *
 * Shuffles questions within each level group (1, 2, 3) then concatenates
 * them in level order, so a full cycle naturally escalates from light/warm-up
 * questions (level 1) through medium (level 2) to deep/bold (level 3).
 * Questions without a level are treated as level 1.
 *
 * If all questions share the same level the result is a plain random shuffle
 * (identical to the old behaviour).
 */
function seedPoolByLevel(questions: readonly Question[]): string[] {
  const byLevel: Record<1 | 2 | 3, Question[]> = { 1: [], 2: [], 3: [] };
  for (const q of questions) {
    const l = (q.level ?? 1) as 1 | 2 | 3;
    byLevel[l].push(q);
  }
  return [
    ...shuffle(byLevel[1].map((q) => q.id)),
    ...shuffle(byLevel[2].map((q) => q.id)),
    ...shuffle(byLevel[3].map((q) => q.id)),
  ];
}

/**
 * pickNextQuestion - non-repeating random draw with level escalation.
 *
 * Given the current draw `pool` of question IDs (typically `state.questionPool`)
 * and the full `questions` list from the config, returns:
 *   • `question` - the selected Question (full object, not just the id)
 *   • `nextPool` - the remaining pool after this pick
 *
 * Behaviour:
 *   1. If the pool is empty/undefined or every id in it is stale
 *      (no longer in `questions`), it is reseeded via `seedPoolByLevel` -
 *      which groups by level 1→2→3 and shuffles within each group.
 *      This means a fresh cycle always starts with lighter questions and
 *      escalates toward more challenging ones.
 *   2. One id is popped from the front of the pool; the caller writes
 *      the returned `nextPool` back to game state.
 *   3. If `questions` is empty a deterministic fallback question is
 *      returned with an empty pool - the game never blocks on missing
 *      content.
 *
 * This guarantees every question is shown once per cycle before any repeat,
 * which is the behaviour the product spec calls for.
 */
export function pickNextQuestion(
  pool: readonly string[] | undefined,
  questions: readonly Question[],
): { question: Question; nextPool: string[] } {
  if (!questions.length) {
    return { question: FALLBACK_QUESTION, nextPool: [] };
  }
  const byId = new Map(questions.map((q) => [q.id, q] as const));

  // Drop any ids that no longer exist in the config (questions may have
  // been edited between sessions) and honour the incoming pool order.
  const filtered = (pool ?? []).filter((id) => byId.has(id));
  const working = filtered.length > 0 ? filtered : seedPoolByLevel(questions);

  const [pickedId, ...rest] = working;
  const question = pickedId ? byId.get(pickedId) : undefined;
  // Guard - `pickedId` can only be undefined if `questions` is empty, handled
  // above; this branch keeps TS happy while being resilient to the edge case.
  if (!question || !pickedId) {
    return { question: FALLBACK_QUESTION, nextPool: [] };
  }
  return { question, nextPool: rest };
}

export function getNextPlayerIndex(current: number, totalPlayers: number): number {
  if (totalPlayers <= 0) return 0;
  return (current + 1) % totalPlayers;
}

export function validateNoOverlap(snakes: SnakeOrLadder[], ladders: SnakeOrLadder[]) {
  const froms = new Set<number>();
  for (const s of snakes) {
    if (froms.has(s.from)) return { ok: false as const, reason: "duplicate_from" };
    if (s.from <= s.to) return { ok: false as const, reason: "snake_goes_up" };
    froms.add(s.from);
  }
  for (const l of ladders) {
    if (froms.has(l.from)) return { ok: false as const, reason: "snake_ladder_overlap" };
    if (l.from >= l.to) return { ok: false as const, reason: "ladder_goes_down" };
    froms.add(l.from);
  }
  return { ok: true as const };
}

