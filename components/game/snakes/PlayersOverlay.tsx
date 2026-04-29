"use client";

import { motion } from "framer-motion";
import type { GamePlayer } from "@/lib/snakes/types";
import { cellToBoardPercent } from "@/lib/snakes/boardUtils";

/**
 * PlayersOverlay — absolutely-positioned, significantly-larger player
 * tokens that glide between cells when positions change.
 *
 * Why an overlay, not cell children?
 *   • A token inside a cell is constrained by the cell's 1/100th of the
 *     board — too small on desktop, and any size-change requires relayout.
 *   • As an absolutely-positioned sibling on top of the grid, the token
 *     can be ~18% of the board wide (big + readable), can overlap other
 *     tokens without affecting layout, and its `left`/`top` are just
 *     percentages → animating them gives a buttery glide between cells.
 *
 * Stacking:
 *   • Several players can share a cell. We spread them in a small radial
 *     pattern around the cell center so all remain visible, and the one
 *     whose turn it is sits on top with a subtle pulse ring.
 */
export function PlayersOverlay({
  players,
  positions,
  boardSize,
  currentPlayerId,
  visualPositions,
  arrivingPlayerId,
  isWalking,
}: {
  players: GamePlayer[];
  /** Real authoritative positions from game state. */
  positions: Record<string, number>;
  boardSize: number;
  currentPlayerId: string | null;
  /** Optional client-side visual override used during step-by-step walk animation. */
  visualPositions?: Record<string, number>;
  /** Player currently doing the arrival bounce after a walk completes. */
  arrivingPlayerId?: string | null;
  /** When true, use a snappier spring so tokens hop crisply between cells. */
  isWalking?: boolean;
}) {
  // Derive which positions to actually display.
  const displayPos = visualPositions ?? positions;

  // Group players by their *display* cell so offset calculation stays in sync
  // with what the player sees, not what Supabase already resolved.
  const byCell = new Map<number, string[]>();
  for (const p of players) {
    const cell = displayPos[p.id] ?? p.position ?? 1;
    const list = byCell.get(cell) ?? [];
    list.push(p.id);
    byCell.set(cell, list);
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {players.map((p) => {
        const cell = displayPos[p.id] ?? p.position ?? 1;
        const center = cellToBoardPercent(cell, boardSize);
        const shareGroup = byCell.get(cell) ?? [p.id];
        const indexInGroup = shareGroup.indexOf(p.id);
        const offset = offsetForIndex(indexInGroup, shareGroup.length);

        const isCurrent = currentPlayerId === p.id;
        const isArriving = arrivingPlayerId === p.id;

        return (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              left: `${center.xPct}%`,
              top: `${center.yPct}%`,
              // token is ~15% of the board wide on desktop, ~18% on mobile.
              width: "clamp(38px, 14%, 88px)",
              height: "clamp(38px, 14%, 88px)",
              transform: "translate(-50%, -50%)",
              zIndex: isCurrent ? 30 : 20,
            }}
            initial={false}
            animate={{
              left: `calc(${center.xPct}% + ${offset.x}%)`,
              top: `calc(${center.yPct}% + ${offset.y}%)`,
              // Arrival bounce: pop up, squash back, settle.
              scale: isArriving ? [1, 1.45, 0.82, 1.12, 1] : 1,
            }}
            transition={
              isArriving
                ? { duration: 0.48, ease: [0.36, 0.07, 0.19, 0.97], times: [0, 0.28, 0.55, 0.78, 1] }
                : isWalking
                  ? { type: "spring", stiffness: 620, damping: 42 }
                  : { type: "spring", stiffness: 180, damping: 22, mass: 0.9 }
            }
          >
            <PlayerBadge
              avatar={p.avatar}
              color={p.color}
              name={p.user_name}
              isCurrent={isCurrent}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function offsetForIndex(i: number, total: number): { x: number; y: number } {
  if (total <= 1) return { x: 0, y: 0 };
  const radius = total === 2 ? 3 : 4;
  const angle = (i / total) * Math.PI * 2 + Math.PI / 4;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function PlayerBadge({
  avatar,
  color,
  name,
  isCurrent,
}: {
  avatar: string;
  color: string;
  name: string;
  isCurrent: boolean;
}) {
  return (
    <div className="relative h-full w-full" title={name}>
      {/* pulse ring for the active player */}
      {isCurrent ? (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 3px ${color}`,
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.9, 0.55, 0.9],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ) : null}

      {/* coin */}
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full border-2 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.55)]"
        style={{
          borderColor: color,
          background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.9), ${color}e8 55%, ${shadeHex(color, -25)} 100%)`,
        }}
      >
        <span
          className="select-none leading-none"
          style={{ fontSize: "clamp(1.2rem, 4.5vw, 2.6rem)" }}
          aria-hidden
        >
          {avatar}
        </span>
      </div>
    </div>
  );
}

// Darken a hex color by `pct` percent (negative darkens, positive lightens).
function shadeHex(hex: string, pct: number): string {
  try {
    const clean = hex.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const adjust = (v: number) => {
      const next = Math.round(v + (pct / 100) * 255);
      return Math.max(0, Math.min(255, next));
    };
    return (
      "#" +
      [adjust(r), adjust(g), adjust(b)]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
    );
  } catch {
    return hex;
  }
}
