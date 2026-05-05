"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X, ChevronDown } from "lucide-react";
import { fitSvgToContainer } from "@/lib/utils";
import { ColorPicker } from "../controls/ColorPicker";
import { SliderControl } from "../controls/SliderControl";
import { SelectControl } from "../controls/SelectControl"; // used for bg type + border style
import { ToggleRow } from "../controls/ToggleRow";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { useWheelFormStore } from "@/lib/store/useWheelFormStore";
import type { BorderStyle, GamePageLayout, WheelSettings } from "@/lib/types/settings";
import { SettingsSection } from "../SettingsSection";
import { cn } from "@/lib/utils";

// ── PointerSvgEditor ──────────────────────────────────────────────────────────

function PointerSvgEditor({
  svgContent,
  svgWidth,
  svgHeight,
  color,
  onSvgChange,
  onWidthChange,
  onHeightChange,
}: {
  svgContent: string;
  svgWidth: number;
  svgHeight: number;
  color: string;
  onSvgChange: (v: string) => void;
  onWidthChange: (v: number) => void;
  onHeightChange: (v: number) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);
  const hasCustom = !!svgContent;

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) onSvgChange(text);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-3 pl-1">

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />

      {/* Current pointer + replace/upload */}
      <div className="flex items-center gap-3">

        {/* Current pointer preview */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">נוכחי</span>
          {hasCustom ? (
            <div
              style={{
                width: svgWidth,
                height: svgHeight,
                color,
                filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))",
              }}
              dangerouslySetInnerHTML={{ __html: fitSvgToContainer(svgContent) }}
            />
          ) : (
            /* Default triangle preview */
            <div
              className="h-0 w-0 border-x-[10px] border-x-transparent border-t-[16px]"
              style={{ borderTopColor: color, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}
            />
          )}
        </div>

        {/* Upload / replace zone */}
        <div
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-3",
            "transition-colors hover:border-primary/60 hover:bg-primary/5 cursor-pointer",
            hasCustom ? "border-border" : "border-border/60",
          )}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4 text-muted-foreground" />
          {hasCustom ? (
            <>
              <span className="text-xs text-foreground font-medium truncate max-w-full">
                {fileName || "SVG מותאם"}
              </span>
              <span className="text-[11px] text-muted-foreground">לחץ להחלפה · גרור קובץ SVG</span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground font-medium">העלה pointer מותאם</span>
              <span className="text-[11px] text-muted-foreground/70">לחץ או גרור קובץ SVG לכאן</span>
            </>
          )}
        </div>

        {/* Clear button - only when custom SVG is loaded */}
        {hasCustom && (
          <button
            type="button"
            onClick={() => { onSvgChange(""); setFileName(""); }}
            className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="חזור ל-pointer ברירת מחדל"
            title="חזור למשולש ברירת מחדל"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Size sliders - only relevant when custom SVG loaded */}
      {hasCustom && (
        <div className="grid grid-cols-2 gap-4">
          <SliderControl
            label="רוחב"
            value={svgWidth}
            min={16}
            max={120}
            step={2}
            unit="px"
            onChange={onWidthChange}
          />
          <SliderControl
            label="גובה"
            value={svgHeight}
            min={16}
            max={120}
            step={2}
            unit="px"
            onChange={onHeightChange}
          />
        </div>
      )}

      {/* Collapsible raw editor */}
      {hasCustom && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowRaw((v) => !v)}
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform", showRaw ? "rotate-180" : "")} />
            עריכת קוד SVG ישירות
          </button>
          {showRaw && (
            <textarea
              rows={4}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" fill="currentColor">...</svg>'
              value={svgContent}
              onChange={(e) => { onSvgChange(e.target.value); setFileName(""); }}
            />
          )}
        </div>
      )}

    </div>
  );
}

const MARKER_TYPE_OPTIONS = [
  { value: "none",     label: "None" },
  { value: "circle",   label: "Circle" },
  { value: "svg_icon", label: "SVG icon" },
];

const BORDER_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "none", label: "None" },
];

const LAYOUT_OPTIONS = [
  { value: "centered", label: "Classic – centered (logo + wheel + button stacked)" },
  { value: "side-by-side", label: "Wide – wheel left, button right (desktop split)" },
];


export function AppearanceTab() {
  const draft = useSettingsStore((s) => s.draftSettings);
  const patch = useSettingsStore((s) => s.patchDraft);
  const setWheelPreview = useWheelFormStore((s) => s.setWheelPreview);

  // Bridge: whenever draft.wheel or draft.border changes, push the relevant
  // fields into useWheelFormStore so WheelPreviewPanel reflects live edits.
  // Slices (from wheel_configs / RHF) are left untouched.
  const w = draft.wheel;
  const b = draft.border;
  useEffect(() => {
    setWheelPreview({
      pointerColor:     w.pointerColor ?? "#ffffff",
      pointerOffsetY:   w.pointerOffsetY ?? 0,
      pointerSvg:       w.pointerSvg,
      pointerSvgWidth:  w.pointerSvgWidth,
      pointerSvgHeight: w.pointerSvgHeight,
      dividerEnabled:         w.divider?.enabled ?? true,
      dividerColor:           w.divider?.color ?? "#ffffff",
      dividerWidth:           w.divider?.width ?? 2,
      innerCircle:            w.innerCircle?.enabled ?? true,
      innerCircleColor:       w.innerCircle?.fillColor ?? "#fafafa",
      innerCircleBorderColor: w.innerCircle?.borderColor ?? "#e5e5e5",
      markerConfig:           (w.markers ?? {}) as Record<string, unknown>,
      // Label rendering
      labelFontSizePx:  w.labelFontSizePx ?? 12,
      labelColor:       w.labelColor ?? "#ffffff",
      labelOutline:     w.labelOutline ?? { enabled: true, color: "#000000", opacity: 0.25, width: 2 },
      labelOrientation: w.labelOrientation ?? "tangential",
      labelRadiusFraction: w.labelRadiusFraction ?? 0.72,
      // Outer border ring (from draft.border, separate from wheel settings)
      outerBorder: b,
    });
  }, [
    w.pointerColor, w.pointerOffsetY, w.pointerSvg, w.pointerSvgWidth, w.pointerSvgHeight,
    w.divider?.enabled, w.divider?.color, w.divider?.width,
    w.innerCircle?.enabled, w.innerCircle?.fillColor, w.innerCircle?.borderColor,
    w.markers,
    w.labelFontSizePx, w.labelColor, w.labelOutline, w.labelOrientation, w.labelRadiusFraction,
    b,
    setWheelPreview,
  ]);

  return (
    <div className="space-y-3 py-2">

      {/* ── Pointer ──────────────────────────────────────────────────── */}
      <SettingsSection title="Pointer" dotClassName="bg-yellow-400" defaultOpen>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ColorPicker
              label="Color"
              value={draft.wheel.pointerColor ?? "#ffffff"}
              onChange={(c) => patch({ wheel: { ...draft.wheel, pointerColor: c } })}
            />
            <SliderControl
              label="Vertical position"
              value={draft.wheel.pointerOffsetY ?? 0}
              min={-50}
              max={10}
              step={1}
              unit="px"
              onChange={(v) => patch({ wheel: { ...draft.wheel, pointerOffsetY: v } })}
            />
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Negative = moves into the wheel · Positive = moves outward
          </p>

          {/* Pointer shape - always visible */}
          <PointerSvgEditor
            svgContent={draft.wheel.pointerSvg ?? ""}
            svgWidth={draft.wheel.pointerSvgWidth ?? 40}
            svgHeight={draft.wheel.pointerSvgHeight ?? 48}
            color={draft.wheel.pointerColor ?? "#ffffff"}
            onSvgChange={(v) => patch({ wheel: { ...draft.wheel, pointerSvg: v || undefined } })}
            onWidthChange={(v) => patch({ wheel: { ...draft.wheel, pointerSvgWidth: v } })}
            onHeightChange={(v) => patch({ wheel: { ...draft.wheel, pointerSvgHeight: v } })}
          />
        </div>
      </SettingsSection>

      {/* ── Wheel Colors ─────────────────────────────────────────────── */}
      <SettingsSection title="Wheel Colors" dotClassName="bg-pink-500" defaultOpen>
        <div className="space-y-4">

          {/* Divider */}
          <ToggleRow
            label="Slice divider"
            description="Lines between wheel slices"
            checked={draft.wheel.divider?.enabled ?? true}
            onCheckedChange={(v) =>
              patch({ wheel: { ...draft.wheel, divider: { ...draft.wheel.divider, enabled: v } } })
            }
            className="mb-2"
          />
          {(draft.wheel.divider?.enabled ?? true) && (
            <div className="grid grid-cols-2 gap-4 pl-1">
              <ColorPicker
                label="Divider color"
                value={draft.wheel.divider?.color ?? "#ffffff"}
                onChange={(c) =>
                  patch({ wheel: { ...draft.wheel, divider: { ...draft.wheel.divider, enabled: draft.wheel.divider?.enabled ?? true, color: c, width: draft.wheel.divider?.width ?? 2 } } })
                }
              />
              <SliderControl
                label="Width"
                value={draft.wheel.divider?.width ?? 2}
                min={1}
                max={12}
                unit="px"
                onChange={(v) =>
                  patch({ wheel: { ...draft.wheel, divider: { ...draft.wheel.divider, enabled: draft.wheel.divider?.enabled ?? true, color: draft.wheel.divider?.color ?? "#ffffff", width: v } } })
                }
              />
            </div>
          )}

          {/* Inner circle */}
          <ToggleRow
            label="Inner circle"
            description="Center circle over the wheel"
            checked={draft.wheel.innerCircle?.enabled ?? true}
            onCheckedChange={(v) =>
              patch({ wheel: { ...draft.wheel, innerCircle: { ...draft.wheel.innerCircle, enabled: v } } })
            }
            className="mb-2"
          />
          {(draft.wheel.innerCircle?.enabled ?? true) && (
            <div className="grid grid-cols-2 gap-4 pl-1">
              <ColorPicker
                label="Fill color"
                value={draft.wheel.innerCircle?.fillColor ?? "#fafafa"}
                onChange={(c) =>
                  patch({ wheel: { ...draft.wheel, innerCircle: { ...draft.wheel.innerCircle, enabled: draft.wheel.innerCircle?.enabled ?? true, fillColor: c, borderColor: draft.wheel.innerCircle?.borderColor ?? "#e5e5e5" } } })
                }
              />
              <ColorPicker
                label="Border color"
                value={draft.wheel.innerCircle?.borderColor ?? "#e5e5e5"}
                onChange={(c) =>
                  patch({ wheel: { ...draft.wheel, innerCircle: { ...draft.wheel.innerCircle, enabled: draft.wheel.innerCircle?.enabled ?? true, fillColor: draft.wheel.innerCircle?.fillColor ?? "#fafafa", borderColor: c } } })
                }
              />
            </div>
          )}

          {/* Markers */}
          <SettingsSection title="Markers" dotClassName="bg-emerald-500" defaultOpen>
            <div className="space-y-4 pt-1">
              <SelectControl
                label="Type"
                value={draft.wheel.markers?.type ?? "none"}
                options={MARKER_TYPE_OPTIONS}
                onChange={(v) =>
                  patch({ wheel: { ...draft.wheel, markers: { ...draft.wheel.markers, type: v as WheelSettings["markers"]["type"] } } })
                }
              />
              {(draft.wheel.markers?.type ?? "none") !== "none" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <ColorPicker
                      label="Color"
                      value={draft.wheel.markers?.color ?? "#ffffff"}
                      onChange={(c) =>
                        patch({ wheel: { ...draft.wheel, markers: { ...draft.wheel.markers, type: draft.wheel.markers?.type ?? "circle", color: c } } })
                      }
                    />
                    <SliderControl
                      label="Size"
                      value={draft.wheel.markers?.size ?? 14}
                      min={4}
                      max={40}
                      unit="px"
                      onChange={(v) =>
                        patch({ wheel: { ...draft.wheel, markers: { ...draft.wheel.markers, type: draft.wheel.markers?.type ?? "circle", size: v } } })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <SliderControl
                      label="Count"
                      value={draft.wheel.markers?.count ?? 0}
                      min={0}
                      max={50}
                      step={1}
                      onChange={(v) =>
                        patch({ wheel: { ...draft.wheel, markers: { ...draft.wheel.markers, type: draft.wheel.markers?.type ?? "circle", count: v } } })
                      }
                    />
                    <SliderControl
                      label="Position"
                      value={draft.wheel.markers?.position ?? 100}
                      min={50}
                      max={120}
                      step={1}
                      unit="%"
                      onChange={(v) =>
                        patch({ wheel: { ...draft.wheel, markers: { ...draft.wheel.markers, type: draft.wheel.markers?.type ?? "circle", position: v } } })
                      }
                    />
                  </div>
                  {draft.wheel.markers?.type === "svg_icon" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">SVG path (d)</label>
                      <input
                        type="text"
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="M10 20L..."
                        value={draft.wheel.markers?.svgPath ?? ""}
                        onChange={(e) =>
                          patch({ wheel: { ...draft.wheel, markers: { ...draft.wheel.markers, type: "svg_icon", svgPath: e.target.value } } })
                        }
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </SettingsSection>

        </div>
      </SettingsSection>

      {/* ── Wheel size & labels ──────────────────────────────────────── */}
      <SettingsSection title="Wheel Size & Labels" dotClassName="bg-sky-500" defaultOpen>
        <div className="space-y-5">
          <SliderControl
            label="Wheel size"
            value={draft.wheel.sizeRem}
            min={14}
            max={40}
            unit="rem"
            onChange={(v) => patch({ wheel: { ...draft.wheel, sizeRem: v, sizeRemMax: v } })}
          />
          <SliderControl
            label="Text position"
            value={draft.wheel.labelRadiusFraction}
            min={0.45}
            max={1}
            step={0.01}
            onChange={(v) => patch({ wheel: { ...draft.wheel, labelRadiusFraction: v } })}
          />
        </div>
      </SettingsSection>

      {/* ── Label text ───────────────────────────────────────────────── */}
      <SettingsSection title="Label Text" dotClassName="bg-amber-500" defaultOpen>
        <div className="space-y-4">

          {/* Font size + color side-by-side */}
          <div className="grid grid-cols-2 gap-4">
            <SliderControl
              label="Font size"
              value={draft.wheel.labelFontSizePx ?? 12}
              min={8}
              max={28}
              unit="px"
              onChange={(v) => patch({ wheel: { ...draft.wheel, labelFontSizePx: v } })}
            />
            <ColorPicker
              label="Text color"
              value={draft.wheel.labelColor ?? "#ffffff"}
              onChange={(c) => patch({ wheel: { ...draft.wheel, labelColor: c } })}
            />
          </div>

          {/* Label orientation — Itzik 2026-05-05.
              Round 9 update: switched from a Base UI Select dropdown
              (which silently failed to fire onChange inside the
              EditGameSidebar's portal context) to two big toggle
              buttons. Two options doesn't justify a dropdown anyway,
              and a native <button> is bulletproof against any
              primitive/portal weirdness.
              "Tangential" (default): text reads along the slice's curve.
              "Radial": text reads from the wheel center outward —
              better for long names. */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Label orientation
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "tangential", label: "Tangential", desc: "Along the slice" },
                  { value: "radial", label: "Radial", desc: "Center → rim" },
                ] as const
              ).map((opt) => {
                const current =
                  (draft.wheel.labelOrientation ?? "tangential") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      patch({
                        wheel: {
                          ...draft.wheel,
                          labelOrientation: opt.value,
                        },
                      });
                    }}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left transition",
                      current
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-accent/30",
                    )}
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-[11px] opacity-70">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outline */}
          <ToggleRow
            label="Text outline"
            description="Stroke around each label for readability"
            checked={draft.wheel.labelOutline?.enabled ?? true}
            onCheckedChange={(v) =>
              patch({ wheel: { ...draft.wheel, labelOutline: { ...draft.wheel.labelOutline, enabled: v } } })
            }
            className="mb-2"
          />
          {(draft.wheel.labelOutline?.enabled ?? true) && (
            <div className="grid grid-cols-2 gap-4 pl-1">
              <ColorPicker
                label="Outline color"
                value={draft.wheel.labelOutline?.color ?? "#000000"}
                onChange={(c) =>
                  patch({ wheel: { ...draft.wheel, labelOutline: {
                    enabled: draft.wheel.labelOutline?.enabled ?? true,
                    color: c,
                    opacity: draft.wheel.labelOutline?.opacity ?? 0.25,
                    width: draft.wheel.labelOutline?.width ?? 2,
                  }}})
                }
              />
              <SliderControl
                label="Width"
                value={draft.wheel.labelOutline?.width ?? 2}
                min={1}
                max={10}
                unit="px"
                onChange={(v) =>
                  patch({ wheel: { ...draft.wheel, labelOutline: {
                    enabled: draft.wheel.labelOutline?.enabled ?? true,
                    color: draft.wheel.labelOutline?.color ?? "#000000",
                    opacity: draft.wheel.labelOutline?.opacity ?? 0.25,
                    width: v,
                  }}})
                }
              />
              <div className="col-span-2">
                <SliderControl
                  label="Opacity"
                  value={draft.wheel.labelOutline?.opacity ?? 0.25}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(v) =>
                    patch({ wheel: { ...draft.wheel, labelOutline: {
                      enabled: draft.wheel.labelOutline?.enabled ?? true,
                      color: draft.wheel.labelOutline?.color ?? "#000000",
                      opacity: v,
                      width: draft.wheel.labelOutline?.width ?? 2,
                    }}})
                  }
                />
              </div>
            </div>
          )}

        </div>
      </SettingsSection>

      {/* ── Page Layout ──────────────────────────────────────────────── */}
      <SettingsSection title="Page Layout" dotClassName="bg-violet-500" defaultOpen>
        <div className="space-y-4">
          <SelectControl
            label="Layout"
            value={draft.layout}
            options={LAYOUT_OPTIONS}
            onChange={(v) => patch({ layout: v as GamePageLayout })}
          />
          <p className="text-xs text-muted-foreground">
            Wide layout splits the screen on desktop (≥ 768 px); both layouts collapse to stacked on mobile.
          </p>
          <SliderControl
            label="Wheel gap"
            value={draft.wheelGapPx ?? 32}
            min={8}
            max={80}
            step={4}
            unit="px"
            onChange={(v) => patch({ wheelGapPx: v })}
          />
          <p className="text-xs text-muted-foreground -mt-2">
            Space above and below the wheel - clears the pointer tip and marker dots.
          </p>
        </div>
      </SettingsSection>

      {/* ── Wheel Border ─────────────────────────────────────────────── */}
      <SettingsSection title="Wheel Border" dotClassName="bg-primary">
        <ToggleRow
          label="Show border"
          description="Outer ring around the wheel"
          checked={draft.border.enabled}
          onCheckedChange={(v) => patch({ border: { ...draft.border, enabled: v } })}
          className="mb-3"
        />

        {draft.border.enabled && (
          <div className="grid grid-cols-2 gap-4 pl-1">
            <ColorPicker
              label="Border color"
              value={draft.border.color}
              onChange={(c) => patch({ border: { ...draft.border, color: c } })}
            />

            <SelectControl
              label="Border style"
              value={draft.border.style}
              options={BORDER_STYLE_OPTIONS}
              onChange={(v) => patch({ border: { ...draft.border, style: v as BorderStyle } })}
            />

            <div className="col-span-2">
              <SliderControl
                label="Thickness"
                value={draft.border.width}
                min={1}
                max={20}
                unit="px"
                onChange={(v) => patch({ border: { ...draft.border, width: v } })}
              />
            </div>

            <div className="col-span-2">
              <SliderControl
                label="Gap from wheel"
                value={typeof draft.border.distance === "number" ? draft.border.distance : 0}
                min={0}
                max={50}
                unit="px"
                onChange={(v) => patch({ border: { ...draft.border, distance: v } })}
              />
            </div>
          </div>
        )}
      </SettingsSection>

    </div>
  );
}
