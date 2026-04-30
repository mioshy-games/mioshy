"use client";

import { useMemo } from "react";
import type { GameSettings } from "@/lib/types/settings";

type Props = {
  settings: GameSettings;
};

export function LivePreview({ settings }: Props) {
  const { border, background, motion, shape, wheel, particles, layout } = settings;

  // ── Background style ────────────────────────────────────────────────────
  const bgStyle = useMemo<React.CSSProperties>(() => {
    if (background.type === "gradient" && background.gradient) {
      return {
        background: `linear-gradient(135deg, ${background.gradient.from}, ${background.gradient.to})`,
      };
    }
    if (background.type === "image" && background.imageUrl) {
      return {
        backgroundImage: `url(${background.imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    return { backgroundColor: background.color };
  }, [background]);

  // ── Outer border ring style ─────────────────────────────────────────────
  const hasBorder = border.enabled && border.style !== "none";

  const borderGapPx = useMemo(() => {
    if (!hasBorder) return 0;
    return typeof border.distance === "number"
      ? border.distance
      : ({ attached: 0, near: 7, far: 20 }[border.distance as string] ?? 0);
  }, [hasBorder, border.distance]);

  const ringStyle = useMemo<React.CSSProperties>(() => {
    if (!hasBorder) return {};
    return {
      outline: `${border.width}px ${border.style} ${border.color}`,
      outlineOffset: `${borderGapPx}px`,
    };
  }, [hasBorder, border.width, border.style, border.color, borderGapPx]);

  // ── Pointer top (mirrors Wheel.tsx logic, includes pointerOffsetY) ────────
  // Pointer is fully independent of the border ring - mirrors Wheel.tsx logic.
  // pointerOffsetY is the sole control (clamped -50…+10 px).
  // 0 = tip at the wheel rim; negative = deeper into wheel; positive = outside.
  const mockPointerH = 14; // height of the ▼ triangle in the mock (px)
  const pointerTop = Math.max(-50, Math.min(10, wheel.pointerOffsetY ?? 0));

  // ── Shape clip ─────────────────────────────────────────────────────────
  const clipPath = useMemo(() => {
    if (shape.type === "square") return "none";
    return "circle(50%)";
  }, [shape.type]);

  const borderRadius = shape.type === "circle" ? "50%" : "8px";

  // ── Speed / label helpers ──────────────────────────────────────────────
  const speedLabel =
    motion.spinSpeed <= 3 ? "Slow" : motion.spinSpeed <= 7 ? "Medium" : "Fast";

  const bgLabel =
    background.type === "gradient"
      ? `Gradient`
      : background.type === "image"
      ? "Image"
      : "Solid";

  const wheelSizeLabel = `${wheel.sizeRem ?? 20}rem`;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Section label */}
      <div className="w-full flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Live Preview
        </span>
        <span className="text-[10px] text-muted-foreground/60 italic">
          updates as you edit
        </span>
      </div>

      {/* Wheel mock ─ 180×180 */}
      <div
        className="relative transition-all duration-300"
        style={{
          ...bgStyle,
          ...ringStyle,
          width: 180,
          height: 180,
          clipPath,
          borderRadius,
        }}
      >
        {/* Fake wheel segments */}
        <svg viewBox="0 0 100 100" className="w-full h-full" style={{ clipPath }}>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle     = (i * 60 * Math.PI) / 180;
            const nextAngle = ((i + 1) * 60 * Math.PI) / 180;
            const x1 = 50 + 45 * Math.cos(angle);
            const y1 = 50 + 45 * Math.sin(angle);
            const x2 = 50 + 45 * Math.cos(nextAngle);
            const y2 = 50 + 45 * Math.sin(nextAngle);
            const colors = ["#f472b6", "#a78bfa", "#60a5fa", "#34d399", "#f59e0b", "#f87171"];
            return (
              <path
                key={i}
                d={`M 50 50 L ${x1} ${y1} A 45 45 0 0 1 ${x2} ${y2} Z`}
                fill={colors[i]}
                opacity={0.9}
              />
            );
          })}
          {/* Center circle */}
          <circle cx="50" cy="50" r="10" fill="white" opacity={0.9} />
          {/* Segment labels */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const midAngle = ((i + 0.5) * 60 * Math.PI) / 180;
            const r = 45 * (wheel.labelRadiusFraction ?? 0.68);
            const x = 50 + r * Math.cos(midAngle);
            const y = 50 + r * Math.sin(midAngle);
            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7"
                fill="white"
                fontWeight="bold"
              >
                Aa
              </text>
            );
          })}
        </svg>

        {/* Pointer - base snaps to border outer edge when border is active */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20"
          style={{ top: pointerTop }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft:  "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop:   `${mockPointerH}px solid white`,
            }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="w-full grid grid-cols-2 gap-2">
        {[
          { label: "Border",   value: border.enabled ? `${border.width}px ${border.style}` : "Off" },
          { label: "Speed",    value: speedLabel },
          { label: "Shape",    value: shape.type.charAt(0).toUpperCase() + shape.type.slice(1) },
          { label: "BG",       value: bgLabel },
          { label: "Size",     value: wheelSizeLabel },
          { label: "Layout",   value: layout === "side-by-side" ? "Wide" : "Centered" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-center"
          >
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </div>
            <div className="text-xs font-semibold text-foreground mt-0.5 truncate">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Particles badge */}
      <div className="w-full flex items-center justify-between text-xs text-muted-foreground border border-border/50 rounded-lg px-3 py-2">
        <span>Particles</span>
        <span className={particles?.enabled ? "text-emerald-400 font-semibold" : "text-rose-400"}>
          {particles?.enabled ? `On · ${particles.count} · ${particles.shape}` : "Off"}
        </span>
      </div>
    </div>
  );
}
