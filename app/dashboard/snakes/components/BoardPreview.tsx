"use client";

import { SnakesBoard } from "@/components/game/snakes/SnakesBoard";
import type { SnakesConfig } from "./types";

export function BoardPreview({ cfg }: { cfg: SnakesConfig }) {
  return (
    <div className="flex justify-center">
      <SnakesBoard
        config={{
          boardSize: cfg.board_size,
          snakes: cfg.snakes,
          ladders: cfg.ladders,
        }}
        positions={{}}
        players={[]}
      />
    </div>
  );
}

