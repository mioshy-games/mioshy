"use client";

import { cn } from "@/lib/utils";
import type { GameConfig, GamePlayer } from "@/lib/snakes/types";
import { buildBoard } from "@/lib/snakes/boardUtils";
import { SnakesCell } from "./SnakesCell";

export function SnakesBoard({
  config,
  positions,
  players,
  highlightCell,
  className,
}: {
  config: Pick<GameConfig, "boardSize" | "snakes" | "ladders">;
  positions: Record<string, number>;
  players: GamePlayer[];
  highlightCell?: number;
  className?: string;
}) {
  const size = config.boardSize || 100;
  const grid = buildBoard(size);

  const byCell = new Map<number, GamePlayer[]>();
  for (const p of players) {
    const cell = positions[p.id] ?? p.position ?? 1;
    const list = byCell.get(cell) ?? [];
    list.push(p);
    byCell.set(cell, list);
  }

  return (
    <div
      className={cn(
        "w-full",
        "max-w-[460px]",
        "rounded-2xl border border-slate-700/60 bg-slate-950/40 p-2 backdrop-blur",
        className,
      )}
    >
      <div
        className="grid aspect-square w-full gap-1"
        style={{
          gridTemplateColumns: `repeat(${grid[0]?.length ?? 10}, minmax(0, 1fr))`,
        }}
      >
        {grid.flat().map((cell) => {
          const playersOnCell = byCell.get(cell) ?? [];
          const isWin = cell === size;
          const isHighlighted = highlightCell === cell;
          return (
            <div
              key={cell}
              className={cn(
                "rounded-lg overflow-hidden",
                isHighlighted && "ring-2 ring-cyan-300/40",
              )}
            >
              <SnakesCell
                cell={cell}
                config={config}
                playersOnCell={playersOnCell}
                isWinCell={isWin}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

