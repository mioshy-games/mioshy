"use client";

import { Button } from "@/components/ui/button";
import { useGameSettings } from "@/hooks/useGameSettings";
import { Save } from "lucide-react";

export function FloatingSaveButton({ gameId }: { gameId: string }) {
  const { save, isSaving } = useGameSettings(gameId);

  return (
    <div className="fixed left-4 bottom-4 z-50">
      <Button
        type="button"
        size="lg"
        className="gap-2 shadow-xl"
        onClick={() => void save()}
        disabled={isSaving}
      >
        <Save className="w-4 h-4" />
        {isSaving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}

