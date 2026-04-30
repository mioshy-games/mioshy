"use client";

import { useEffect, useState } from "react";
import { AppearanceTab } from "./tabs/AppearanceTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { SectionGroupContext } from "./SettingsSection";
import { useGameSettings } from "@/hooks/useGameSettings";
import { Button } from "@/components/ui/button";
import { ChevronsDownUp, ChevronsUpDown, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function InlineSettingsEditor({ gameId }: { gameId: string }) {
  const { loadInline, isLoading } = useGameSettings(gameId);

  // Card-level collapse (whole Wheel appearance card)
  const [cardOpen, setCardOpen] = useState(true);

  // Version counters drive expand / collapse all.
  // Each increment signals all SettingsSection children to open or close.
  const [forceOpenVersion, setForceOpenVersion]   = useState(0);
  const [forceCloseVersion, setForceCloseVersion] = useState(0);

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

  // NOTE: The wheel / live preview used to live in a right column here, but it
  // only stuck inside this card. The page now renders a dedicated EditSidebar
  // that's sticky across the full edit page, so the preview stays visible while
  // the admin scrolls through the form. This component is now a single-column
  // editor card.

  return (
    <div className="rounded-2xl border border-border bg-background/60 backdrop-blur overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {/* Outer div - cannot be a button because it contains Button children  */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">

        {/* Left: click to collapse/expand the whole card */}
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 text-left flex-1"
          onClick={() => setCardOpen((v) => !v)}
          aria-expanded={cardOpen}
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform flex-shrink-0",
              cardOpen ? "rotate-180" : "rotate-0",
            )}
          />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Wheel appearance</h2>
            <p className="text-sm text-muted-foreground">
              צבעי גלגל, גודל, תוויות וגבול - תצוגה מקדימה חיה בצד ימין.
            </p>
          </div>
        </button>

        {/* Right: Expand / Collapse all - only visible when card is open */}
        {cardOpen && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setForceOpenVersion((v) => v + 1)}
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              פתח הכל
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setForceCloseVersion((v) => v + 1)}
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
              מזער הכל
            </Button>
          </div>
        )}
      </div>

      {/* ── Body (single column - preview lives in sticky page sidebar) ────── */}
      {cardOpen && (
        <>
          <div className="border-t border-border" />
          <SectionGroupContext.Provider value={{ forceOpenVersion, forceCloseVersion }}>
            <div className="p-5 space-y-3">
              <AppearanceTab />
              <AdvancedTab />
            </div>
          </SectionGroupContext.Provider>
        </>
      )}
    </div>
  );
}
