"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAndRedirectNewGame } from "@/app/dashboard/actions/between-us-games";

export function NewExperienceGameButton() {
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);

  function onClick() {
    if (clicked) return;
    setClicked(true);
    startTransition(async () => {
      try {
        await createAndRedirectNewGame();
        // redirect throws internally; we won't reach here on success
      } catch (err) {
        // Next redirect throws a NEXT_REDIRECT — swallow it silently
        const msg = (err as Error)?.message ?? "";
        if (msg.includes("NEXT_REDIRECT")) return;
        setClicked(false);
        toast.error(msg || "Could not create game");
      }
    });
  }

  return (
    <Button type="button" onClick={onClick} disabled={pending || clicked}>
      {pending ? (
        <Loader2 className="me-1 size-4 animate-spin" />
      ) : (
        <Plus className="me-1 size-4" />
      )}
      New game
    </Button>
  );
}
