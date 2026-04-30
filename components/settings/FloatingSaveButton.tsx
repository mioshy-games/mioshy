"use client";

/**
 * FloatingSaveButton
 *
 * This button is bolted to the bottom-left of the Edit Game page and ONLY
 * saves the visual settings draft in `useSettingsStore` (the
 * `InlineSettingsEditor` card - appearance, motion, particles, layout, etc.).
 *
 * It does **not** save anything owned by the main GameForm - game name, slug,
 * slices, categories, background, SEO fields, or questions. Those have their
 * own "Save game" button at the bottom of the form.
 *
 * Historically this was labelled just "Save", which led admins to click it and
 * then wonder why their name-change or slice-edit vanished on refresh. The
 * label now spells out the scope; the tooltip and aria-label reinforce it.
 */

import { Button } from "@/components/ui/button";
import { useGameSettings } from "@/hooks/useGameSettings";
import { Save } from "lucide-react";
import { toast } from "sonner";

export function FloatingSaveButton({ gameId }: { gameId: string }) {
  const { save, isSaving } = useGameSettings(gameId);

  async function onClick() {
    console.log("[FloatingSaveButton] ▶ saving visual settings only (not the form)");
    try {
      await save();
      console.log("[FloatingSaveButton] ✓ visual settings saved");
      toast.success("Visual settings saved");
    } catch (err) {
      console.error("[FloatingSaveButton] ✗ save failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save visual settings",
      );
    }
  }

  return (
    <div
      className="fixed left-4 bottom-4 z-50"
      title="Saves only the Visual Settings card. Game name / slices / SEO live on the main form - use its own 'Save game' button."
    >
      <Button
        type="button"
        size="lg"
        className="gap-2 shadow-xl"
        onClick={() => void onClick()}
        disabled={isSaving}
        aria-label="Save visual settings only (not the main game form)"
      >
        <Save className="w-4 h-4" />
        {isSaving ? "Saving…" : "Save visual settings"}
      </Button>
    </div>
  );
}
