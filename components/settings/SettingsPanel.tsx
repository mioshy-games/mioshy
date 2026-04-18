"use client";

/**
 * SettingsPanel
 *
 * A slide-over sheet that exposes the full game settings UI.
 * Composed of:
 *  • Tabs: Appearance | Behavior | Advanced
 *  • LivePreview (right column on wider screens)
 *  • SavePanel (bottom bar with scope + action buttons)
 *
 * Props are minimal – the panel reads/writes from the Zustand store
 * and takes callbacks for async DB operations.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SavePanel } from "./SavePanel";
import {
  useSettingsStore,
  selectPanelOpen,
  selectIsSaving,
  selectSaveError,
} from "@/lib/store/useSettingsStore";
import { Settings2 } from "lucide-react";

type Props = {
  /** Async save handler – wired to saveSettingsWithScope in the hook */
  onSave: () => Promise<void>;
};

export function SettingsPanel({
  onSave,
}: Props) {
  const panelOpen = useSettingsStore(selectPanelOpen);
  const closePanel = useSettingsStore((s) => s.closePanel);
  const isSaving = useSettingsStore(selectIsSaving);
  const saveError = useSettingsStore(selectSaveError);
  const resetDraft = useSettingsStore((s) => s.resetDraft);

  return (
    <Sheet open={panelOpen} onOpenChange={(open) => !open && closePanel()}>
      <SheetContent
        side="right"
        className="w-full max-w-[460px] p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <Settings2 className="w-4 h-4 text-primary" />
            Save settings
          </SheetTitle>
        </SheetHeader>

        {/* Body: only save scope + wheel size */}
        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-6">
            <p className="text-sm text-muted-foreground">
              Choose where to apply your changes. Wheel settings are managed in{" "}
              <span className="font-medium text-foreground">Dashboard → Settings → Wheel</span>.
            </p>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex-shrink-0">
          <SavePanel
            onSave={onSave}
            onReset={resetDraft}
            isSaving={isSaving}
            saveError={saveError}
            showActions={false}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
