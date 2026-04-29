"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createAndRedirectNewCategory,
  createAndRedirectNewTag,
} from "@/app/dashboard/actions/between-us-taxonomy";

export function NewTaxonomyButton({ kind }: { kind: "category" | "tag" }) {
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);

  function onClick() {
    if (clicked) return;
    setClicked(true);
    startTransition(async () => {
      try {
        if (kind === "category") await createAndRedirectNewCategory();
        else await createAndRedirectNewTag();
      } catch (err) {
        const msg = (err as Error)?.message ?? "";
        if (msg.includes("NEXT_REDIRECT")) return;
        setClicked(false);
        toast.error(msg || "Could not create");
      }
    });
  }

  const label = kind === "category" ? "New category" : "New tag";

  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      disabled={pending || clicked}
    >
      {pending ? (
        <Loader2 className="me-1 size-4 animate-spin" />
      ) : (
        <Plus className="me-1 size-4" />
      )}
      {label}
    </Button>
  );
}
