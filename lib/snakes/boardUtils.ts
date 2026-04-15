import type { GameConfig, SnakeOrLadder } from "./types";

export function buildBoard(size: number): number[][] {
  if (size <= 0) return [];
  const side = Math.sqrt(size);
  const n = Number.isInteger(side) ? side : 10;
  const rows = n;
  const cols = n;
  const grid: number[][] = [];
  let current = size;

  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(current--);
    }
    // Row 0 should go left->right (e.g. 91..100 for size 100),
    // Row 1 reversed, etc. Since we filled descending, reverse even rows.
    if (r % 2 === 0) row.reverse();
    grid.push(row);
  }

  return grid;
}

export function indexByFrom(list: SnakeOrLadder[]) {
  const m = new Map<number, SnakeOrLadder>();
  for (const item of list) m.set(item.from, item);
  return m;
}

export function getSnakeOrLadderAt(
  config: Pick<GameConfig, "snakes" | "ladders">,
  cell: number,
): { kind: "snake" | "ladder"; item: SnakeOrLadder } | null {
  const snake = config.snakes.find((s) => s.from === cell);
  if (snake) return { kind: "snake", item: snake };
  const ladder = config.ladders.find((l) => l.from === cell);
  if (ladder) return { kind: "ladder", item: ladder };
  return null;
}

