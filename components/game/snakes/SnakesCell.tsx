"use client";

import { cn } from "@/lib/utils";
import type { GameConfig } from "@/lib/snakes/types";
import { getSnakeOrLadderAt } from "@/lib/snakes/boardUtils";

/**
 * SnakesCell — a single tile on the Snakes & Ladders board.
 *
 * The cell is now a pure background tile: it shows only the cell number
 * and (optionally) a subtle tint if a snake-head or ladder-foot lives here.
 * Players and the snake/ladder graphics themselves are rendered in
 * absolutely-positioned overlays by SnakesBoard — this way the snakes can
 * span multiple cells, the players can animate smoothly between cells,
 * and the cell grid stays a clean background layer.
 *
 * Visual language matches the classic parchment/green reference board:
 * a warm cream gradient on even cells, a deeper moss green on odd cells,
 * crisp gold borders, a small corner numeral.
 */
export function SnakesCell({
  cell,
  config,
  isWinCell,
}: {
  cell: number;
  config: Pick<GameConfig, "snakes" | "ladders">;
  isWinCell: boolean;
}) {
  const hit = getSnakeOrLadderAt(config, cell);
  const kind = hit?.kind ?? null;

  // Alternate tile colors in a checker pattern based on (col, row) parity so
  // the visual rhythm is independent of the snake path's numbering.
  const isEven = cell % 2 === 0;

  return (
    <div
      className={cn(
        "relative flex h-full flex-col justify-between overflow-hidden border p-[2px] sm:p-1",
        "border-amber-900/40",
        // warm parchment alternation — cream and moss, like the reference board
        isEven
          ? "bg-gradient-to-br from-amber-50/95 via-amber-100/90 to-amber-200/85"
          : "bg-gradient-to-br from-emerald-700/90 via-emerald-800/90 to-emerald-900/95",
        // gentle tint on snake-heads / ladder-feet so you can still tell
        // something is there if the SVG overlay is missing
        kind === "snake" && "ring-1 ring-rose-400/40",
        kind === "ladder" && "ring-1 ring-amber-300/60",
        // the winning cell glows
        isWinCell &&
          "bg-[radial-gradient(circle_at_30%_30%,rgba(250,204,21,0.7),transparent_65%),linear-gradient(135deg,rgba(180,83,9,0.65),rgba(146,64,14,0.75))]",
      )}
    >
      <span
        className={cn(
          "font-bold leading-none tracking-tight",
          isEven ? "text-amber-900/75" : "text-amber-50/85",
          "text-[clamp(0.55rem,1.1vw,0.9rem)]",
        )}
      >
        {cell}
      </span>

      {isWinCell ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[clamp(0.9rem,2.2vw,1.8rem)] opacity-80">
          👑
        </span>
      ) : null}
    </div>
  );
}
