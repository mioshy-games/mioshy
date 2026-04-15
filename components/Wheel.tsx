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
  const r = 140;

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
    const a0 = polar(startRad, r);
    const a1 = polar(endRad, r);
    const large = endRad - startRad > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${a0.x} ${a0.y} A ${r} ${r} 0 ${large} 1 ${a1.x} ${a1.y} Z`;
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
      duration: 3.8,
      ease: [0.12, 0.8, 0.12, 1],
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
  ]);

  useImperativeHandle(ref, () => ({ spin }), [spin]);

  return (
    <div
      className="relative mx-auto aspect-square mt-10 sm:mt-14"
      style={{
        width: `min(92vw, ${wheelSizeRem}rem)`,
        maxWidth: `${wheelSizeRem}rem`,
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1"
        aria-hidden
      >
        <div
          className="h-0 w-0 border-x-[14px] border-x-transparent border-t-[22px] drop-shadow-md"
          style={{ borderTopColor: pointerColor }}
        />
      </div>
      <div
        className="relative h-full w-full overflow-hidden rounded-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)]"
        style={{ boxShadow: `0 0 0 4px ${borderColor}` }}
      >
        <svg className="h-full w-full" viewBox="0 0 300 300" aria-label="Wheel">
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
                  const p = polar(ang, r);
                  return (
                    <line
                      key={`div-${i}`}
                      x1={cx}
                      y1={cy}
                      x2={p.x}
                      y2={p.y}
                      stroke={dividerColor}
                      strokeWidth={dividerWidth}
                      vectorEffect="non-scaling-stroke"
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
                  fontSize={12}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  direction={isRtl ? "rtl" : "ltr"}
                  unicodeBidi="plaintext"
                  style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.25)", strokeWidth: 2 }}
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
              />
            ) : null}
          </motion.g>
        </svg>

        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/25 to-transparent" />
      </div>
      <span className="sr-only" aria-live="polite">
        {spinning ? "Spinning" : `Rotation ${Math.round(displayRotation % 360)}`}
      </span>
    </div>
  );
});

Wheel.displayName = "Wheel";
