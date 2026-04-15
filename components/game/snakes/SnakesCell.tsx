"use client";

import { cn } from "@/lib/utils";
import type { GameConfig, GamePlayer } from "@/lib/snakes/types";
import { PlayerToken } from "./PlayerToken";
import { getSnakeOrLadderAt } from "@/lib/snakes/boardUtils";

export function SnakesCell({
  cell,
  config,
  playersOnCell,
  isWinCell,
}: {
  cell: number;
  config: Pick<GameConfig, "snakes" | "ladders">;
  playersOnCell: GamePlayer[];
  isWinCell: boolean;
}) {
  const hit = getSnakeOrLadderAt(config, cell);
  const kind = hit?.kind ?? null;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden border p-1",
        "border-slate-700/60 bg-slate-900/60",
        cell % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/55",
        kind === "snake" && "border-red-500/35 bg-red-950/20",
        kind === "ladder" && "border-emerald-400/30 bg-emerald-950/15",
        isWinCell &&
          "border-yellow-300/40 bg-[radial-gradient(circle_at_30%_30%,rgba(250,204,21,0.20),transparent_55%),rgba(15,23,42,0.6)]",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-semibold text-slate-200/80">
          {cell}
        </span>
        {hit ? (
          <span className="text-[10px]" title={hit.item.label || undefined}>
            {hit.item.emoji}
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1">
        {playersOnCell.slice(0, 4).map((p) => (
          <PlayerToken key={p.id} avatar={p.avatar} color={p.color} />
        ))}
        {playersOnCell.length > 4 ? (
          <span className="text-[10px] font-semibold text-slate-300/70">
            +{playersOnCell.length - 4}
          </span>
        ) : null}
      </div>
    </div>
  );
}

