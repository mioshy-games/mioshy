"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSettingsStore, selectPresets } from "@/lib/store/useSettingsStore";
import { Wand2, Copy, Layers } from "lucide-react";
import { SettingsSection } from "../SettingsSection";

type Props = {
  onSaveAsPreset?: (name: string, description?: string) => Promise<void>;
  onDuplicateFrom?: (sourceGameId: string) => Promise<void>;
  versionHistory?: { version: number; savedAt: string; label?: string }[];
  onRollback?: (version: number) => Promise<void>;
};

export function AdvancedTab({
  onSaveAsPreset,
  onDuplicateFrom,
  versionHistory = [],
  onRollback,
}: Props) {
  const presets = useSettingsStore(selectPresets);
  const applyPreset = useSettingsStore((s) => s.applyPreset);

  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  const [sourceGameId, setSourceGameId] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);

  async function handleSavePreset() {
    if (!presetName.trim() || !onSaveAsPreset) return;
    setIsSavingPreset(true);
    try {
      await onSaveAsPreset(presetName.trim(), presetDesc.trim() || undefined);
      setPresetName("");
      setPresetDesc("");
    } finally {
      setIsSavingPreset(false);
    }
  }

  async function handleDuplicate() {
    if (!sourceGameId.trim() || !onDuplicateFrom) return;
    setIsDuplicating(true);
    try {
      await onDuplicateFrom(sourceGameId.trim());
      setSourceGameId("");
    } finally {
      setIsDuplicating(false);
    }
  }

  return (
    <div className="space-y-3 py-2">
      <SettingsSection
        title="Presets"
        dotClassName="bg-violet-500"
        defaultOpen={true}
      >
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

        {/* Save as preset */}
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
            onClick={handleSavePreset}
            className="w-full"
          >
            {isSavingPreset ? "Saving…" : "Save as Preset"}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Copy from another game"
        dotClassName="bg-blue-500"
        defaultOpen={false}
      >
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
            onClick={handleDuplicate}
            className="w-full"
          >
            {isDuplicating ? "Copying…" : "Copy Settings"}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Version history"
        dotClassName="bg-rose-500"
        defaultOpen={false}
      >
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
                {onRollback && (
                  <button
                    type="button"
                    className="text-primary hover:underline ml-3 flex-shrink-0"
                    onClick={() => onRollback(v.version)}
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
