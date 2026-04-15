"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { SnakesConfig } from "./types";
import { updateSnakesConfig } from "@/app/dashboard/actions/snakes";

export function PenaltyEditor({ cfg }: { cfg: SnakesConfig }) {
  const [type, setType] = useState<"back5" | "start">(cfg.penalty_type ?? "back5");
  const [steps, setSteps] = useState(String(cfg.penalty_steps ?? 5));
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <div className="text-sm font-semibold">Penalty type</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              type === "back5" ? "bg-foreground text-background" : "bg-background"
            }`}
            onClick={() => setType("back5")}
          >
            Back X steps
          </button>
          <button
            type="button"
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
              type === "start" ? "bg-foreground text-background" : "bg-background"
            }`}
            onClick={() => setType("start")}
          >
            Back to start
          </button>
        </div>
      </div>

      {type === "back5" ? (
        <div className="grid gap-1.5 sm:max-w-xs">
          <div className="text-sm font-semibold">Steps</div>
          <Input value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>
      ) : null}

      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await updateSnakesConfig(cfg.id, {
            penalty_type: type,
            penalty_steps: type === "back5" ? Number(steps) || 0 : 0,
          });
          setBusy(false);
          if (!res.ok) toast.error(res.error);
          else toast.success("Saved penalties");
        }}
      >
        Save
      </Button>
    </div>
  );
}

