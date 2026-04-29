"use client";

/**
 * PageDesignEditor
 *
 * Contains the visual settings that affect the *page* rather than the wheel
 * itself: background, floating particles, motion/speed, wheel shape, presets
 * and version history.
 *
 * Sits between "Game info" and "SEO" in the edit-game form so the admin
 * encounters it in a natural top-to-bottom reading order:
 *   Wheel Design → Slices & categories → Game info → Page & Background → SEO → Questions
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wand2, Copy, Layers } from "lucide-react";
import { useSettingsStore, selectPresets } from "@/lib/store/useSettingsStore";
import { useGameSettings } from "@/hooks/useGameSettings";
import { SettingsSection } from "./SettingsSection";
import { ColorPicker } from "./controls/ColorPicker";
import { SliderControl } from "./controls/SliderControl";
import { SelectControl } from "./controls/SelectControl";
import { ToggleRow } from "./controls/ToggleRow";
import type {
  BgType,
  EasingType,
  ParticleShape,
  ShapeType,
} from "@/lib/types/settings";

// ── Constants ──────────────────────────────────────────────────────────────────

const BG_TYPE_OPTIONS = [
  { value: "color",    label: "Solid color" },
  { value: "gradient", label: "Gradient" },
  { value: "image",    label: "Image URL" },
];

const PARTICLE_SHAPE_OPTIONS = [
  { value: "circle",  label: "Circle" },
  { value: "square",  label: "Square" },
  { value: "star",    label: "Star" },
  { value: "diamond", label: "Diamond" },
];

const EASING_OPTIONS = [
  { value: "linear",       label: "Linear" },
  { value: "ease-in",      label: "Ease In (slow start)" },
  { value: "ease-out",     label: "Ease Out (slow end)" },
  { value: "ease-in-out",  label: "Ease In-Out (smooth)" },
];

const SHAPE_OPTIONS = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "custom", label: "Custom SVG" },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function PageDesignEditor({ gameId }: { gameId: string }) {
  const draft   = useSettingsStore((s) => s.draftSettings);
  const patch   = useSettingsStore((s) => s.patchDraft);
  const presets = useSettingsStore(selectPresets);
  const applyPreset = useSettingsStore((s) => s.applyPreset);

  const { savePreset, duplicateFrom, versionHistory, rollback } =
    useGameSettings(gameId);

  const [presetName,    setPresetName]    = useState("");
  const [presetDesc,    setPresetDesc]    = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [sourceGameId,  setSourceGameId]  = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);

  async function handleSavePreset() {
    if (!presetName.trim() || !savePreset) return;
    setIsSavingPreset(true);
    try {
      await savePreset(presetName.trim(), presetDesc.trim() || undefined);
      setPresetName("");
      setPresetDesc("");
    } finally {
      setIsSavingPreset(false);
    }
  }

  async function handleDuplicate() {
    if (!sourceGameId.trim() || !duplicateFrom) return;
    setIsDuplicating(true);
    try {
      await duplicateFrom(sourceGameId.trim());
      setSourceGameId("");
    } finally {
      setIsDuplicating(false);
    }
  }

  return (
    <div className="space-y-3">

      {/* ── Game Background ──────────────────────────────────────────────── */}
      <SettingsSection title="Game Background" dotClassName="bg-purple-500" defaultOpen>
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
                      gradient: {
                        ...draft.background.gradient,
                        from: c,
                        to: draft.background.gradient?.to ?? "#7c3aed",
                      },
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
                      gradient: {
                        from: draft.background.gradient?.from ?? "#1e1b4b",
                        to: c,
                      },
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

      {/* ── Floating Particles ───────────────────────────────────────────── */}
      <SettingsSection title="Floating Particles" dotClassName="bg-emerald-500">
        <ToggleRow
          label="Enable particles"
          description="Animated dots floating over the background (auto-colored from background)"
          checked={draft.particles?.enabled ?? true}
          onCheckedChange={(v) =>
            patch({ particles: { ...(draft.particles ?? {}), enabled: v } })
          }
          className="mb-3"
        />

        {(draft.particles?.enabled ?? true) && (
          <div className="space-y-4">
            <SelectControl
              label="Shape"
              value={draft.particles?.shape ?? "circle"}
              options={PARTICLE_SHAPE_OPTIONS}
              onChange={(v) =>
                patch({ particles: { ...(draft.particles ?? {}), shape: v as ParticleShape } })
              }
            />

            <SliderControl
              label="Count"
              value={draft.particles?.count ?? 18}
              min={5}
              max={30}
              step={1}
              onChange={(v) =>
                patch({ particles: { ...(draft.particles ?? {}), count: v } })
              }
            />

            <SliderControl
              label="Opacity"
              value={draft.particles?.opacity ?? 0.55}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) =>
                patch({ particles: { ...(draft.particles ?? {}), opacity: v } })
              }
            />

            <SliderControl
              label="Speed"
              value={draft.particles?.speed ?? 4}
              min={1}
              max={10}
              step={1}
              onChange={(v) =>
                patch({ particles: { ...(draft.particles ?? {}), speed: v } })
              }
            />

            <div className="grid grid-cols-2 gap-4">
              <SliderControl
                label="Min size"
                value={draft.particles?.sizeMin ?? 4}
                min={2}
                max={16}
                unit="px"
                onChange={(v) =>
                  patch({ particles: { ...(draft.particles ?? {}), sizeMin: v } })
                }
              />
              <SliderControl
                label="Max size"
                value={draft.particles?.sizeMax ?? 12}
                min={4}
                max={28}
                unit="px"
                onChange={(v) =>
                  patch({ particles: { ...(draft.particles ?? {}), sizeMax: v } })
                }
              />
            </div>
          </div>
        )}
      </SettingsSection>

      {/* ── Motion & Speed ───────────────────────────────────────────────── */}
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

      {/* ── Wheel Shape ──────────────────────────────────────────────────── */}
      <SettingsSection title="Wheel Shape" dotClassName="bg-sky-500">
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

      {/* ── Presets ──────────────────────────────────────────────────────── */}
      <SettingsSection title="Presets" dotClassName="bg-violet-500" defaultOpen={false}>
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Wand2 className="w-4 h-4 text-violet-500" />
          <span>Apply a Preset</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left group"
            >
              <div>
                <div className="text-sm font-medium flex items-center gap-1.5">
                  {preset.name}
                  {preset.isBuiltIn && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1">
                      Built-in
                    </Badge>
                  )}
                </div>
                {preset.description && (
                  <div className="text-xs text-muted-foreground">{preset.description}</div>
                )}
              </div>
              <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Apply →
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-2 mt-4">
          <Label className="text-xs font-medium text-muted-foreground">
            Save current settings as a new preset
          </Label>
          <Input
            placeholder="Preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            placeholder="Description (optional)"
            value={presetDesc}
            onChange={(e) => setPresetDesc(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!presetName.trim() || isSavingPreset}
            onClick={() => void handleSavePreset()}
            className="w-full"
          >
            {isSavingPreset ? "Saving…" : "Save as Preset"}
          </Button>
        </div>
      </SettingsSection>

      {/* ── Copy from another game ───────────────────────────────────────── */}
      <SettingsSection title="Copy from another game" dotClassName="bg-blue-500" defaultOpen={false}>
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Copy className="w-4 h-4 text-blue-500" />
          <span>Copy Settings from Another Game</span>
        </div>
        <div className="space-y-2">
          <Input
            placeholder="Source game ID"
            value={sourceGameId}
            onChange={(e) => setSourceGameId(e.target.value)}
            className="h-8 text-sm font-mono"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!sourceGameId.trim() || isDuplicating}
            onClick={() => void handleDuplicate()}
            className="w-full"
          >
            {isDuplicating ? "Copying…" : "Copy Settings"}
          </Button>
        </div>
      </SettingsSection>

      {/* ── Version history ──────────────────────────────────────────────── */}
      <SettingsSection title="Version history" dotClassName="bg-rose-500" defaultOpen={false}>
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Layers className="w-4 h-4 text-rose-500" />
          <span>Version History</span>
        </div>

        {versionHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No saved versions yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {[...versionHistory].reverse().map((v) => (
              <div
                key={v.version}
                className="flex items-center justify-between text-xs rounded-md border border-border px-2.5 py-1.5"
              >
                <div>
                  <span className="font-medium">{v.label ?? "Saved"}</span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(v.savedAt).toLocaleString()}
                  </span>
                </div>
                {rollback && (
                  <button
                    type="button"
                    className="text-primary hover:underline ml-3 flex-shrink-0"
                    onClick={() => void rollback(v.version)}
                  >
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

    </div>
  );
}
