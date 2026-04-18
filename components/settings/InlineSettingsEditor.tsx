"use client";

import { useEffect, useState } from "react";
import { AppearanceTab } from "./tabs/AppearanceTab";
import { BehaviorTab } from "./tabs/BehaviorTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { LivePreview } from "./LivePreview";
import { SectionGroupContext } from "./SettingsSection";
import { useGameSettings } from "@/hooks/useGameSettings";
import { useSettingsStore } from "@/lib/store/useSettingsStore";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";

export function InlineSettingsEditor({ gameId }: { gameId: string }) {
  const { loadInline, isLoading, versionHistory, rollback, duplicateFrom, savePreset } =
    useGameSettings(gameId);

  // Version counters drive expand / collapse all.
  // Each increment signals all SettingsSection children to open or close.
  const [forceOpenVersion, setForceOpenVersion]   = useState(0);
  const [forceCloseVersion, setForceCloseVersion] = useState(0);

  // Read the live draft for the sticky preview
  const draftSettings = useSettingsStore((s) => s.draftSettings);

  useEffect(() => {
    void loadInline();
  }, [loadInline]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Loading visual settings…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background/60 backdrop-blur overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold">Visual Settings</h2>
          <p className="text-sm text-muted-foreground">
            Appearance, behavior and advanced controls — live preview on the right.
          </p>
        </div>

        {/* Expand / Collapse all */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setForceOpenVersion((v) => v + 1)}
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            פתח הכל
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setForceCloseVersion((v) => v + 1)}
          >
            <ChevronsDownUp className="w-3.5 h-3.5" />
            מזער הכל
          </Button>
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────────────────────── */}
      <div className="flex min-h-0">

        {/* Left column: scrollable settings */}
        <div className="flex-1 min-w-0 overflow-y-auto max-h-[calc(100vh-200px)]">
          <SectionGroupContext.Provider value={{ forceOpenVersion, forceCloseVersion }}>
            <div className="p-5 space-y-3">
              <AppearanceTab />

              <Separator className="my-1" />

              <BehaviorTab />

              <Separator className="my-1" />

              <AdvancedTab
                onSaveAsPreset={savePreset}
                onDuplicateFrom={duplicateFrom}
                versionHistory={versionHistory}
                onRollback={rollback}
              />
            </div>
          </SectionGroupContext.Provider>
        </div>

        {/* Right column: sticky live preview (hidden on small screens) */}
        <div className="hidden xl:block w-72 flex-shrink-0 border-l border-border">
          <div className="sticky top-0 p-4">
            <LivePreview settings={draftSettings} />
          </div>
        </div>

      </div>
    </div>
  );
}
