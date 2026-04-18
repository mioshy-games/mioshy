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
   * Diameter of the wheel in rem units.
   * Default: 22 (≈352px). Only affects size — all other settings unchanged.
   */
  wheelSizeRem?: number;
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
  labelOutline?: {
    enabled: boolean;
    color: string;
    opacity: number; // 0-1
    width: number; // px
  };
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
    labelRadiusFraction = 0.72,
    spinDuration = 3.8,
    spinEasing = [0.12, 0.8, 0.12, 1],
    outerBorder,
    centerShadow,
    dividerShadow,
    labelFontSizePx = 12,
    labelOutline = { enabled: true, color: "#000000", opacity: 0.25, width: 2 },
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
    const startRot = rotation.get();
    const fullSpins = 4 + Math.floor(Math.random() * 2);
    const delta = fullSpins * 360 + (360 - (middleDeg % 360));
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
  // The pointer is a ▼ triangle: base at `top`, tip 22 px below.
  //
  // • No border  → base sits just inside the wheel rim (original feel, +4 px).
  // • With border → base snaps to the outer edge of the border ring so the
  //   pointer visually "attaches" to the ring.  We also clamp the tip to be
  //   at most -2 px (i.e. always enters the wheel area) even when the gap is
  //   very large.
  //
  //   clamped = max(-(22 - 2), -(gap + width))  →  tip ≥ 2 px inside wheel
  const pointerTopPx = hasCustomBorder
    ? Math.max(-(22 - 2), -(borderGapPx + borderWidthPx))
    : 4;

  return (
    <div
      className="relative mx-auto aspect-square mt-10 sm:mt-14"
      style={{
        width: `min(92vw, ${wheelSizeRem}rem)`,
        maxWidth: `${wheelSizeRem}rem`,
      }}
    >
      {/* ── Border ring (one single ring) ──────────────────────────────── */}
      {hasCustomBorder ? (
        // Controlled ring from GameSettings
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full z-10"
          style={{
            inset: -(borderGapPx + borderWidthPx),
            border: `${borderWidthPx}px ${outerBorder!.style} ${outerBorder!.color}`,
          }}
        />
      ) : (
        // Legacy fallback — invisible div, actual ring comes from box-shadow on wheel div
        null
      )}

      {/* ── Pointer triangle — always on top, inside wrapper ─────────────── */}
      <div
        className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
        style={{ top: pointerTopPx }}
        aria-hidden
      >
        <div
          className="h-0 w-0 border-x-[14px] border-x-transparent border-t-[22px] drop-shadow-md"
          style={{ borderTopColor: pointerColor }}
        />
      </div>

      <div
        className="relative h-full w-full overflow-hidden rounded-full"
        style={{
          boxShadow: hasCustomBorder
            ? "0 20px 60px -15px rgba(0,0,0,0.35)"           // only depth shadow, no ring
            : hasOuterBorderProp
              ? "0 20px 60px -15px rgba(0,0,0,0.35)"         // outerBorder exists but disabled/none → no ring
              : `0 0 0 4px ${borderColor}, 0 20px 60px -15px rgba(0,0,0,0.35)`, // legacy ring (only when no outerBorder prop)
        }}
      >
        <svg className="h-full w-full" viewBox="0 0 300 300" aria-label="Wheel">
          <defs>
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

            {markerType !== "none"
              ? markerAngles.map((ang, idx) => {
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
                })
              : null}

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
                  fill="white"
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
                filter={centerShadow?.enabled ? "url(#mioCenterShadow)" : undefined}
              />
            ) : null}
          </motion.g>
        </svg>

        {/* Subtle rim highlight. Hide when outerBorder is explicitly disabled to avoid a "ghost border". */}
        {hasCustomBorder || !hasOuterBorderProp ? (
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/25 to-transparent" />
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">
        {spinning ? "Spinning" : `Rotation ${Math.round(displayRotation % 360)}`}
      </span>
    </div>
  );
});

Wheel.displayName = "Wheel";
