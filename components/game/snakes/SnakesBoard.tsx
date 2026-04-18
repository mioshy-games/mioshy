"use client";

import { cn } from "@/lib/utils";
import type { GameConfig, GamePlayer } from "@/lib/snakes/types";
import { buildBoard } from "@/lib/snakes/boardUtils";
import { SnakesCell } from "./SnakesCell";
import { SnakesLaddersSVG } from "./SnakesLaddersSVG";
import { PlayersOverlay } from "./PlayersOverlay";

/**
 * SnakesBoard — responsive Snakes & Ladders board.
 *
 * Three stacked layers (bottom → top):
 *   1. Cell grid — solid parchment/moss checkerboard, only cell numbers.
 *   2. SVG overlay — snakes and ladders drawn as large curved graphics.
 *   3. Players overlay — big animated avatar tokens that glide between cells.
 *
 * Sizing:
 *   - Mobile: fills ~92vw (square)
 *   - Desktop: min(70vw, 82vh) — ~70% of the viewport like Itzik asked for.
 */
export function SnakesBoard({
  config,
  positions,
  players,
  currentPlayerId,
  highlightCell,
  className,
}: {
  config: Pick<GameConfig, "boardSize" | "snakes" | "ladders">;
  positions: Record<string, number>;
  players: GamePlayer[];
  currentPlayerId?: string | null;
  highlightCell?: number;
  className?: string;
}) {
  const size = config.boardSize || 100;
  const grid = buildBoard(size);
  const cols = grid[0]?.length ?? 10;

  return (
    <div
      className={cn(
        "relative mx-auto w-full",
        "max-w-[min(92vw,78vh)] md:max-w-[min(70vw,82vh)]",
        "rounded-3xl p-2 sm:p-3",
        // Rich parchment frame: dark wood-like border with inner warm glow
        "border-2 border-amber-950/80",
        "bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.12),transparent_60%),linear-gradient(180deg,#3b1f0a,#1a0d04)]",
        "shadow-[0_18px_50px_-15px_rgba(0,0,0,0.85),inset_0_0_0_2px_rgba(251,191,36,0.15)]",
        className,
      )}
    >
      <div className="relative aspect-square w-full">
        {/* Layer 1: grid of cells (solid background) */}
        <div
          className="grid h-full w-full gap-[2px] overflow-hidden rounded-2xl sm:gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {grid.flat().map((cell) => {
            const isWin = cell === size;
            const isHighlighted = highlightCell === cell;
            return (
              <div
                key={cell}
                className={cn(
                  "relative overflow-hidden transition-all duration-300",
                  isHighlighted &&
                    "ring-2 ring-cyan-300/70 ring-offset-1 ring-offset-amber-950 scale-[1.03] z-10",
                )}
              >
                <SnakesCell cell={cell} config={config} isWinCell={isWin} />
              </div>
            );
          })}
        </div>

        {/* Layer 2: snakes and ladders as big SVG graphics */}
        <SnakesLaddersSVG config={config} />

        {/* Layer 3: players as large animated tokens */}
        <PlayersOverlay
          players={players}
          positions={positions}
          boardSize={size}
          currentPlayerId={currentPlayerId ?? null}
        />
      </div>
    </div>
  );
}
