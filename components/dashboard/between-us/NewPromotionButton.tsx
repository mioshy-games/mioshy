"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAndRedirectNewPromotion } from "@/app/dashboard/actions/between-us-promotions";

export function NewPromotionButton() {
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);

  function onClick() {
    if (clicked) return;
    setClicked(true);
    startTransition(async () => {
      try {
        await createAndRedirectNewPromotion();
      } catch (err) {
        const msg = (err as Error)?.message ?? "";
        if (msg.includes("NEXT_REDIRECT")) return;
        setClicked(false);
        toast.error(msg || "Could not create");
      }
    });
  }

  return (
    <Button type="button" size="sm" onClick={onClick} disabled={pending || clicked}>
      {pending ? (
        <Loader2 className="me-1 size-4 animate-spin" />
      ) : (
        <Plus className="me-1 size-4" />
      )}
      New promotion
    </Button>
  );
}
