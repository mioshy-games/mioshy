"use client";

import { SliderControl } from "../controls/SliderControl";
import { SelectControl } from "../controls/SelectControl";
import { ToggleRow } from "../controls/ToggleRow";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import type { EasingType, ShapeType } from "@/lib/types/settings";
import { SettingsSection } from "../SettingsSection";

const EASING_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "ease-in", label: "Ease In (slow start)" },
  { value: "ease-out", label: "Ease Out (slow end)" },
  { value: "ease-in-out", label: "Ease In-Out (smooth)" },
];

const SHAPE_OPTIONS = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "custom", label: "Custom SVG" },
];

export function BehaviorTab() {
  const draft = useSettingsStore((s) => s.draftSettings);
  const patch = useSettingsStore((s) => s.patchDraft);

  return (
    <div className="space-y-3 py-2">
      <SettingsSection title="Motion & Speed" dotClassName="bg-amber-500">
        <div className="space-y-5">
          <SliderControl
            label="Spin speed"
            value={draft.motion.spinSpeed}
            min={1}
            max={10}
            onChange={(v) => patch({ motion: { ...draft.motion, spinSpeed: v } })}
          />

          <SelectControl
            label="Easing type"
            value={draft.motion.easing}
            options={EASING_OPTIONS}
            onChange={(v) => patch({ motion: { ...draft.motion, easing: v as EasingType } })}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Wheel Shape" dotClassName="bg-emerald-500">
        <div className="space-y-4">
          <ToggleRow
            label="Custom shape"
            description="Override the default circle with an alternate shape"
            checked={draft.shape.enabled}
            onCheckedChange={(v) => patch({ shape: { ...draft.shape, enabled: v } })}
          />

          {draft.shape.enabled && (
            <>
              <SelectControl
                label="Shape type"
                value={draft.shape.type}
                options={SHAPE_OPTIONS}
                onChange={(v) => patch({ shape: { ...draft.shape, type: v as ShapeType } })}
              />

              {draft.shape.type === "custom" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Custom SVG markup
                  </label>
                  <textarea
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    placeholder='<svg viewBox="0 0 100 100" ...>...</svg>'
                    value={draft.shape.customSvg ?? ""}
                    onChange={(e) =>
                      patch({ shape: { ...draft.shape, customSvg: e.target.value } })
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
