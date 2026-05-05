"use client";

import { motion } from "framer-motion";
import type { GamePlayer } from "@/lib/snakes/types";
import { cellToBoardPercent } from "@/lib/snakes/boardUtils";

/**
 * PlayersOverlay - absolutely-positioned, significantly-larger player
 * tokens that glide between cells when positions change.
 *
 * Why an overlay, not cell children?
 *   • A token inside a cell is constrained by the cell's 1/100th of the
 *     board - too small on desktop, and any size-change requires relayout.
 *   • As an absolutely-positioned sibling on top of the grid, the token
 *     can be ~18% of the board wide (big + readable), can overlap other
 *     tokens without affecting layout, and its `left`/`top` are just
 *     percentages → animating them gives a buttery glide between cells.
 *
 * RTL handling (Itzik 2026-05-05):
 *   The board grid uses CSS dir=rtl in Hebrew so cells visually flip
 *   (cell 1 ends up on the LEFT in HE, on the RIGHT in EN — matching
 *   reading direction). Absolute children using `left:` don't auto-flip
 *   with dir, so for RTL we mirror xPct as (100 - xPct). This keeps
 *   tokens anchored to the same visual cell in both locales.
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
  isRtl = false,
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
  /** True when the parent grid is rendered with dir=rtl. Mirrors xPct. */
  isRtl?: boolean;
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

        // When the grid is rendered RTL, the cells visually flip but
        // absolute positioning stays physical. Mirror xPct so the token
        // ends up on the same VISUAL cell as the grid renders. yPct
        // never needs flipping (vertical axis isn't affected by dir).
        const visualX = isRtl ? 100 - center.xPct : center.xPct;

        // Token sizing — Itzik 2026-05-05 round 7: previous 9% (alone)
        // looked uncentered because the static halo box-shadow added
        // ~16px on every side, and on small cells the halo extended
        // beyond the cell border. Reduced to 7% / 5% so token + halo
        // both stay comfortably INSIDE the cell, like the crown emoji
        // on cell 100 (Itzik's reference for "centered").
        const isSharing = shareGroup.length > 1;
        const tokenSize = isSharing
          ? "clamp(18px, 5%, 36px)"
          : "clamp(24px, 7%, 48px)";

        // Round 8 (2026-05-05): outer motion.div is now CELL-SIZED
        // (9.5% × 9.5%, ~one cell on a 10×10 board). The cell highlight
        // ring fills it (so we don't need a per-grid-cell boxShadow that
        // would force the whole grid to re-render every walk step).
        // Badge is centered INSIDE the cell box. Anchor is the cell's
        // CENTER — using framer-motion's `x: -50%, y: -50%` shorthand
        // which integrates cleanly with motion's internal transforms.
        return (
          <motion.div
            key={p.id}
            className="absolute"
            style={{
              width: "9.5%",
              height: "9.5%",
              zIndex: isCurrent ? 30 : 20,
            }}
            initial={false}
            animate={{
              left: `calc(${visualX}% + ${(isRtl ? -offset.x : offset.x)}%)`,
              top: `calc(${center.yPct}% + ${offset.y}%)`,
              x: "-50%",
              y: "-50%",
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
            {/* Cell highlight ring — fills the parent cell box. Renders
                in the overlay, NOT on the grid cells, so the grid stays
                static while the highlight travels with the token. */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-md"
              style={{
                boxShadow: `inset 0 0 0 2px ${p.color}aa, inset 0 0 14px ${p.color}66`,
              }}
            />

            {/* Badge centered inside the cell box */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: tokenSize,
                height: tokenSize,
              }}
            >
              <PlayerBadge
                avatar={p.avatar}
                color={p.color}
                name={p.user_name}
                isCurrent={isCurrent}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function offsetForIndex(i: number, total: number): { x: number; y: number } {
  // Single token → exact cell center (no offset). Itzik 2026-05-05.
  if (total <= 1) return { x: 0, y: 0 };
  // Two tokens → side-by-side inside the cell. Each cell is ~10% wide
  // on a 10×10 board, so a horizontal radius of 1.8% places tokens at
  // -1.8% / +1.8% from cell center — both well inside the same cell.
  if (total === 2) {
    return { x: i === 0 ? -1.8 : 1.8, y: 0 };
  }
  // Three+ tokens → tight rosette inside the cell. Radius 2.4% keeps
  // them all within a single 10% cell with overlap allowed.
  const radius = 2.4;
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
  // Round 7 (2026-05-05) PERFORMANCE: simplified token glow.
  // Previously every token had a constantly-animating motion.span with
  // `filter: blur(4px)` + scale + opacity animations, plus the active
  // player got a SECOND animated boxShadow ring. With 2-6 tokens that's
  // 2-12 framer-motion animations running every frame, each forcing
  // compositor + paint work. Compounded with the heavy bg blobs +
  // sparks, it was a major contributor to the 10s+ lag Itzik reported.
  //
  // New approach: STATIC glow for non-active tokens (CSS box-shadow
  // only, GPU-cheap), and ONE simple animation for the active token
  // (transform-only scale) to mark whose turn it is.
  return (
    <div className="relative h-full w-full" title={name}>
      {/* Static outer halo — round 7 (2026-05-05): tightened so the
          halo stays inside the cell. Previous 16px outer glow extended
          past the cell border, making the token look "below" the cell
          instead of centered. Now 6px max — visible but contained. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: `0 0 0 1px ${color}66, 0 0 6px ${color}88`,
        }}
      />

      {/* Active player: single transform-only pulse, halo also tightened. */}
      {isCurrent ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 2px ${color}, 0 0 10px ${color}aa`,
          }}
          animate={{ scale: [1, 1.10, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}

      {/* Heart token — gradient fill, gold rim, deeper shadow.
          Replaces the previous flat-color coin per Itzik 2026-05-05. */}
      <div
        className="relative flex h-full w-full items-center justify-center rounded-full border-2 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.75)]"
        style={{
          borderColor: color,
          background: `
            radial-gradient(circle at 32% 28%, rgba(255,255,255,0.88) 0%, ${color}f0 35%, ${color} 65%, ${shadeHex(color, -28)} 100%)
          `,
        }}
      >
        {/* Inner ring of gold — barely visible, ties the token to the
            board's gold accent palette. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[3px] rounded-full"
          style={{
            boxShadow: "inset 0 0 0 1px rgba(201,169,97,0.45)",
          }}
        />
        <span
          className="relative select-none leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
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
