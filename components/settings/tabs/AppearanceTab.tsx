"use client";

import { ColorPicker } from "../controls/ColorPicker";
import { SliderControl } from "../controls/SliderControl";
import { SelectControl } from "../controls/SelectControl"; // used for bg type + border style
import { ToggleRow } from "../controls/ToggleRow";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import type { BorderStyle, BgType, GamePageLayout, ParticleShape } from "@/lib/types/settings";
import { SettingsSection } from "../SettingsSection";

const BORDER_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "none", label: "None" },
];

const BG_TYPE_OPTIONS = [
  { value: "color", label: "Solid color" },
  { value: "gradient", label: "Gradient" },
  { value: "image", label: "Image URL" },
];

const LAYOUT_OPTIONS = [
  { value: "centered", label: "Classic – centered (logo + wheel + button stacked)" },
  { value: "side-by-side", label: "Wide – wheel left, button right (desktop split)" },
];

const PARTICLE_SHAPE_OPTIONS = [
  { value: "circle",  label: "Circle" },
  { value: "square",  label: "Square" },
  { value: "star",    label: "Star" },
  { value: "diamond", label: "Diamond" },
];

export function AppearanceTab() {
  const draft = useSettingsStore((s) => s.draftSettings);
  const patch = useSettingsStore((s) => s.patchDraft);

  return (
    <div className="space-y-3 py-2">
      {/* ── Wheel size & labels ──────────────────────────────────────── */}
      <SettingsSection title="Wheel Size & Labels" dotClassName="bg-sky-500" defaultOpen>
        <div className="space-y-5">
          <SliderControl
            label="Wheel size"
            value={draft.wheel.sizeRem}
            min={14}
            max={32}
            unit="rem"
            onChange={(v) => patch({ wheel: { ...draft.wheel, sizeRem: v } })}
          />
          <SliderControl
            label="Text position"
            value={draft.wheel.labelRadiusFraction}
            min={0.45}
            max={0.9}
            step={0.01}
            onChange={(v) => patch({ wheel: { ...draft.wheel, labelRadiusFraction: v } })}
          />
        </div>
      </SettingsSection>

      {/* ── Page Layout ──────────────────────────────────────────────── */}
      <SettingsSection title="Page Layout" dotClassName="bg-violet-500" defaultOpen>
        <SelectControl
          label="Layout"
          value={draft.layout}
          options={LAYOUT_OPTIONS}
          onChange={(v) => patch({ layout: v as GamePageLayout })}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Wide layout splits the screen on desktop (≥ 768 px); both layouts collapse to stacked on mobile.
        </p>
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

      {/* ── Floating Particles ───────────────────────────────────────── */}
      <SettingsSection title="Floating Particles" dotClassName="bg-emerald-500">
        <ToggleRow
          label="Enable particles"
          description="Animated dots floating over the background (auto-colored from background)"
          checked={draft.particles?.enabled ?? true}
          onCheckedChange={(v) => patch({ particles: { ...(draft.particles ?? {}), enabled: v } })}
          className="mb-3"
        />

        {(draft.particles?.enabled ?? true) && (
          <div className="space-y-4">
            <SelectControl
              label="Shape"
              value={draft.particles?.shape ?? "circle"}
              options={PARTICLE_SHAPE_OPTIONS}
              onChange={(v) => patch({ particles: { ...(draft.particles ?? {}), shape: v as ParticleShape } })}
            />

            <SliderControl
              label="Count"
              value={draft.particles?.count ?? 18}
              min={5}
              max={30}
              step={1}
              onChange={(v) => patch({ particles: { ...(draft.particles ?? {}), count: v } })}
            />

            <SliderControl
              label="Opacity"
              value={draft.particles?.opacity ?? 0.55}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) => patch({ particles: { ...(draft.particles ?? {}), opacity: v } })}
            />

            <SliderControl
              label="Speed"
              value={draft.particles?.speed ?? 4}
              min={1}
              max={10}
              step={1}
              onChange={(v) => patch({ particles: { ...(draft.particles ?? {}), speed: v } })}
            />

            <div className="grid grid-cols-2 gap-4">
              <SliderControl
                label="Min size"
                value={draft.particles?.sizeMin ?? 4}
                min={2}
                max={16}
                unit="px"
                onChange={(v) => patch({ particles: { ...(draft.particles ?? {}), sizeMin: v } })}
              />
              <SliderControl
                label="Max size"
                value={draft.particles?.sizeMax ?? 12}
                min={4}
                max={28}
                unit="px"
                onChange={(v) => patch({ particles: { ...(draft.particles ?? {}), sizeMax: v } })}
              />
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Game Background" dotClassName="bg-purple-500">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <SelectControl
              label="Background type"
              value={draft.background.type}
              options={BG_TYPE_OPTIONS}
              onChange={(v) => patch({ background: { ...draft.background, type: v as BgType } })}
            />
          </div>

          {draft.background.type === "color" && (
            <div className="col-span-2">
              <ColorPicker
                label="Background color"
                value={draft.background.color}
                onChange={(c) => patch({ background: { ...draft.background, color: c } })}
              />
            </div>
          )}

          {draft.background.type === "gradient" && (
            <>
              <ColorPicker
                label="Gradient from"
                value={draft.background.gradient?.from ?? "#1e1b4b"}
                onChange={(c) =>
                  patch({
                    background: {
                      ...draft.background,
                      gradient: { ...draft.background.gradient, from: c, to: draft.background.gradient?.to ?? "#7c3aed" },
                    },
                  })
                }
              />
              <ColorPicker
                label="Gradient to"
                value={draft.background.gradient?.to ?? "#7c3aed"}
                onChange={(c) =>
                  patch({
                    background: {
                      ...draft.background,
                      gradient: { from: draft.background.gradient?.from ?? "#1e1b4b", to: c },
                    },
                  })
                }
              />
            </>
          )}

          {draft.background.type === "image" && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Image URL
              </label>
              <input
                type="url"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="https://example.com/bg.jpg"
                value={draft.background.imageUrl ?? ""}
                onChange={(e) =>
                  patch({ background: { ...draft.background, imageUrl: e.target.value } })
                }
              />
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
