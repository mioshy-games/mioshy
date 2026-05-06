"use client";

import { cn } from "@/lib/utils";
import type { GameConfig, GamePlayer } from "@/lib/snakes/types";
import { buildBoard } from "@/lib/snakes/boardUtils";
import { SnakesCell } from "./SnakesCell";
import { SnakesLaddersSVG } from "./SnakesLaddersSVG";
import { PlayersOverlay } from "./PlayersOverlay";

/**
 * SnakesBoard - responsive Snakes & Ladders board.
 *
 * Three stacked layers (bottom → top):
 *   1. Cell grid - solid parchment/moss checkerboard, only cell numbers.
 *   2. SVG overlay - snakes and ladders drawn as large curved graphics.
 *   3. Players overlay - big animated avatar tokens that glide between cells.
 *
 * Sizing (after the April '26 layout redesign):
 *   - Mobile: min(95vw, 70vh) - tall vertical layout dominates the screen.
 *   - Desktop: min(60vw, 88vh) - leaves room for the right-hand sidebar
 *     (logo+title, dice surface, players list, exit) without squashing
 *     the board.
 */
export function SnakesBoard({
  config,
  positions,
  players,
  currentPlayerId,
  highlightCell,
  className,
  visualPositions,
  arrivingPlayerId,
  isWalking,
  isRtl = false,
}: {
  config: Pick<GameConfig, "boardSize" | "snakes" | "ladders">;
  positions: Record<string, number>;
  players: GamePlayer[];
  currentPlayerId?: string | null;
  highlightCell?: number;
  className?: string;
  /** Client-side visual override during step-by-step walk animation. */
  visualPositions?: Record<string, number>;
  /** Player currently doing the arrival bounce. */
  arrivingPlayerId?: string | null;
  /** When true, tokens hop crisply between cells. */
  isWalking?: boolean;
  /** Locale direction. Pass true for Hebrew so the SVG + overlay layers
   *  mirror their x coords to match the visually flipped grid. Default
   *  false (LTR) so the dashboard preview doesn't crash on missing
   *  IntlProvider context. */
  isRtl?: boolean;
}) {
  const size = config.boardSize || 100;
  const grid = buildBoard(size);
  const cols = grid[0]?.length ?? 10;
  // `isRtl` is now passed as a PROP from the parent (SnakesGameBoard
  // pulls locale; admin preview defaults to false). Round 9 (2026-05-05)
  // - was previously read here via useLocale() but that crashed on
  // /dashboard/snakes?tab=preview which doesn't sit inside an
  // IntlProvider tree.
  // Round 8 (2026-05-05) PERFORMANCE: previously the cell-under-token
  // glow was applied as inline boxShadow on each occupied grid cell.
  // Every visualPositions change recomputed an `occupiedCells` useMemo,
  // which forced the entire 100-cell grid to re-render. With the walk
  // firing 6+ position updates per turn, the grid re-renders piled up
  // and the user only saw 1 visible hop instead of N. The highlight
  // is now rendered as an absolute overlay element in PlayersOverlay
  // - its position updates without disturbing the static grid.

  return (
    <div
      className={cn(
        "relative mx-auto w-full",
        "max-w-[min(95vw,70vh)] md:max-w-[min(60vw,88vh)]",
        "rounded-3xl p-2 sm:p-3",
        // Intimate-dark frame 2026-05-05: thin gold hairline + deep
        // wine→black gradient with a soft amber candlelight glow at
        // top. Heavy drop shadow to lift the board off the dark page.
        "border border-[#C9A961]/35",
        "bg-[radial-gradient(ellipse_at_top,rgba(201,169,97,0.07),transparent_65%),linear-gradient(180deg,#1d0309_0%,#0a0205_100%)]",
        "shadow-[0_28px_70px_-18px_rgba(0,0,0,0.95),inset_0_0_0_1px_rgba(201,169,97,0.18),inset_0_0_60px_rgba(91,8,28,0.45)]",
        className,
      )}
    >
      {/* Velvet/silk noise texture overlay - barely visible, breaks up
          the gradient banding and gives the board a fabric-like surface. */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.85'/></svg>\")",
        }}
        aria-hidden
      />

      {/* Gold border sweep - REMOVED 2026-05-05 round 7 (PERFORMANCE).
          The conic-gradient + mask-composite + @property animation was
          forcing the browser to repaint the entire 2px ring around the
          board on every frame - measurable contributor to the 10s+ lag
          Itzik reported. The static gold border on the outer wrapper
          (already there via `border border-[#C9A961]/35`) carries the
          aesthetic without the animation cost. If we want a moving
          accent later, do it with a pseudo-element + transform-only
          animation (no mask composite). */}

      <div className="relative aspect-square w-full">
        {/* Layer 1: grid of cells (solid background) */}
        <div
          className="grid h-full w-full gap-[1px] overflow-hidden rounded-2xl sm:gap-[2px]"
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
        <SnakesLaddersSVG config={config} isRtl={isRtl} />

        {/* Layer 3: players as large animated tokens */}
        <PlayersOverlay
          players={players}
          positions={positions}
          boardSize={size}
          currentPlayerId={currentPlayerId ?? null}
          visualPositions={visualPositions}
          arrivingPlayerId={arrivingPlayerId}
          isWalking={isWalking}
          isRtl={isRtl}
        />
      </div>
    </div>
  );
}
