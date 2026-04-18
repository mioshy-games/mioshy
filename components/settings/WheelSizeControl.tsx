"use client";

import { SliderControl } from "./controls/SliderControl";
import { useSettingsStore } from "@/lib/store/useSettingsStore";

export function WheelSizeControl() {
  const draft = useSettingsStore((s) => s.draftSettings);
  const patch = useSettingsStore((s) => s.patchDraft);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" />
        Wheel (global)
      </h3>
      <p className="text-xs text-muted-foreground">
        Controls the wheel diameter and text position when saved as default / applied globally.
      </p>

      <SliderControl
        label="Wheel size"
        value={draft.wheel.sizeRem}
        min={14}
        max={32}
        unit="rem"
        onChange={(v) => patch({ wheel: { sizeRem: v } })}
      />

      <SliderControl
        label="Text position"
        value={draft.wheel.labelRadiusFraction}
        min={0.45}
        max={0.9}
        step={0.01}
        onChange={(v) => patch({ wheel: { labelRadiusFraction: v } })}
      />
    </div>
  );
}

