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
};

export type WheelProps = {
  options: WheelSegment[];
  onSettled: (result: { index: number; type: QuestionType }) => void;
  disabled?: boolean;
  onSpinStart?: () => void;
  /** When false, wheel spin SFX is muted. Default: true. */
  isSpinSoundEnabled?: boolean;
};

export type WheelApi = {
  spin: () => void;
};

/** Fixed fill per game type — all truth slices share X, all dare slices share Y. */
const SEGMENT_COLOR: Record<QuestionType, string> = {
  truth: "#f472b6",
  dare: "#a78bfa",
};

export const Wheel = forwardRef<WheelApi, WheelProps>(function Wheel(
  { options, onSettled, disabled, onSpinStart, isSpinSoundEnabled = true },
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

  const gradient = useMemo(() => {
    const parts = options.map((opt, i) => {
      const start = i * segmentAngle;
      const end = (i + 1) * segmentAngle;
      const color = SEGMENT_COLOR[opt.type];
      return `${color} ${start}deg ${end}deg`;
    });
    // Must match label math below: 0° at top (12 o’clock), angles increase clockwise — same as x/y polar placement.
    return `conic-gradient(from 0deg, ${parts.join(", ")})`;
  }, [options, segmentAngle]);

  const spin = useCallback(() => {
    if (disabled || spinning || options.length === 0) return;
    onSpinStart?.();
    const winIndex = Math.floor(Math.random() * options.length);
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
        onSettled({
          index: winIndex,
          type: options[winIndex].type,
        });
      },
    });
  }, [
    disabled,
    spinning,
    options,
    segmentAngle,
    rotation,
    onSettled,
    onSpinStart,
    isSpinSoundEnabled,
  ]);

  useImperativeHandle(ref, () => ({ spin }), [spin]);

  return (
    <div className="relative mx-auto aspect-square w-[min(92vw,22rem)] max-w-[22rem] sm:w-80 mt-20">
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1"
        aria-hidden
      >
        <div className="h-0 w-0 border-x-[14px] border-x-transparent border-t-[22px] border-t-white drop-shadow-md" />
      </div>
      <motion.div
        className="relative h-full w-full overflow-hidden rounded-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.35)] ring-4 ring-white/30"
        dir="ltr"
        style={{
          rotate: rotation,
          background: gradient,
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/25 to-transparent" />
        {options.map((opt, i) => {
          // conic-gradient(from 0deg): segment i is [i*seg, (i+1)*seg] clockwise from top; bisector = wedge centerline.
          const bisectorDegFromTop = (i + 0.5) * segmentAngle;
          const rad = (bisectorDegFromTop * Math.PI) / 180;
          const rInnerPct = 18;
          const rOuterPct = 40;
          const band = rOuterPct - rInnerPct;
          const rPct = rInnerPct + band * 0.5;
          const x = 50 + rPct * Math.sin(rad);
          const y = 50 - rPct * Math.cos(rad);
          // Tangential labels (like the reference): baseline follows the rim — bisector from top, minus 90° aligns with tangent.
          const labelRotateDeg = bisectorDegFromTop - 90;
          return (
            <div
              key={`${opt.label}-${i}`}
              className="pointer-events-none absolute"
              dir="auto"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(${labelRotateDeg}deg)`,
              }}
            >
              <div className="flex max-w-[min(42vw,8rem)] items-center justify-center whitespace-nowrap text-center text-[11px] font-bold uppercase leading-tight text-white drop-shadow-sm sm:text-xs">
                {opt.label}
              </div>
            </div>
          );
        })}
      </motion.div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-16 w-16 rounded-full bg-white/95 shadow-lg ring-2 ring-white/50" />
      </div>
      <span className="sr-only" aria-live="polite">
        {spinning ? "Spinning" : `Rotation ${Math.round(displayRotation % 360)}`}
      </span>
    </div>
  );
});

Wheel.displayName = "Wheel";
