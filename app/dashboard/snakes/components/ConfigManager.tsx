"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { SnakesConfig } from "./types";
import { createSnakesConfig, deleteSnakesConfig, setActiveSnakesConfig, updateSnakesConfig } from "@/app/dashboard/actions/snakes";

export function ConfigManager({
  configs,
  selectedId,
  onSelect,
}: {
  configs: SnakesConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => configs.find((c) => c.id === selectedId) ?? null,
    [configs, selectedId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grid gap-1.5">
          <div className="text-sm font-semibold">New config name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Default Couples v2" />
        </div>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await createSnakesConfig(name);
            setBusy(false);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Created config");
              setName("");
            }
          }}
        >
          Create
        </Button>
      </div>

      <div className="grid gap-2">
        {configs.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
              c.id === selectedId ? "bg-accent" : "bg-background"
            }`}
            onClick={() => onSelect(c.id)}
          >
            <div className="min-w-0">
              <div className="truncate font-semibold">{c.name}</div>
              <div className="text-muted-foreground text-xs">
                {c.is_active ? "Active" : c.is_default ? "Default" : "Draft"} • Board {c.board_size}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant={c.is_active ? "secondary" : "default"}
                disabled={busy || c.is_active}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setBusy(true);
                  const res = await setActiveSnakesConfig(c.id);
                  setBusy(false);
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Set active");
                }}
              >
                Active
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const newName = prompt("Rename config", c.name);
                  if (newName == null) return;
                  setBusy(true);
                  const res = await updateSnakesConfig(c.id, { name: newName });
                  setBusy(false);
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Renamed");
                }}
              >
                Rename
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy || c.is_active}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!confirm("Delete this config?")) return;
                  setBusy(true);
                  const res = await deleteSnakesConfig(c.id);
                  setBusy(false);
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Deleted");
                }}
              >
                Delete
              </Button>
            </div>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="text-muted-foreground text-sm">
          Selected: <span className="font-semibold">{selected.name}</span>
        </div>
      ) : null}
    </div>
  );
}

