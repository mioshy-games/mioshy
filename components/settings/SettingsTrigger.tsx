"use client";

/**
 * SettingsTrigger
 *
 * Drop-in button that opens the SettingsPanel for a given game.
 * Handles loading + wires all the async handlers from useGameSettings.
 *
 * Usage:
 *   <SettingsTrigger gameId={game.id} />
 */

import { SettingsPanel } from "./SettingsPanel";
import { useGameSettings } from "@/hooks/useGameSettings";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

type Props = {
  gameId: string;
  /** Optional label override */
  label?: string;
};

export function SettingsTrigger({ gameId, label = "Settings" }: Props) {
  const {
    openPanel,
    panelOpen,
    isLoading,
    save,
  } = useGameSettings(gameId);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={openPanel}
        disabled={isLoading}
      >
        <Settings2 className="w-4 h-4" />
        {isLoading ? "Loading…" : label}
      </Button>

      {panelOpen && (
        <SettingsPanel
          onSave={save}
        />
      )}
    </>
  );
}
