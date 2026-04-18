"use client";

import { useMemo, useState, useTransition } from "react";
import { SliderControl } from "@/components/settings/controls/SliderControl";
import { SelectControl } from "@/components/settings/controls/SelectControl";
import { ToggleRow } from "@/components/settings/controls/ToggleRow";
import { ColorPicker } from "@/components/settings/controls/ColorPicker";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import type { GamePageLayout, GameSettings } from "@/lib/types/settings";
import { saveWheelDefaults, type WheelPageDefaults } from "./actions";

const LAYOUT_OPTIONS = [
  { value: "centered", label: "Classic – centered (logo + wheel + button stacked)" },
  { value: "side-by-side", label: "Wide – wheel left, button right (desktop split)" },
];

export function WheelSettingsClient({
  initialDefaults,
}: {
  initialDefaults: WheelPageDefaults;
}) {
  const [wheel, setWheel] = useState<GameSettings["wheel"]>(initialDefaults.wheel);
  const [layout, setLayout] = useState<GamePageLayout>(initialDefaults.layout);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(
    () =>
      layout !== initialDefaults.layout ||
      wheel.sizeRem !== initialDefaults.wheel.sizeRem ||
      wheel.labelRadiusFraction !== initialDefaults.wheel.labelRadiusFraction ||
      JSON.stringify(wheel.centerShadow) !== JSON.stringify(initialDefaults.wheel.centerShadow) ||
      JSON.stringify(wheel.dividerShadow) !== JSON.stringify(initialDefaults.wheel.dividerShadow) ||
      wheel.labelFontSizePx !== initialDefaults.wheel.labelFontSizePx ||
      JSON.stringify(wheel.labelOutline) !== JSON.stringify(initialDefaults.wheel.labelOutline),
    [wheel, layout, initialDefaults],
  );

  return (
    <div className="space-y-6">
      {/* ── Page Layout ─────────────────────────────────────────────── */}
      <SettingsSection title="Default page layout" dotClassName="bg-violet-500" defaultOpen>
        <SelectControl
          label="Layout"
          value={layout}
          options={LAYOUT_OPTIONS}
          onChange={(v) => setLayout(v as GamePageLayout)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Wide layout splits the screen on desktop (≥ 768 px); both layouts stack on mobile.
          Individual games can override this in their own settings.
        </p>
      </SettingsSection>

      {/* ── Size & labels ────────────────────────────────────────────── */}
      <SettingsSection title="Size & labels" dotClassName="bg-sky-500" defaultOpen>
        <div className="space-y-5">
          <SliderControl
            label="Wheel size"
            value={wheel.sizeRem}
            min={14}
            max={32}
            unit="rem"
            onChange={(v) => setWheel((w) => ({ ...w, sizeRem: v }))}
          />
          <SliderControl
            label="Text position"
            value={wheel.labelRadiusFraction}
            min={0.45}
            max={0.9}
            step={0.01}
            onChange={(v) => setWheel((w) => ({ ...w, labelRadiusFraction: v }))}
          />

          <SliderControl
            label="Font size"
            value={wheel.labelFontSizePx}
            min={8}
            max={22}
            unit="px"
            onChange={(v) => setWheel((w) => ({ ...w, labelFontSizePx: v }))}
          />

          <div className="pt-2">
            <ToggleRow
              label="Text outline"
              description="Adds a contour around slice labels for readability"
              checked={wheel.labelOutline.enabled}
              onCheckedChange={(v) =>
                setWheel((w) => ({ ...w, labelOutline: { ...w.labelOutline, enabled: v } }))
              }
            />
            {wheel.labelOutline.enabled ? (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <ColorPicker
                  label="Outline color"
                  value={wheel.labelOutline.color}
                  onChange={(c) =>
                    setWheel((w) => ({ ...w, labelOutline: { ...w.labelOutline, color: c } }))
                  }
                />
                <SliderControl
                  label="Opacity"
                  value={wheel.labelOutline.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) =>
                    setWheel((w) => ({ ...w, labelOutline: { ...w.labelOutline, opacity: v } }))
                  }
                />
                <div className="col-span-2">
                  <SliderControl
                    label="Outline width"
                    value={wheel.labelOutline.width}
                    min={0}
                    max={8}
                    unit="px"
                    onChange={(v) =>
                      setWheel((w) => ({ ...w, labelOutline: { ...w.labelOutline, width: v } }))
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SettingsSection>

      {/* ── Center circle shadow ─────────────────────────────────────── */}
      <SettingsSection title="Center circle shadow" dotClassName="bg-amber-500" defaultOpen={false}>
        <ToggleRow
          label="Enable shadow"
          description="Adds a shadow behind the center circle"
          checked={wheel.centerShadow.enabled}
          onCheckedChange={(v) =>
            setWheel((w) => ({ ...w, centerShadow: { ...w.centerShadow, enabled: v } }))
          }
        />
        {wheel.centerShadow.enabled ? (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <ColorPicker
              label="Shadow color"
              value={wheel.centerShadow.color}
              onChange={(c) =>
                setWheel((w) => ({ ...w, centerShadow: { ...w.centerShadow, color: c } }))
              }
            />
            <SliderControl
              label="Intensity"
              value={wheel.centerShadow.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) =>
                setWheel((w) => ({ ...w, centerShadow: { ...w.centerShadow, opacity: v } }))
              }
            />
            <div className="col-span-2">
              <SliderControl
                label="Blur"
                value={wheel.centerShadow.blur}
                min={0}
                max={20}
                unit="px"
                onChange={(v) =>
                  setWheel((w) => ({ ...w, centerShadow: { ...w.centerShadow, blur: v } }))
                }
              />
            </div>
            <SliderControl
              label="Offset X"
              value={wheel.centerShadow.offsetX}
              min={-20}
              max={20}
              unit="px"
              onChange={(v) =>
                setWheel((w) => ({ ...w, centerShadow: { ...w.centerShadow, offsetX: v } }))
              }
            />
            <SliderControl
              label="Offset Y"
              value={wheel.centerShadow.offsetY}
              min={-20}
              max={20}
              unit="px"
              onChange={(v) =>
                setWheel((w) => ({ ...w, centerShadow: { ...w.centerShadow, offsetY: v } }))
              }
            />
          </div>
        ) : null}
      </SettingsSection>

      {/* ── Divider shadow ───────────────────────────────────────────── */}
      <SettingsSection title="Divider shadow" dotClassName="bg-rose-500" defaultOpen={false}>
        <ToggleRow
          label="Enable shadow"
          description="Adds glow/shadow to the slice divider lines"
          checked={wheel.dividerShadow.enabled}
          onCheckedChange={(v) =>
            setWheel((w) => ({ ...w, dividerShadow: { ...w.dividerShadow, enabled: v } }))
          }
        />
        {wheel.dividerShadow.enabled ? (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <ColorPicker
              label="Shadow color"
              value={wheel.dividerShadow.color}
              onChange={(c) =>
                setWheel((w) => ({ ...w, dividerShadow: { ...w.dividerShadow, color: c } }))
              }
            />
            <SliderControl
              label="Intensity"
              value={wheel.dividerShadow.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) =>
                setWheel((w) => ({ ...w, dividerShadow: { ...w.dividerShadow, opacity: v } }))
              }
            />
            <div className="col-span-2">
              <SliderControl
                label="Blur"
                value={wheel.dividerShadow.blur}
                min={0}
                max={16}
                unit="px"
                onChange={(v) =>
                  setWheel((w) => ({ ...w, dividerShadow: { ...w.dividerShadow, blur: v } }))
                }
              />
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending || !dirty}
          onClick={() => {
            setWheel(initialDefaults.wheel);
            setLayout(initialDefaults.layout);
          }}
        >
          Reset
        </Button>
        <Button
          type="button"
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              await saveWheelDefaults({ wheel, layout });
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
