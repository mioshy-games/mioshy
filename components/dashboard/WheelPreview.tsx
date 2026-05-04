"use client";

import { useMemo } from "react";
import { fitSvgToContainer } from "@/lib/utils";
import { splitLabelToLines } from "@/components/Wheel";
import type { WheelSlice } from "@/lib/types/database";

type WheelPreviewProps = {
  slices: WheelSlice[];
  borderColor: string;
  pointerColor: string;
  /** Vertical offset of the pointer in px. Negative = up into the wheel, positive = down. Default 0. */
  pointerOffsetY?: number;
  innerCircle: boolean;
  innerCircleColor: string;
  innerCircleBorderColor: string;
  dividerEnabled: boolean;
  dividerColor: string;
  dividerWidth: number;
  markerConfig: Record<string, unknown>;
  /** Which label to show on preview slices */
  labelLang?: "he" | "en";
  className?: string;
  /** Label font size in px (from game_settings) */
  labelFontSizePx?: number;
  /** Label fill color (from game_settings) */
  labelColor?: string;
  /** Label text outline (from game_settings) */
  labelOutline?: { enabled: boolean; color: string; opacity: number; width: number };
  /** Outer border ring (from game_settings.border) */
  outerBorder?: { enabled: boolean; color: string; style: "solid" | "dashed" | "none"; width: number; distance: number } | null;
  /** Custom SVG markup for the pointer (replaces triangle). */
  pointerSvg?: string;
  /** Width of the custom SVG pointer in px. Default: 40. */
  pointerSvgWidth?: number;
  /** Height of the custom SVG pointer in px. Default: 48. */
  pointerSvgHeight?: number;
};

type MarkerConfig = {
  marker_type?: "none" | "circle" | "svg_icon";
  marker_color?: string;
  marker_size?: number;
  marker_count?: number;
  marker_position?: number;
  svg_path_d?: string;
};

function polar(cx: number, cy: number, r: number, rad: number) {
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(
  cx: number,
  cy: number,
  r: number,
  startRad: number,
  endRad: number,
) {
  const a0 = polar(cx, cy, r, startRad);
  const a1 = polar(cx, cy, r, endRad);
  const large = endRad - startRad > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${a0.x} ${a0.y} A ${r} ${r} 0 ${large} 1 ${a1.x} ${a1.y} Z`;
}

export function WheelPreview({
  slices,
  borderColor,
  pointerColor,
  pointerOffsetY = 0,
  innerCircle,
  innerCircleColor,
  innerCircleBorderColor,
  dividerEnabled,
  dividerColor,
  dividerWidth,
  markerConfig,
  labelLang = "he",
  labelFontSizePx = 12,
  labelColor = "#ffffff",
  labelOutline,
  outerBorder,
  pointerSvg,
  pointerSvgWidth = 40,
  pointerSvgHeight = 48,
}: WheelPreviewProps) {
  const n = Math.max(slices.length, 1);
  const seg = (Math.PI * 2) / n;
  const cx = 150;
  const cy = 150;
  const r = 140;

  const markers = (markerConfig ?? {}) as MarkerConfig;
  const markerType = markers.marker_type ?? "circle";
  const markerColor = markers.marker_color ?? "#ffffff";
  const markerSize = markers.marker_size ?? 14;
  const markerCount = markers.marker_count ?? 0;
  const markerPos = markers.marker_position ?? 100;
  const markerPathD = markers.svg_path_d ?? "";

  const labels = useMemo(() => {
    return slices.map((s, i) => {
      const bisector = -Math.PI / 2 + (i + 0.5) * seg;
      const label = labelLang === "he" ? s.label_he : s.label_en;
      return { i, bisector, label };
    });
  }, [slices, seg, labelLang]);

  const markerAngles = useMemo(() => {
    const count = markerCount > 0 ? markerCount : n;
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / count);
  }, [markerCount, n]);

  const markerRadius = (r * markerPos) / 100;

  // Outer border ring (from game_settings.border) - absolutely positioned sibling
  const hasOuterBorder = outerBorder?.enabled && outerBorder.style !== "none";
  const outerGapPx     = hasOuterBorder ? (outerBorder!.distance ?? 0) : 0;
  const outerWidthPx   = hasOuterBorder ? (outerBorder!.width ?? 2) : 0;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px] min-w-[200px] sm:max-w-[300px]">
      {/* Outer border ring */}
      {hasOuterBorder && (
        <div
          className="pointer-events-none absolute rounded-full z-[5]"
          style={{
            inset: -(outerGapPx + outerWidthPx),
            border: `${outerWidthPx}px ${outerBorder!.style} ${outerBorder!.color}`,
          }}
          aria-hidden
        />
      )}

      {pointerSvg ? (
        /* Custom SVG pointer */
        <div
          className="pointer-events-none absolute z-30"
          style={{
            top: Math.max(-50, Math.min(10, pointerOffsetY)) - 1,
            left: "50%",
            width: pointerSvgWidth,
            height: pointerSvgHeight,
            marginLeft: -(pointerSvgWidth / 2),
            color: pointerColor,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          }}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: fitSvgToContainer(pointerSvg) }}
        />
      ) : (
        /* Default triangle */
        <div
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2"
          style={{ top: Math.max(-50, Math.min(10, pointerOffsetY)) - 1 }}
          aria-hidden
        >
          <div
            className="h-0 w-0 border-x-[10px] border-x-transparent border-t-[16px] drop-shadow-md"
            style={{ borderTopColor: pointerColor }}
          />
        </div>
      )}

      <svg
        className="h-full w-full overflow-visible drop-shadow-lg"
        viewBox="0 0 300 300"
        role="img"
        aria-label="Wheel preview"
      >
        <defs>
          <filter id="mioInnerCircleShadowPrev" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#000000" floodOpacity="0.28" />
          </filter>
        </defs>
        {slices.map((s, i) => {
          const start = -Math.PI / 2 + i * seg;
          const end = start + seg;
          return <path key={s.id} d={wedgePath(cx, cy, r, start, end)} fill={s.color} />;
        })}

        {dividerEnabled && slices.length > 1
          ? Array.from({ length: n }, (_, i) => {
              const ang = -Math.PI / 2 + i * seg;
              const p = polar(cx, cy, r, ang);
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

        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={borderColor}
          strokeWidth={4}
          vectorEffect="non-scaling-stroke"
        />

        {innerCircle ? (
          <circle
            cx={cx}
            cy={cy}
            r={40}
            fill={innerCircleColor}
            stroke={innerCircleBorderColor}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            filter="url(#mioInnerCircleShadowPrev)"
          />
        ) : null}

        {markerType !== "none"
          ? markerAngles.map((ang, idx) => {
              const p = polar(cx, cy, markerRadius, ang);
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

        {labels.map(({ i, bisector, label }) => {
          const rr = r * 0.6; // ~60% of radius for label placement
          const p = polar(cx, cy, rr, bisector);
          const rot = (bisector * 180) / Math.PI - 90;
          const outlineStyle: React.CSSProperties =
            labelOutline?.enabled
              ? {
                  paintOrder: "stroke",
                  stroke: labelOutline.color,
                  strokeWidth: labelOutline.width,
                  strokeOpacity: labelOutline.opacity,
                }
              : {};
          // Wrap long slice labels onto two lines (matches Wheel.tsx behaviour).
          const lines = splitLabelToLines(label, 12);
          return (
            <g
              key={`lbl-${i}`}
              transform={`translate(${p.x}, ${p.y}) rotate(${rot})`}
            >
              <text
                x={0}
                y={0}
                fill={labelColor}
                fontSize={labelFontSizePx}
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
                style={outlineStyle}
              >
                {lines.length === 1 ? (
                  lines[0]
                ) : (
                  <>
                    <tspan x={0} dy="-0.55em">
                      {lines[0]}
                    </tspan>
                    <tspan x={0} dy="1.1em">
                      {lines[1]}
                    </tspan>
                  </>
                )}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
