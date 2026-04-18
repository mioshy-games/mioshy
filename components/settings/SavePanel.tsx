"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore, selectScope } from "@/lib/store/useSettingsStore";
import type { GameSettings } from "@/lib/types/settings";
import { Save, RotateCcw } from "lucide-react";

const FIELD_LABELS: { key: keyof GameSettings; label: string }[] = [
  { key: "border", label: "Border" },
  { key: "background", label: "Background" },
  { key: "motion", label: "Motion & Speed" },
  { key: "shape", label: "Shape" },
];

type Props = {
  onSave: () => Promise<void>;
  onReset: () => void;
  isSaving: boolean;
  saveError: string | null;
  /** When false, only render the "Save to" scope controls (no action buttons). */
  showActions?: boolean;
};

export function SavePanel({
  onSave,
  onReset,
  isSaving,
  saveError,
  showActions = true,
}: Props) {
  const scope = useSettingsStore(selectScope);
  const setScope = useSettingsStore((s) => s.setScope);
  const toggleField = useSettingsStore((s) => s.toggleScopeField);

  return (
    <div className="border-t border-border bg-muted/30 p-4 space-y-4">
      {/* ── Scope checkboxes ──────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Save to
        </p>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={scope.currentGameOnly}
              onChange={(e) =>
                setScope({ currentGameOnly: e.target.checked })
              }
            />
            <span className="text-sm">Current game only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={scope.allExistingGames}
              onChange={(e) =>
                setScope({ allExistingGames: e.target.checked })
              }
            />
            <span className="text-sm">All existing games</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              checked={scope.saveAsDefault}
              onChange={(e) =>
                setScope({ saveAsDefault: e.target.checked })
              }
            />
            <span className="text-sm">Save as default (new games)</span>
          </label>
        </div>
      </div>

      {/* ── Field selection (only visible when "all existing" is checked) ── */}
      {scope.allExistingGames && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Apply only these fields globally
            <span className="ml-1 font-normal normal-case">(empty = all)</span>
          </p>

          <div className="grid grid-cols-2 gap-1.5">
            {FIELD_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={scope.selectedFields.includes(key)}
                  onChange={() => toggleField(key)}
                />
                <span className="text-xs">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {saveError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {saveError}
        </p>
      )}

      {/* ── Action buttons ────────────────────────────────────────────── */}
      {showActions && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={onReset}
            disabled={isSaving}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>

          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={onSave}
            disabled={isSaving}
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
