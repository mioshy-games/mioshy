"use client";

import { cn } from "@/lib/utils";
import type { GameConfig } from "@/lib/snakes/types";
import { getSnakeOrLadderAt } from "@/lib/snakes/boardUtils";

/**
 * SnakesCell - a single tile on the Snakes & Ladders board.
 *
 * The cell is now a pure background tile: it shows only the cell number
 * and (optionally) a subtle tint if a snake-head or ladder-foot lives here.
 * Players and the snake/ladder graphics themselves are rendered in
 * absolutely-positioned overlays by SnakesBoard - this way the snakes can
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
        "relative flex h-full flex-col justify-between overflow-hidden p-[2px] sm:p-1",
        // Intimate-dark redesign 2026-05-05: deep wine-red + black squares
        // with hairline gold borders. Keeps an alternation pattern but in
        // bedroom/candlelit tones rather than parchment/moss.
        "border border-[#C9A961]/15",
        isEven
          ? "bg-[linear-gradient(135deg,#1a0408_0%,#2a0810_55%,#1a0408_100%)]" // near-black
          : "bg-[linear-gradient(135deg,#3d0a14_0%,#5a0f1f_50%,#3d0a14_100%)]" // deep wine
        ,
        // Subtle ring on snake-heads / ladder-feet — uses gold/crimson
        // instead of the previous amber/rose so the hint stays in palette.
        kind === "snake" && "ring-1 ring-[#9b2235]/50",
        kind === "ladder" && "ring-1 ring-[#C9A961]/40",
        // Win cell — soft gold halo, replaces the brassy radial.
        isWinCell &&
          "bg-[radial-gradient(circle_at_30%_30%,rgba(201,169,97,0.55),transparent_70%),linear-gradient(135deg,#3d0a14,#1a0408)]",
      )}
    >
      <span
        className={cn(
          // Serif numerals — Playfair Display preferred, Georgia fallback.
          // Lower weight + low-opacity gold reads as "candlelit" rather
          // than "casino board".
          "leading-none tracking-tight",
          "font-['Playfair_Display','Cormorant_Garamond',Georgia,serif]",
          "font-medium text-[#C9A961]/55",
          "text-[clamp(0.875rem,1.1vw,1.1rem)]",
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
