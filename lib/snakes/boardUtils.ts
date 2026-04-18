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
  config: Partial<Pick<GameConfig, "snakes" | "ladders">> | null | undefined,
  cell: number,
): { kind: "snake" | "ladder"; item: SnakeOrLadder } | null {
  const snakes = config?.snakes ?? [];
  const ladders = config?.ladders ?? [];
  const snake = snakes.find((s) => s.from === cell);
  if (snake) return { kind: "snake", item: snake };
  const ladder = ladders.find((l) => l.from === cell);
  if (ladder) return { kind: "ladder", item: ladder };
  return null;
}

/**
 * cellToGridPosition — converts a cell number (1..size) into its
 * (col, row) position inside the rendered grid, where row 0 is the TOP row
 * (the finish line, e.g. 91..100 in a 100-cell board) and row N-1 is the
 * bottom row (1..10). Columns are 0-indexed left→right.
 *
 * This mirrors the layout produced by buildBoard(): rows descend from size
 * down to 1, and even rows (counted from the top) are reversed so the
 * numbering snakes left→right on the bottom row.
 */
export function cellToGridPosition(
  cell: number,
  size: number,
): { col: number; row: number } {
  const side = Math.sqrt(size);
  const n = Number.isInteger(side) ? side : 10;
  // "index-from-top-left" 0..size-1, where cell `size` maps to (0, 0).
  const topRow = Math.floor((size - cell) / n);
  const offset = (size - cell) % n;
  // buildBoard() reverses even-index rows (rows going L→R descending),
  // so col is flipped on those rows.
  const col = topRow % 2 === 0 ? n - 1 - offset : offset;
  return { col, row: topRow };
}

/**
 * cellToBoardPercent — returns the center of `cell` as percentages of the
 * board's (width, height). Useful for absolutely-positioning overlays
 * (SVG snake curves, animated player tokens, modal launch origin) on top
 * of a responsive square grid.
 */
export function cellToBoardPercent(
  cell: number,
  size: number,
): { xPct: number; yPct: number } {
  const side = Math.sqrt(size);
  const n = Number.isInteger(side) ? side : 10;
  const { col, row } = cellToGridPosition(cell, size);
  const cellW = 100 / n;
  return {
    xPct: col * cellW + cellW / 2,
    yPct: row * cellW + cellW / 2,
  };
}

