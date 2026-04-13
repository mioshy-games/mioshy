"use client";

import { useMemo } from "react";
import type { WheelSlice } from "@/lib/types/database";

type WheelPreviewProps = {
  slices: WheelSlice[];
  borderColor: string;
  pointerColor: string;
  innerCircle: boolean;
  innerCircleColor: string;
  innerCircleBorderColor: string;
  /** Which label to show on preview slices */
  labelLang?: "he" | "en";
  className?: string;
};

export function WheelPreview({
  slices,
  borderColor,
  pointerColor,
  innerCircle,
  innerCircleColor,
  innerCircleBorderColor,
  labelLang = "he",
}: WheelPreviewProps) {
  const n = Math.max(slices.length, 1);
  const segmentAngle = 360 / n;

  const gradient = useMemo(() => {
    const parts = slices.map((s, i) => {
      const start = i * segmentAngle;
      const end = (i + 1) * segmentAngle;
      return `${s.color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(from 0deg, ${parts.join(", ")})`;
  }, [slices, segmentAngle]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px] min-w-[200px] sm:max-w-[300px]">
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1"
        aria-hidden
      >
        <div
          className="h-0 w-0 border-x-[10px] border-x-transparent border-t-[16px] drop-shadow-md"
          style={{ borderTopColor: pointerColor }}
        />
      </div>
      <div
        className="relative h-full w-full overflow-hidden rounded-full shadow-lg"
        style={{
          background: gradient,
          boxShadow: `0 0 0 4px ${borderColor}`,
        }}
      >
        {innerCircle ? (
          <div
            className="absolute left-1/2 top-1/2 z-[1] size-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              backgroundColor: innerCircleColor,
              boxShadow: `inset 0 0 0 3px ${innerCircleBorderColor}`,
            }}
          />
        ) : null}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
        {slices.map((slice, i) => {
          const bisectorDeg = (i + 0.5) * segmentAngle;
          const rad = (bisectorDeg * Math.PI) / 180;
          const rPct = 38;
          const x = 50 + rPct * Math.sin(rad);
          const y = 50 - rPct * Math.cos(rad);
          const label = labelLang === "he" ? slice.label_he : slice.label_en;
          const rot = bisectorDeg - 90;
          return (
            <div
              key={slice.id}
              className="absolute text-[10px] font-bold uppercase leading-tight text-white drop-shadow sm:text-xs"
              dir="auto"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) rotate(${rot}deg)`,
              }}
            >
              <span className="line-clamp-2 max-w-[4.5rem] text-center">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
