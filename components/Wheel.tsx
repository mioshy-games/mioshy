"use client";

import { motion, useMotionValue, animate } from "framer-motion";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import type { QuestionType } from "@/lib/game-engine";
import { startSpinSound, stopSpinSound } from "@/lib/sounds";
import { fitSvgToContainer } from "@/lib/utils";

export type WheelSegment = {
  type: QuestionType;
  label: string;
  color: string;
};

export type WheelProps = {
  options: WheelSegment[];
  onSettled: (result: { index: number; type: QuestionType }) => void;
  /** Optional: callback based on actual pointer position at rest. */
  onSpinComplete?: (type: QuestionType, index: number) => void;
  disabled?: boolean;
  onSpinStart?: () => void;
  /** When false, wheel spin SFX is muted. Default: true. */
  isSpinSoundEnabled?: boolean;
  pointerColor?: string;
  /**
   * Vertical offset applied to the pointer triangle in px.
   * Negative = upward (deeper into the wheel), positive = downward.
   * Clamped internally to -50 … +10. Default: 0.
   */
  pointerOffsetY?: number;
  borderColor?: string;
  innerCircle?: boolean;
  innerCircleColor?: string;
  innerCircleBorderColor?: string;
  dividerEnabled?: boolean;
  dividerColor?: string;
  dividerWidth?: number;
  markerConfig?: Record<string, unknown>;
  /** If set, wheel will try to avoid landing on this type. */
  forbiddenType?: QuestionType | null;
  /**
   * Minimum diameter of the wheel in rem units (base / mobile size).
   * Default: 22 (≈352 px).
   */
  wheelSizeRem?: number;
  /**
   * Maximum diameter in rem units for wide screens.
   * When set (and > wheelSizeRem) the width uses
   * CSS min(92vw, clamp(wheelSizeRem, 40vw, wheelSizeRemMax))
   * so the wheel scales smoothly between ~880 px and ~1280 px viewport.
   * On mobile the 92 vw cap always wins regardless of this value.
   * Defaults to wheelSizeRem (fixed size, old behaviour).
   */
  wheelSizeRemMax?: number;
  /**
   * Approximate px height consumed by all non-wheel content around the wheel
   * (top bar, logo, margins, spin button, safe-area padding, etc.).
   * When provided, the wheel width (= height, because aspect-ratio 1) is
   * additionally capped at `calc(100dvh - viewportBudgetPx)` so the wheel
   * and all surrounding content fit inside the visible viewport without
   * scrolling on short screens such as a laptop.
   * Has no effect when the screen is tall enough.
   * Default: 0 (no height constraint).
   */
  viewportBudgetPx?: number;
  /**
   * Radial position of slice labels as a fraction of r (0–1).
   * Default: 0.72 (sits in the outer third of each slice).
   */
  labelRadiusFraction?: number;
  /**
   * Spin animation duration in seconds. Default: 3.8
   * Driven by GameSettings.motion.spinSpeed (1–10 mapped to 6s–1.5s).
   */
  spinDuration?: number;
  /**
   * Framer Motion easing for the spin. Default: cubic-bezier ease-out.
   * Accepts a named easing or a cubic-bezier array.
   */
  spinEasing?: string | number[];
  /**
   * Outer ring around the wheel (from GameSettings.border).
   * Separate from the existing borderColor ring (which is actually a box-shadow).
   */
  outerBorder?: {
    enabled: boolean;
    width: number;
    color: string;
    style: "solid" | "dashed" | "none";
    /**
     * Gap from wheel edge in px (0–50).
     * Legacy string values ("attached"=0, "near"=8, "far"=20) still accepted.
     */
    distance: number | "attached" | "near" | "far";
  };
  centerShadow?: {
    enabled: boolean;
    color: string;
    opacity: number; // 0-1
    blur: number; // px
    offsetX: number;
    offsetY: number;
  };
  dividerShadow?: {
    enabled: boolean;
    color: string;
    opacity: number; // 0-1
    blur: number; // px
  };
  labelFontSizePx?: number;
  /** Fill colour of the slice text labels. Default: "#ffffff". */
  labelColor?: string;
  labelOutline?: {
    enabled: boolean;
    color: string;
    opacity: number; // 0-1
    width: number; // px
  };
  /**
   * Wheel container shape. Default: "circle".
   * "square" → rounded rectangle (keeps the circular SVG segments, clips to square).
   */
  wheelShape?: "circle" | "square";
  /**
   * Custom SVG markup for the pointer.
   * Replaces the default triangle. Use fill="currentColor" so pointerColor still applies.
   */
  pointerSvg?: string;
  /** Width of the custom SVG pointer in px. Default: 40. */
  pointerSvgWidth?: number;
  /** Height of the custom SVG pointer in px. Default: 48. */
  pointerSvgHeight?: number;
};

export type WheelApi = {
  spin: () => void;
};

export const Wheel = forwardRef<WheelApi, WheelProps>(function Wheel(
  {
    options,
    onSettled,
    onSpinComplete,
    disabled,
    onSpinStart,
    isSpinSoundEnabled = true,
    pointerColor = "#ffffff",
    pointerOffsetY = 0,
    borderColor = "rgba(255,255,255,0.30)",
    innerCircle = true,
    innerCircleColor = "rgba(255,255,255,0.95)",
    innerCircleBorderColor = "rgba(255,255,255,0.50)",
    dividerEnabled = true,
    dividerColor = "#ffffff",
    dividerWidth = 2,
    markerConfig = {},
    forbiddenType = null,
    wheelSizeRem = 22,
    wheelSizeRemMax,
    viewportBudgetPx = 0,
    labelRadiusFraction = 0.72,
    spinDuration = 3.8,
    spinEasing = [0.12, 0.8, 0.12, 1],
    outerBorder,
    centerShadow,
    dividerShadow,
    labelFontSizePx = 12,
    labelColor = "#ffffff",
    labelOutline = { enabled: true, color: "#000000", opacity: 0.25, width: 2 },
    wheelShape = "circle",
    pointerSvg,
    pointerSvgWidth = 40,
    pointerSvgHeight = 48,
  },
  ref,
) {
  const [spinning, setSpinning] = useState(false);
  const rotation = useMotionValue(0);
  const [displayRotation, setDisplayRotation] = useState(0);

  useEffect(() => {
    const unsub = rotation.on("change", (v) => setDisplayRotation(v));
    return () => unsub();
  }, [rotation]);

  const segmentAngle = 360 / Math.max(options.length, 1);

  const n = Math.max(options.length, 1);
  const segRad = (Math.PI * 2) / n;
  const cx = 150;
  const cy = 150;
  const r = 140;   // used for label / marker / divider positions (unchanged)
  const rEdge = 150; // = SVG half-width → segments fill to the rounded-full container edge,
                     //   eliminating the dark gap that appears between r=140 and the clip circle

  type MarkerCfg = {
    marker_type?: "none" | "circle" | "svg_icon";
    marker_color?: string;
    marker_size?: number;
    marker_count?: number;
    marker_position?: number;
    svg_path_d?: string;
  };
  const mc = (markerConfig ?? {}) as MarkerCfg;
  const markerType = mc.marker_type ?? "circle";
  const markerColor = mc.marker_color ?? "#ffffff";
  const markerSize = mc.marker_size ?? 14;
  const markerCount = mc.marker_count ?? 0;
  const markerPos = mc.marker_position ?? 100;
  const markerPathD = mc.svg_path_d ?? "";

  function polar(rad: number, rr: number) {
    return { x: cx + rr * Math.cos(rad), y: cy + rr * Math.sin(rad) };
  }

  function wedgePath(startRad: number, endRad: number) {
    // Paths use rEdge (=150) so segments fill the full rounded-full container,
    // removing the empty ring that appeared between r=140 and the clip circle.
    const a0 = polar(startRad, rEdge);
    const a1 = polar(endRad, rEdge);
    const large = endRad - startRad > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${a0.x} ${a0.y} A ${rEdge} ${rEdge} 0 ${large} 1 ${a1.x} ${a1.y} Z`;
  }

  const markerAngles = useMemo(() => {
    const count = markerCount > 0 ? markerCount : n;
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / count);
  }, [markerCount, n]);

  const markerRadius = (r * markerPos) / 100;

  function normalizeDeg(d: number) {
    const m = d % 360;
    return m < 0 ? m + 360 : m;
  }

  const indexAtPointer = useCallback(
    (rotDeg: number) => {
      const rot = normalizeDeg(rotDeg);
      const angle = normalizeDeg(360 - rot); // maps to the same middleDeg used for targeting
      const idx = Math.floor(angle / segmentAngle);
      return Math.min(Math.max(idx, 0), Math.max(options.length - 1, 0));
    },
    [options.length, segmentAngle],
  );

  const spin = useCallback(() => {
    if (disabled || spinning || options.length === 0) return;
    onSpinStart?.();
    const eligible =
      forbiddenType && options.length > 1
        ? options
            .map((o, i) => ({ o, i }))
            .filter(({ o }) => o.type !== forbiddenType)
            .map(({ i }) => i)
        : null;
    const winIndex = eligible?.length
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : Math.floor(Math.random() * options.length);
    const middleDeg = winIndex * segmentAngle + segmentAngle / 2;
    // Land within ±38% of the segment width — keeps the pointer clearly inside
    // the winning slice while making each spin look visually unique instead of
    // always stopping at the dead centre of the slice.
    const sliceJitter = (Math.random() - 0.5) * segmentAngle * 0.76;
    const targetDeg = middleDeg + sliceJitter;
    const startRot = rotation.get();
    const fullSpins = 4 + Math.floor(Math.random() * 3); // 4–6 spins (was 4–5)
    const delta = fullSpins * 360 + (360 - (targetDeg % 360));
    const targetRot = startRot + delta;
    const playAudio = isSpinSoundEnabled;

    if (playAudio) {
      startSpinSound();
    }

    setSpinning(true);
    animate(rotation, targetRot, {
      duration: spinDuration,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ease: spinEasing as any,
      onComplete: () => {
        if (playAudio) {
          stopSpinSound();
        }
        setSpinning(false);
        const idx = indexAtPointer(rotation.get());
        const t = options[idx]?.type ?? options[0]!.type;
        onSpinComplete?.(t, idx);
        onSettled({ index: idx, type: t });
      },
    });
  }, [
    disabled,
    spinning,
    options,
    segmentAngle,
    rotation,
    onSettled,
    onSpinComplete,
    onSpinStart,
    isSpinSoundEnabled,
    forbiddenType,
    indexAtPointer,
    spinDuration,
    spinEasing,
  ]);

  useImperativeHandle(ref, () => ({ spin }), [spin]);

  // ── Single controllable border ring ──────────────────────────────────────
  // We render ONE border only:
  //   • If outerBorder (from GameSettings) is provided → use it exclusively
  //   • Otherwise → fall back to the legacy borderColor prop via box-shadow
  //
  // The border ring is an absolutely-positioned sibling div so dashed/solid
  // both work, and the wheel's rounded-full overflow-hidden is unaffected.
  //
  // Pointer is rendered inside the wheel container (never negative top)
  // so it doesn't overflow the wheel wrapper.

  const hasCustomBorder = outerBorder?.enabled && outerBorder.style !== "none";
  const hasOuterBorderProp = outerBorder !== undefined;

  /** Resolve gap: accepts both numeric px and legacy string presets */
  function resolveGap(d: number | "attached" | "near" | "far" | undefined): number {
    if (d === undefined) return 0;
    if (typeof d === "number") return d;
    return { attached: 0, near: 8, far: 20 }[d] ?? 0;
  }

  const borderGapPx = hasCustomBorder ? resolveGap(outerBorder!.distance) : 0;
  const borderWidthPx = hasCustomBorder ? outerBorder!.width : 0;

  // ── Pointer position ────────────────────────────────────────────────────
  // The pointer is fully INDEPENDENT of the border ring.
  // pointerOffsetY is the sole control:
  //   0  → tip sits right at the wheel rim (default)
  //   negative → moves up / deeper into the wheel (max -50 px)
  //   positive → moves down / away from the wheel  (max +10 px)
  // The border ring is a sibling element at z-[5] and never affects this value.
  const clampedOffsetY = Math.max(-50, Math.min(10, pointerOffsetY));
  const pointerTopPx = clampedOffsetY;

  // ── Responsive width ────────────────────────────────────────────────────
  // The wheel is square (aspect-ratio 1), so constraining width = constraining height.
  //
  // Sizing axes (all composed with CSS min/clamp):
  //   1. 92 vw              — mobile cap; wheel never wider than 92% of viewport
  //   2. 100dvh - budget    — height constraint: wheel + surrounding content fit
  //                           within one viewport without scrolling
  //   3. effectiveMax rem   — hard ceiling (60 rem ≈ 960 px default)
  //
  // Floor: 14rem (224px) absolute minimum when height-budget is active,
  //        so the wheel stays usable on very short screens (landscape mobile,
  //        small laptops). Without a budget the floor is wheelSizeRem.
  //
  // Note: wheelSizeRem (admin "Wheel size" slider) acts as the minimum floor
  //       on game pages. The real maximum is the viewport height constraint —
  //       not wheelSizeRem — so the wheel fills the screen proportionally.
  //       Only a wheelSizeRemMax explicitly larger than wheelSizeRem acts as
  //       a hard cap; otherwise 60rem is used so the height constraint wins.
  const effectiveMax = (wheelSizeRemMax && wheelSizeRemMax > wheelSizeRem)
    ? wheelSizeRemMax
    : 60; // 60rem ≈ 960 px; viewport constraints (92vw, 100dvh-N) do the real limiting

  // Primary sizing driver: remaining viewport height after surrounding content.
  // No inner vw cap — 92vw outer cap already handles mobile.
  const preferred = viewportBudgetPx > 0
    ? `calc(100dvh - ${viewportBudgetPx}px)`
    : `${wheelSizeRem}rem`; // no budget → treat sizeRem as a fixed target

  // floor: shrink below sizeRem on very short screens when a budget is given
  const floor = viewportBudgetPx > 0 ? `14rem` : `${wheelSizeRem}rem`;

  // Simple fixed-size path: no budget AND no explicit max → legacy behaviour.
  // Responsive path: budget given → let height constraint drive size.
  const wheelWidth = (viewportBudgetPx === 0 && (!wheelSizeRemMax || wheelSizeRemMax <= wheelSizeRem))
    ? `min(92vw, ${wheelSizeRem}rem)`
    : `min(92vw, clamp(${floor}, ${preferred}, ${effectiveMax}rem))`;

  return (
    <div
      className="relative mx-auto aspect-square"
      style={{
        width: wheelWidth,
        maxWidth: `min(92vw, ${effectiveMax}rem)`,
      }}
    >
      {/* ── Border ring (one single ring) ──────────────────────────────── */}
      {/* z-[5]: sits BELOW the wheel disc (z-auto), markers (z-20), and    */}
      {/* pointer (z-30) so it never obscures them.                          */}
      {hasCustomBorder ? (
        // Controlled ring from GameSettings
        <div
          aria-hidden
          className="pointer-events-none absolute z-[5]"
          style={{
            inset: -(borderGapPx + borderWidthPx),
            border: `${borderWidthPx}px ${outerBorder!.style} ${outerBorder!.color}`,
            borderRadius: wheelShape === "square" ? `calc(1.25rem + ${borderGapPx + borderWidthPx}px)` : "9999px",
          }}
        />
      ) : (
        // Legacy fallback — invisible div, actual ring comes from box-shadow on wheel div
        null
      )}

      {/* ── Pointer — topmost element (z-30) ─────────────────────────────── */}
      {/* Above border ring (z-[5]), wheel disc (z-auto), and markers (z-20) */}
      {pointerSvg ? (
        /* Custom SVG pointer — centered via marginLeft so inline style wins cleanly */
        <div
          className="pointer-events-none absolute z-30"
          style={{
            top: pointerTopPx,
            left: "50%",
            transform: `translateX(-50%)`,
            width: pointerSvgWidth,
            height: pointerSvgHeight,
            color: pointerColor,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
          }}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: fitSvgToContainer(pointerSvg) }}
        />
      ) : (
        /* Default triangle */
        <div
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
          style={{ top: pointerTopPx }}
          aria-hidden
        >
          <div
            className="h-0 w-0 border-x-[14px] border-x-transparent border-t-[22px] drop-shadow-md"
            style={{ borderTopColor: pointerColor }}
          />
        </div>
      )}

      <div
        className="relative h-full w-full overflow-hidden"
        style={{
          borderRadius: wheelShape === "square" ? "1.25rem" : "9999px",
          boxShadow: hasCustomBorder
            ? "0 20px 60px -15px rgba(0,0,0,0.35)"           // only depth shadow, no ring
            : hasOuterBorderProp
              ? "0 20px 60px -15px rgba(0,0,0,0.35)"         // outerBorder exists but disabled/none → no ring
              : `0 0 0 4px ${borderColor}, 0 20px 60px -15px rgba(0,0,0,0.35)`, // legacy ring (only when no outerBorder prop)
        }}
      >
        <svg className="h-full w-full" viewBox="0 0 300 300" aria-label="Wheel">
          <defs>
            {/* Default soft shadow always applied to the inner circle.
                Gives depth without requiring the admin to configure centerShadow. */}
            <filter id="mioInnerCircleShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="5"
                floodColor="#000000"
                floodOpacity="0.28"
              />
            </filter>

            {centerShadow?.enabled ? (
              <filter id="mioCenterShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx={centerShadow.offsetX}
                  dy={centerShadow.offsetY}
                  stdDeviation={centerShadow.blur}
                  floodColor={centerShadow.color}
                  floodOpacity={centerShadow.opacity}
                />
              </filter>
            ) : null}
            {dividerShadow?.enabled ? (
              <filter id="mioDividerShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation={dividerShadow.blur}
                  floodColor={dividerShadow.color}
                  floodOpacity={dividerShadow.opacity}
                />
              </filter>
            ) : null}
          </defs>
          <motion.g style={{ rotate: rotation, transformOrigin: "150px 150px" }}>
            {options.map((opt, i) => {
              const start = -Math.PI / 2 + i * segRad;
              const end = start + segRad;
              return (
                <path
                  key={`seg-${i}`}
                  d={wedgePath(start, end)}
                  fill={opt.color}
                />
              );
            })}

            {dividerEnabled && options.length > 1
              ? Array.from({ length: n }, (_, i) => {
                  const ang = -Math.PI / 2 + i * segRad;
                  // Extend 1px beyond the edge and use round caps to avoid
                  // subpixel "gaps" that can appear at the outer rim.
                  const p = polar(ang, rEdge + 1);
                  return (
                    <line
                      key={`div-${i}`}
                      x1={cx}
                      y1={cy}
                      x2={p.x}
                      y2={p.y}
                      stroke={dividerColor}
                      strokeWidth={dividerWidth}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      filter={dividerShadow?.enabled ? "url(#mioDividerShadow)" : undefined}
                    />
                  );
                })
              : null}

            {/* Markers were moved to the overlay SVG below the overflow-hidden div
                so they are never clipped when positioned near or beyond the rim. */}

            {options.map((opt, i) => {
              // Segment i covers [i*seg, (i+1)*seg] clockwise from top, so bisector is centerline.
              const bisector = -Math.PI / 2 + (i + 0.5) * segRad;
              const labelRadius = r * labelRadiusFraction;
              const p = polar(bisector, labelRadius);
              // Tangential labels: rotate with slice; -90deg aligns tangent direction.
              const rot = (bisector * 180) / Math.PI - 90;
              const isRtl = /[\u0590-\u05FF]/.test(opt.label);
              return (
                <text
                  key={`lbl-${i}`}
                  x={p.x}
                  y={p.y}
                  fill={labelColor}
                  fontSize={labelFontSizePx}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  direction={isRtl ? "rtl" : "ltr"}
                  unicodeBidi="plaintext"
                  style={
                    labelOutline?.enabled
                      ? {
                          paintOrder: "stroke",
                          stroke: labelOutline.color,
                          strokeWidth: labelOutline.width,
                          strokeOpacity: labelOutline.opacity,
                        }
                      : undefined
                  }
                  transform={`rotate(${rot} ${p.x} ${p.y})`}
                >
                  {opt.label}
                </text>
              );
            })}

            {innerCircle ? (
              <circle
                cx={cx}
                cy={cy}
                r={40}
                fill={innerCircleColor}
                stroke={innerCircleBorderColor}
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                filter={centerShadow?.enabled ? "url(#mioCenterShadow)" : "url(#mioInnerCircleShadow)"}
              />
            ) : null}
          </motion.g>
        </svg>

        {/* Subtle rim highlight. Hide when outerBorder is explicitly disabled to avoid a "ghost border". */}
        {hasCustomBorder || !hasOuterBorderProp ? (
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/25 to-transparent" />
        ) : null}
      </div>

      {/* ── Marker overlay — OUTSIDE the overflow-hidden div ──────────────── */}
      {/* Rendered in a sibling SVG so dots are never clipped by the circular  */}
      {/* mask, even when markerRadius + markerSize/2 exceeds the wheel rim.   */}
      {/* z-20: above border ring (z-[5]) and wheel disc (z-auto),             */}
      {/* but below the pointer triangle (z-30).                               */}
      {markerType !== "none" && markerAngles.length > 0 ? (
        <svg
          className="pointer-events-none absolute inset-0 z-20 h-full w-full"
          viewBox="0 0 300 300"
          // overflow:visible lets markers bleed past the SVG bounding box
          // when positioned near or slightly outside the wheel edge.
          style={{ overflow: "visible" }}
          aria-hidden
        >
          <motion.g style={{ rotate: rotation, transformOrigin: "150px 150px" }}>
            {markerAngles.map((ang, idx) => {
              const p = polar(ang, markerRadius);
              if (markerType === "circle") {
                return (
                  <circle
                    key={`m-${idx}`}
                    cx={p.x}
                    cy={p.y}
                    r={markerSize / 2}
                    fill={markerColor}
                  />
                );
              }
              if (!markerPathD) return null;
              const s = markerSize / 24;
              return (
                <g
                  key={`m-${idx}`}
                  transform={`translate(${p.x}, ${p.y}) scale(${s}) translate(-12, -12)`}
                  fill={markerColor}
                >
                  <path d={markerPathD} />
                </g>
              );
            })}
          </motion.g>
        </svg>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {spinning ? "Spinning" : `Rotation ${Math.round(displayRotation % 360)}`}
      </span>
    </div>
  );
});

Wheel.displayName = "Wheel";
