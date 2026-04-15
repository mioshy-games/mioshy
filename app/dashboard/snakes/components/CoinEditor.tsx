"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { SnakesConfig } from "./types";
import { updateSnakesConfig } from "@/app/dashboard/actions/snakes";

export function CoinEditor({ cfg }: { cfg: SnakesConfig }) {
  const [heads, setHeads] = useState(String(cfg.coin_heads_steps ?? 3));
  const [tails, setTails] = useState(String(cfg.coin_tails_steps ?? 1));
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <div className="text-sm font-semibold">Heads steps</div>
          <Input value={heads} onChange={(e) => setHeads(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <div className="text-sm font-semibold">Tails steps</div>
          <Input value={tails} onChange={(e) => setTails(e.target.value)} />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        Preview: Heads moves <b>{Number(heads) || 0}</b> steps, Tails moves{" "}
        <b>{Number(tails) || 0}</b> steps.
      </p>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await updateSnakesConfig(cfg.id, {
            coin_heads_steps: Number(heads) || 0,
            coin_tails_steps: Number(tails) || 0,
          });
          setBusy(false);
          if (!res.ok) toast.error(res.error);
          else toast.success("Saved coin rules");
        }}
      >
        Save
      </Button>
    </div>
  );
}

