"use client";

import { useId, useMemo } from "react";
import type { GameConfig } from "@/lib/snakes/types";
import { cellToBoardPercent } from "@/lib/snakes/boardUtils";

/**
 * SnakesLaddersSVG — draws snakes and ladders as large graphical paths
 * stretched across multiple cells, overlaid on top of the cell grid.
 *
 * Rationale (from Itzik): snakes should NOT be tiny emoji inside a single
 * cell — they should be big, beautiful illustrations that carry the visual
 * identity of the board, spanning from the "from" cell to the "to" cell.
 *
 * Implementation:
 *   • Coordinates are expressed in a 100×100 viewBox mapped to the board's
 *     square bounding box — so the overlay scales perfectly with the grid.
 *   • Snakes are drawn as a curvy S-body with a patterned fill, gradient
 *     shading, and a little head with eyes + tongue at the "from" end.
 *   • Ladders are drawn as two parallel rails with evenly-spaced rungs,
 *     rotated along the line from "from" → "to".
 *   • A defs block carries shared gradients + patterns.
 *
 * The SVG is `position: absolute; inset: 0; pointer-events: none`, sitting
 * between the cell grid and the players overlay.
 */
export function SnakesLaddersSVG({
  config,
}: {
  config: Pick<GameConfig, "boardSize" | "snakes" | "ladders">;
}) {
  const uid = useId().replace(/:/g, "");
  const size = config.boardSize || 100;

  const snakes = config.snakes ?? [];
  const ladders = config.ladders ?? [];

  const snakePaths = useMemo(
    () =>
      snakes.map((s) => {
        const from = cellToBoardPercent(s.from, size);
        const to = cellToBoardPercent(s.to, size);
        return { item: s, from, to };
      }),
    [snakes, size],
  );

  const ladderPaths = useMemo(
    () =>
      ladders.map((l) => {
        const from = cellToBoardPercent(l.from, size);
        const to = cellToBoardPercent(l.to, size);
        return { item: l, from, to };
      }),
    [ladders, size],
  );

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {/* Snake skin gradient — emerald with a darker belly */}
        <linearGradient id={`snakeSkin-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="60%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        {/* Ladder wood gradient */}
        <linearGradient id={`ladderWood-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        {/* Subtle scale pattern for snakes */}
        <pattern
          id={`scales-${uid}`}
          x="0"
          y="0"
          width="2"
          height="2"
          patternUnits="userSpaceOnUse"
        >
          <rect width="2" height="2" fill="transparent" />
          <circle cx="1" cy="1" r="0.55" fill="rgba(0,0,0,0.18)" />
        </pattern>
      </defs>

      {/* Ladders first — snakes render on top of them */}
      {ladderPaths.map((lp, i) => (
        <Ladder
          key={`ladder-${i}-${lp.item.from}-${lp.item.to}`}
          fromX={lp.from.xPct}
          fromY={lp.from.yPct}
          toX={lp.to.xPct}
          toY={lp.to.yPct}
          gradientId={`ladderWood-${uid}`}
        />
      ))}

      {snakePaths.map((sp, i) => (
        <Snake
          key={`snake-${i}-${sp.item.from}-${sp.item.to}`}
          fromX={sp.from.xPct}
          fromY={sp.from.yPct}
          toX={sp.to.xPct}
          toY={sp.to.yPct}
          gradientId={`snakeSkin-${uid}`}
          patternId={`scales-${uid}`}
        />
      ))}
    </svg>
  );
}

// ─── Ladder ───────────────────────────────────────────────────────────────────

function Ladder({
  fromX,
  fromY,
  toX,
  toY,
  gradientId,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  gradientId: string;
}) {
  // Perpendicular unit vector → used to offset the two rails.
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len; // perpendicular x
  const py = dx / len; // perpendicular y
  // Rail separation (in viewBox units; cells are ~10×10, so 2 units is a nice rail).
  const halfW = 1.9;

  const leftFrom = { x: fromX + px * halfW, y: fromY + py * halfW };
  const leftTo = { x: toX + px * halfW, y: toY + py * halfW };
  const rightFrom = { x: fromX - px * halfW, y: fromY - py * halfW };
  const rightTo = { x: toX - px * halfW, y: toY - py * halfW };

  // Rungs — every ~3.5 vb units along the line
  const rungCount = Math.max(3, Math.round(len / 3.5));
  const rungs: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
  for (let i = 1; i < rungCount; i++) {
    const t = i / rungCount;
    rungs.push({
      a: { x: leftFrom.x + (leftTo.x - leftFrom.x) * t, y: leftFrom.y + (leftTo.y - leftFrom.y) * t },
      b: { x: rightFrom.x + (rightTo.x - rightFrom.x) * t, y: rightFrom.y + (rightTo.y - rightFrom.y) * t },
    });
  }

  return (
    <g style={{ filter: "drop-shadow(0 0.4px 0.4px rgba(0,0,0,0.4))" }}>
      {/* rails */}
      <line
        x1={leftFrom.x}
        y1={leftFrom.y}
        x2={leftTo.x}
        y2={leftTo.y}
        stroke={`url(#${gradientId})`}
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      <line
        x1={rightFrom.x}
        y1={rightFrom.y}
        x2={rightTo.x}
        y2={rightTo.y}
        stroke={`url(#${gradientId})`}
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      {/* rungs */}
      {rungs.map((r, i) => (
        <line
          key={i}
          x1={r.a.x}
          y1={r.a.y}
          x2={r.b.x}
          y2={r.b.y}
          stroke="#b45309"
          strokeWidth={0.7}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

// ─── Snake ────────────────────────────────────────────────────────────────────

function Snake({
  fromX,
  fromY,
  toX,
  toY,
  gradientId,
  patternId,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  gradientId: string;
  patternId: string;
}) {
  // Construct a curvy cubic Bezier S-shape from (fromX,fromY) — the HEAD,
  // which sits on the snake's "from" cell (always higher on the board) —
  // down to (toX,toY) — the TAIL. Control points are offset perpendicular
  // to the line and alternated to create the S curve.

  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  // Curve amplitude proportional to length → longer snakes curve more
  const amp = Math.min(18, Math.max(6, len * 0.35));

  // Two control points flipping sides — classic S-curve
  const cp1x = fromX + dx * 0.33 + px * amp;
  const cp1y = fromY + dy * 0.33 + py * amp;
  const cp2x = fromX + dx * 0.66 - px * amp;
  const cp2y = fromY + dy * 0.66 - py * amp;

  const d = `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;

  return (
    <g style={{ filter: "drop-shadow(0 0.6px 0.8px rgba(0,0,0,0.55))" }}>
      {/* body underlay — darker edge for depth */}
      <path
        d={d}
        fill="none"
        stroke="#064e3b"
        strokeWidth={3.6}
        strokeLinecap="round"
      />
      {/* body main fill */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={3.0}
        strokeLinecap="round"
      />
      {/* scales overlay */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${patternId})`}
        strokeWidth={3.0}
        strokeLinecap="round"
        opacity={0.75}
      />
      {/* highlight stripe */}
      <path
        d={d}
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={0.5}
        strokeLinecap="round"
      />
      {/* head — a small filled circle + eyes + tongue at the "from" end */}
      <SnakeHead x={fromX} y={fromY} angle={Math.atan2(cp1y - fromY, cp1x - fromX)} />
    </g>
  );
}

function SnakeHead({ x, y, angle }: { x: number; y: number; angle: number }) {
  // Head points along the direction of the first control point (away from body).
  const headR = 2.3;
  const tongueLen = 1.8;
  const tongueX = x - Math.cos(angle) * (headR + tongueLen);
  const tongueY = y - Math.sin(angle) * (headR + tongueLen);
  const eyeOffset = 1.0;
  const eye1X = x - Math.cos(angle) * 0.6 + Math.cos(angle + Math.PI / 2) * eyeOffset;
  const eye1Y = y - Math.sin(angle) * 0.6 + Math.sin(angle + Math.PI / 2) * eyeOffset;
  const eye2X = x - Math.cos(angle) * 0.6 + Math.cos(angle - Math.PI / 2) * eyeOffset;
  const eye2Y = y - Math.sin(angle) * 0.6 + Math.sin(angle - Math.PI / 2) * eyeOffset;

  return (
    <g>
      {/* tongue */}
      <line
        x1={x - Math.cos(angle) * headR}
        y1={y - Math.sin(angle) * headR}
        x2={tongueX}
        y2={tongueY}
        stroke="#ef4444"
        strokeWidth={0.4}
        strokeLinecap="round"
      />
      {/* forked tips */}
      <line
        x1={tongueX}
        y1={tongueY}
        x2={tongueX + Math.cos(angle + Math.PI / 2) * 0.5 - Math.cos(angle) * 0.3}
        y2={tongueY + Math.sin(angle + Math.PI / 2) * 0.5 - Math.sin(angle) * 0.3}
        stroke="#ef4444"
        strokeWidth={0.35}
        strokeLinecap="round"
      />
      <line
        x1={tongueX}
        y1={tongueY}
        x2={tongueX + Math.cos(angle - Math.PI / 2) * 0.5 - Math.cos(angle) * 0.3}
        y2={tongueY + Math.sin(angle - Math.PI / 2) * 0.5 - Math.sin(angle) * 0.3}
        stroke="#ef4444"
        strokeWidth={0.35}
        strokeLinecap="round"
      />
      {/* head */}
      <circle cx={x} cy={y} r={headR} fill="#166534" stroke="#052e16" strokeWidth={0.3} />
      <circle cx={x} cy={y} r={headR * 0.85} fill="#22c55e" opacity={0.75} />
      {/* eyes */}
      <circle cx={eye1X} cy={eye1Y} r={0.5} fill="#fef3c7" />
      <circle cx={eye1X} cy={eye1Y} r={0.25} fill="#111827" />
      <circle cx={eye2X} cy={eye2Y} r={0.5} fill="#fef3c7" />
      <circle cx={eye2X} cy={eye2Y} r={0.25} fill="#111827" />
    </g>
  );
}
