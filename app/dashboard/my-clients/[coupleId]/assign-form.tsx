"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignContentToCouple } from "@/app/dashboard/actions/experts";
import { Button } from "@/components/ui/button";
import type { SourceOption } from "@/lib/experts/queries";

export function AssignContentForm({
  coupleId,
  sources,
}: {
  coupleId: string;
  sources: SourceOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [sourceKind, setSourceKind] = useState<
    "program" | "category" | "item"
  >("program");
  const [sourceId, setSourceId] = useState("");
  const [notes, setNotes] = useState("");
  const router = useRouter();

  const filtered = sources.filter((s) => s.kind === sourceKind);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!sourceId) {
          toast.error("Pick a program / category / item");
          return;
        }
        startTransition(async () => {
          const res = await assignContentToCouple({
            coupleId,
            sourceKind,
            sourceId,
            notes: notes.trim() || undefined,
          });
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Content assigned");
          setSourceId("");
          setNotes("");
          router.refresh();
        });
      }}
      className="border-border bg-card space-y-3 rounded-lg border p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[160px,1fr]">
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs uppercase tracking-wide">
            Type
          </label>
          <select
            value={sourceKind}
            onChange={(e) => {
              setSourceKind(e.target.value as typeof sourceKind);
              setSourceId("");
            }}
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          >
            <option value="program">Program</option>
            <option value="category">Category</option>
            <option value="item">Single item</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs uppercase tracking-wide">
            {sourceKind === "program"
              ? "Program"
              : sourceKind === "category"
                ? "Category"
                : "Item"}
          </label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            required
          >
            <option value="">- pick a {sourceKind} -</option>
            {filtered.map((s) => (
              <option key={`${s.kind}:${s.id}`} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-muted-foreground text-xs uppercase tracking-wide">
          Notes (optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why did you prescribe this?"
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Anchor: today. Both partners get a synchronized timeline.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Assigning…" : "Assign content"}
        </Button>
      </div>
    </form>
  );
}
