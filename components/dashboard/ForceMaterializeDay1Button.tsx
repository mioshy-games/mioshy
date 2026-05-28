"use client";

// ============================================================
// components/dashboard/ForceMaterializeDay1Button.tsx
//
// Admin one-click recovery: re-fire the day-1 cadence
// materialize for a stuck user. Calls the server action
// `forceMaterializeDay1` and surfaces the exact engine result
// (ok / reason / scheduledItemId) inline so support knows
// whether the user is now unstuck or still failing eligibility.
//
// 2026-05-28 — added per Itzik. Pattern: small inline button +
// status text under it, never an alert/modal — the surrounding
// admin Analysis card already gives the operator context.
// ============================================================

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  forceMaterializeDay1,
  type ForceMaterializeOutcome,
} from "@/app/dashboard/users/[id]/actions";

interface Props {
  userId: string;
}

export function ForceMaterializeDay1Button({ userId }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ForceMaterializeOutcome | null>(null);

  const onClick = () => {
    setResult(null);
    startTransition(async () => {
      const outcome = await forceMaterializeDay1(userId);
      setResult(outcome);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onClick}
          disabled={pending}
          className="gap-1.5"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {pending ? "Materializing…" : "Force day-1"}
        </Button>
        {result ? (
          result.ok ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Materialized
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {result.reason ?? "failed"}
            </Badge>
          )
        ) : null}
        {result?.createdAssignment ? (
          <Badge variant="outline" className="gap-1">
            +assignment
          </Badge>
        ) : null}
      </div>
      {result && !result.ok && result.error ? (
        <p className="text-xs text-muted-foreground">{result.error}</p>
      ) : null}
      {result?.ok && result.scheduledItemId ? (
        <p className="text-xs text-muted-foreground">
          scheduled_item_id: {result.scheduledItemId}
        </p>
      ) : null}
    </div>
  );
}
