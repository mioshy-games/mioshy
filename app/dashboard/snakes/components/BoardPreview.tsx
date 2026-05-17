"use client";

import { SnakesBoard } from "@/components/game/snakes/SnakesBoard";
import { DEFAULT_SNAKES_CONFIG } from "@/lib/snakes/defaultConfig";
import type { SnakesConfig } from "./types";

/**
 * Live preview of what the player will actually see.
 *
 * The board mechanics (size, snakes, ladders) come from the hardcoded
 * `DEFAULT_SNAKES_CONFIG` — the same source the runtime loader uses —
 * not from the row being edited. The row is still accepted as a prop
 * for symmetry with the other tab panels and so we can surface a
 * questions/name preview here later, but it deliberately does not
 * influence the board layout.
 */
export function BoardPreview({ cfg: _cfg }: { cfg: SnakesConfig }) {
  return (
    <div className="flex justify-center">
      <SnakesBoard
        config={{
          boardSize: DEFAULT_SNAKES_CONFIG.boardSize,
          snakes: DEFAULT_SNAKES_CONFIG.snakes,
          ladders: DEFAULT_SNAKES_CONFIG.ladders,
        }}
        positions={{}}
        players={[]}
      />
    </div>
  );
}
