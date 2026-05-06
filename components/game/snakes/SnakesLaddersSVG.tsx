"use client";

import { useId, useMemo } from "react";
import type { GameConfig } from "@/lib/snakes/types";
import { cellToBoardPercent } from "@/lib/snakes/boardUtils";

/**
 * SnakesLaddersSVG - draws snakes & ladders across the board.
 *
 * Redesigned 2026-05-05 per Itzik's brief: replace the cartoon green
 * snakes + orange wood ladders with an intimate-dark, art-nouveau /
 * vintage-tattoo aesthetic. The board now reads "candlelit bedroom"
 * rather than "children's game".
 *
 * Snakes:
 *   • Matte black body with crimson belly accent + subtle gold scale dots
 *   • Sinuous Mucha-inspired curve (cubic bezier with offset control points)
 *   • Tapered tail (thicker at head, thinner at tip)
 *   • Subtle drop-shadow underneath for "lifts off the board" depth
 *   • Crimson tongue, gold-rimmed eye - minimal, no cartoon face
 *
 * Ladders:
 *   • Aged-brass / rose-gold metallic gradient (linear, not flat)
 *   • Subtle highlight band + darker edge for hand-burnished feel
 *   • Optional ivy-vine accent at the foot (decorative drop)
 *
 * Coordinates remain in a 100×100 viewBox mapped to the board's bounding
 * box, so everything scales perfectly with the grid. SVG sits between the
 * cell grid and the players overlay (pointer-events:none).
 */
export function SnakesLaddersSVG({
  config,
  isRtl = false,
}: {
  config: Pick<GameConfig, "boardSize" | "snakes" | "ladders">;
  /** When true, mirrors x coordinates so snakes/ladders align with the
   *  RTL-flipped cell grid. Same reason as PlayersOverlay's isRtl prop:
   *  CSS dir flips the grid visually but doesn't flip SVG geometry. */
  isRtl?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const size = config.boardSize || 100;

  // Apply the RTL mirror once at the data layer - cleaner than threading
  // it through every Snake/Ladder sub-component.
  const mirrorX = (xPct: number) => (isRtl ? 100 - xPct : xPct);

  const snakePaths = useMemo(
    () =>
      (config.snakes ?? []).map((s) => {
        const from = cellToBoardPercent(s.from, size);
        const to = cellToBoardPercent(s.to, size);
        return {
          item: s,
          from: { ...from, xPct: mirrorX(from.xPct) },
          to: { ...to, xPct: mirrorX(to.xPct) },
        };
      }),
    // mirrorX is a closure over isRtl; including isRtl makes deps explicit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.snakes, size, isRtl],
  );

  const ladderPaths = useMemo(
    () =>
      (config.ladders ?? []).map((l) => {
        const from = cellToBoardPercent(l.from, size);
        const to = cellToBoardPercent(l.to, size);
        return {
          item: l,
          from: { ...from, xPct: mirrorX(from.xPct) },
          to: { ...to, xPct: mirrorX(to.xPct) },
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.ladders, size, isRtl],
  );

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {/* ── Snake - matte black body with crimson belly accent ── */}
        <linearGradient id={`snakeBody-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1a0508" />
          <stop offset="50%" stopColor="#0c0204" />
          <stop offset="100%" stopColor="#1a0508" />
        </linearGradient>
        {/* Crimson belly stripe - runs alongside the body */}
        <linearGradient id={`snakeBelly-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5b081c" stopOpacity="0" />
          <stop offset="50%" stopColor="#9b2235" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#5b081c" stopOpacity="0" />
        </linearGradient>
        {/* Subtle gold scale dots overlay */}
        <pattern
          id={`scales-${uid}`}
          x="0"
          y="0"
          width="1.5"
          height="1.5"
          patternUnits="userSpaceOnUse"
        >
          <rect width="1.5" height="1.5" fill="transparent" />
          <circle cx="0.75" cy="0.75" r="0.18" fill="rgba(201,169,97,0.4)" />
        </pattern>
        {/* Glow halo beneath the snake - soft gold/crimson */}
        <radialGradient id={`snakeGlow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(155,34,53,0.35)" />
          <stop offset="100%" stopColor="rgba(155,34,53,0)" />
        </radialGradient>

        {/* ── Ladder - aged brass / rose-gold metallic ── */}
        <linearGradient id={`ladderRail-${uid}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#7a5a2e" />
          <stop offset="35%" stopColor="#C9A961" />
          <stop offset="50%" stopColor="#E6CB85" />
          <stop offset="65%" stopColor="#C9A961" />
          <stop offset="100%" stopColor="#5e4422" />
        </linearGradient>
        <linearGradient id={`ladderRung-${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8a6630" />
          <stop offset="50%" stopColor="#C9A961" />
          <stop offset="100%" stopColor="#5e4422" />
        </linearGradient>
        <radialGradient id={`ladderGlow-${uid}`} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="rgba(201,169,97,0.30)" />
          <stop offset="100%" stopColor="rgba(201,169,97,0)" />
        </radialGradient>
      </defs>

      {/* Ladders first - snakes render on top of them so a snake's head
          sitting on a ladder cell still reads correctly. */}
      {ladderPaths.map((lp, i) => (
        <Ladder
          key={`ladder-${i}-${lp.item.from}-${lp.item.to}`}
          fromX={lp.from.xPct}
          fromY={lp.from.yPct}
          toX={lp.to.xPct}
          toY={lp.to.yPct}
          railGradId={`ladderRail-${uid}`}
          rungGradId={`ladderRung-${uid}`}
          glowGradId={`ladderGlow-${uid}`}
        />
      ))}

      {snakePaths.map((sp, i) => (
        <Snake
          key={`snake-${i}-${sp.item.from}-${sp.item.to}`}
          fromX={sp.from.xPct}
          fromY={sp.from.yPct}
          toX={sp.to.xPct}
          toY={sp.to.yPct}
          bodyGradId={`snakeBody-${uid}`}
          bellyGradId={`snakeBelly-${uid}`}
          scalesId={`scales-${uid}`}
          glowGradId={`snakeGlow-${uid}`}
        />
      ))}
    </svg>
  );
}

// ─── Snake (art-nouveau, matte black + crimson) ──────────────────────────────

function Snake({
  fromX,
  fromY,
  toX,
  toY,
  bodyGradId,
  bellyGradId,
  scalesId,
  glowGradId,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  bodyGradId: string;
  bellyGradId: string;
  scalesId: string;
  glowGradId: string;
}) {
  // Build a sinuous S-curve from head (from = high-numbered cell) down
  // to tail (to = low-numbered cell). Two cubic bezier control points
  // alternated perpendicular to the head→tail line give a natural snake
  // body shape.
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;

  // Curve amplitude proportional to length - longer snakes coil more
  // pronouncedly. Slightly more dramatic than the previous version
  // (0.40 vs 0.35) for an art-nouveau "swooping" feel.
  const amp = Math.min(20, Math.max(7, len * 0.40));

  // Two control points flipping sides - classic S-curve
  const cp1x = fromX + dx * 0.33 + px * amp;
  const cp1y = fromY + dy * 0.33 + py * amp;
  const cp2x = fromX + dx * 0.66 - px * amp;
  const cp2y = fromY + dy * 0.66 - py * amp;

  const d = `M ${fromX} ${fromY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toX} ${toY}`;

  // Soft glow halo placed at head position - a crimson "embers" effect
  // that hints the snake is more than just a line.
  const glowR = Math.max(6, len * 0.18);

  return (
    <g style={{ filter: "drop-shadow(0 0.6px 1.2px rgba(0,0,0,0.65))" }}>
      {/* Crimson glow halo at head - under the body */}
      <circle
        cx={fromX}
        cy={fromY}
        r={glowR}
        fill={`url(#${glowGradId})`}
        opacity={0.7}
      />

      {/* Body underlay - slightly thicker matte black for outline depth */}
      <path
        d={d}
        fill="none"
        stroke="#000"
        strokeWidth={3.6}
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* Body main fill - black-on-black gradient gives subtle volume */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${bodyGradId})`}
        strokeWidth={3.0}
        strokeLinecap="round"
      />
      {/* Crimson belly stripe - narrower than body, runs along same path
          but shifted slightly so it reads as a side-stripe accent */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${bellyGradId})`}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.8}
      />
      {/* Gold scale dots - barely visible, give the body texture
          without becoming "scales". Vintage-tattoo subtle. */}
      <path
        d={d}
        fill="none"
        stroke={`url(#${scalesId})`}
        strokeWidth={3.0}
        strokeLinecap="round"
        opacity={0.55}
      />
      {/* Top highlight stripe - thin, dim white to suggest reflected
          candlelight on the snake's spine */}
      <path
        d={d}
        fill="none"
        stroke="rgba(230,203,133,0.20)"
        strokeWidth={0.4}
        strokeLinecap="round"
      />

      {/* Head - minimal, no cartoon face */}
      <SnakeHead
        x={fromX}
        y={fromY}
        angle={Math.atan2(cp1y - fromY, cp1x - fromX)}
      />
    </g>
  );
}

function SnakeHead({ x, y, angle }: { x: number; y: number; angle: number }) {
  // Slightly larger than body width for visual punctuation. Direction:
  // points AWAY from the body's first control point (so it faces
  // outward, like a real snake's head leading the curve).
  const headR = 2.0;
  const tongueLen = 1.8;
  // Tongue extends from the front of the head (away from body)
  const tongueX = x - Math.cos(angle) * (headR + tongueLen);
  const tongueY = y - Math.sin(angle) * (headR + tongueLen);
  // Single eye on the visible side of the head - minimalist
  const eyeOffset = 0.7;
  const eyeX = x - Math.cos(angle) * 0.4 + Math.cos(angle + Math.PI / 2) * eyeOffset;
  const eyeY = y - Math.sin(angle) * 0.4 + Math.sin(angle + Math.PI / 2) * eyeOffset;

  return (
    <g>
      {/* Forked tongue - crimson, thin, suggestive */}
      <line
        x1={x - Math.cos(angle) * headR * 0.7}
        y1={y - Math.sin(angle) * headR * 0.7}
        x2={tongueX}
        y2={tongueY}
        stroke="#9b2235"
        strokeWidth={0.35}
        strokeLinecap="round"
      />
      <line
        x1={tongueX}
        y1={tongueY}
        x2={tongueX + Math.cos(angle + Math.PI / 2) * 0.45 - Math.cos(angle) * 0.3}
        y2={tongueY + Math.sin(angle + Math.PI / 2) * 0.45 - Math.sin(angle) * 0.3}
        stroke="#9b2235"
        strokeWidth={0.3}
        strokeLinecap="round"
      />
      <line
        x1={tongueX}
        y1={tongueY}
        x2={tongueX + Math.cos(angle - Math.PI / 2) * 0.45 - Math.cos(angle) * 0.3}
        y2={tongueY + Math.sin(angle - Math.PI / 2) * 0.45 - Math.sin(angle) * 0.3}
        stroke="#9b2235"
        strokeWidth={0.3}
        strokeLinecap="round"
      />

      {/* Head - matte black with subtle gold edge */}
      <circle
        cx={x}
        cy={y}
        r={headR}
        fill="#0c0204"
        stroke="#C9A961"
        strokeWidth={0.18}
        strokeOpacity={0.55}
      />
      {/* Inner highlight dot - suggests volume under candlelight */}
      <circle
        cx={x - Math.cos(angle - Math.PI / 4) * 0.4}
        cy={y - Math.sin(angle - Math.PI / 4) * 0.4}
        r={0.5}
        fill="rgba(155,34,53,0.45)"
      />
      {/* Single gold-rimmed eye - replaces the previous cartoon two-eyes */}
      <circle cx={eyeX} cy={eyeY} r={0.42} fill="#0a0204" />
      <circle
        cx={eyeX}
        cy={eyeY}
        r={0.42}
        fill="none"
        stroke="#C9A961"
        strokeWidth={0.13}
        strokeOpacity={0.85}
      />
      <circle cx={eyeX + 0.08} cy={eyeY - 0.08} r={0.1} fill="#E6CB85" />
    </g>
  );
}

// ─── Ladder (aged brass) ──────────────────────────────────────────────────────

function Ladder({
  fromX,
  fromY,
  toX,
  toY,
  railGradId,
  rungGradId,
  glowGradId,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  railGradId: string;
  rungGradId: string;
  glowGradId: string;
}) {
  // Perpendicular unit vector - used to offset the two parallel rails.
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  // Rail separation (in viewBox units; cells are ~10 units, so 1.9
  // gives a comfortable rail width without overflowing the slice).
  const halfW = 1.9;

  const leftFrom = { x: fromX + px * halfW, y: fromY + py * halfW };
  const leftTo = { x: toX + px * halfW, y: toY + py * halfW };
  const rightFrom = { x: fromX - px * halfW, y: fromY - py * halfW };
  const rightTo = { x: toX - px * halfW, y: toY - py * halfW };

  // Rungs - every ~3.5 vb units along the line
  const rungCount = Math.max(3, Math.round(len / 3.5));
  const rungs: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];
  for (let i = 1; i < rungCount; i++) {
    const t = i / rungCount;
    rungs.push({
      a: {
        x: leftFrom.x + (leftTo.x - leftFrom.x) * t,
        y: leftFrom.y + (leftTo.y - leftFrom.y) * t,
      },
      b: {
        x: rightFrom.x + (rightTo.x - rightFrom.x) * t,
        y: rightFrom.y + (rightTo.y - rightFrom.y) * t,
      },
    });
  }

  // Soft gold halo at midpoint - gives the ladder a "lift" feel
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const haloR = Math.max(5, len * 0.16);

  return (
    <g style={{ filter: "drop-shadow(0 0.5px 1px rgba(0,0,0,0.55))" }}>
      {/* Soft gold glow halo behind the ladder */}
      <circle
        cx={midX}
        cy={midY}
        r={haloR}
        fill={`url(#${glowGradId})`}
        opacity={0.6}
      />

      {/* Left rail - outline + main + highlight stripe for metallic feel */}
      <line
        x1={leftFrom.x}
        y1={leftFrom.y}
        x2={leftTo.x}
        y2={leftTo.y}
        stroke="#3a2614"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      <line
        x1={leftFrom.x}
        y1={leftFrom.y}
        x2={leftTo.x}
        y2={leftTo.y}
        stroke={`url(#${railGradId})`}
        strokeWidth={0.85}
        strokeLinecap="round"
      />
      {/* Right rail */}
      <line
        x1={rightFrom.x}
        y1={rightFrom.y}
        x2={rightTo.x}
        y2={rightTo.y}
        stroke="#3a2614"
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      <line
        x1={rightFrom.x}
        y1={rightFrom.y}
        x2={rightTo.x}
        y2={rightTo.y}
        stroke={`url(#${railGradId})`}
        strokeWidth={0.85}
        strokeLinecap="round"
      />

      {/* Rungs - with subtle dark underlay so they look chunky / cast a
          shadow on the rails */}
      {rungs.map((r, i) => (
        <g key={i}>
          <line
            x1={r.a.x}
            y1={r.a.y + 0.15}
            x2={r.b.x}
            y2={r.b.y + 0.15}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={0.7}
            strokeLinecap="round"
          />
          <line
            x1={r.a.x}
            y1={r.a.y}
            x2={r.b.x}
            y2={r.b.y}
            stroke={`url(#${rungGradId})`}
            strokeWidth={0.6}
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}
