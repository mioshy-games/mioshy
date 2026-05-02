"use client";

// ============================================================
// GroupSubtopicBinder — slice 7 admin UI for binding a group to
// subtopics with per-row mode (replace | interleave).
//
// Edit-then-save model: changes are local until the admin clicks
// "Save bindings". The action wipes the row set for this group and
// re-inserts (atomic in spirit; see setGroupSubtopicBindings).
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setGroupSubtopicBindings } from "@/app/dashboard/actions/journey-groups";
import { HintIcon } from "@/components/ui/hint-icon";
import type {
  GroupSubtopicBindingRow,
} from "@/lib/journey-content/queries";
import type { JourneyGroupBindingMode } from "@/lib/journey-content/types";

interface SubtopicOption {
  id: string;
  label: string; // "Category · Subtopic"
  category_id: string;
}

interface DraftBinding {
  subtopic_id: string;
  mode: JourneyGroupBindingMode;
}

interface Props {
  groupId: string;
  /** Current persisted bindings (with subtopic + category labels). */
  initialBindings: GroupSubtopicBindingRow[];
  /** Every active subtopic in the catalog, for the picker. */
  subtopicOptions: SubtopicOption[];
}

export function GroupSubtopicBinder({
  groupId,
  initialBindings,
  subtopicOptions,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<DraftBinding[]>(() =>
    initialBindings.map((b) => ({
      subtopic_id: b.subtopic_id,
      mode: b.mode,
    })),
  );
  const [saving, setSaving] = React.useState(false);

  // Sync from server when revalidate brings new initial state.
  const lastIdsRef = React.useRef<string>(
    initialBindings.map((b) => `${b.subtopic_id}:${b.mode}`).join("|"),
  );
  React.useEffect(() => {
    const next = initialBindings
      .map((b) => `${b.subtopic_id}:${b.mode}`)
      .join("|");
    if (next !== lastIdsRef.current) {
      lastIdsRef.current = next;
      setDraft(
        initialBindings.map((b) => ({
          subtopic_id: b.subtopic_id,
          mode: b.mode,
        })),
      );
    }
  }, [initialBindings]);

  const draftIdSet = React.useMemo(
    () => new Set(draft.map((d) => d.subtopic_id)),
    [draft],
  );
  const labelById = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const o of subtopicOptions) m.set(o.id, o.label);
    return m;
  }, [subtopicOptions]);

  // Subtopics not yet bound — feed for the "+ Add binding" picker.
  const availableOptions = subtopicOptions.filter(
    (o) => !draftIdSet.has(o.id),
  );

  const isDirty = React.useMemo(() => {
    if (draft.length !== initialBindings.length) return true;
    const initialMap = new Map(
      initialBindings.map((b) => [b.subtopic_id, b.mode]),
    );
    for (const d of draft) {
      if (initialMap.get(d.subtopic_id) !== d.mode) return true;
    }
    return false;
  }, [draft, initialBindings]);

  function setMode(subtopicId: string, mode: JourneyGroupBindingMode) {
    setDraft((prev) =>
      prev.map((d) => (d.subtopic_id === subtopicId ? { ...d, mode } : d)),
    );
  }

  function remove(subtopicId: string) {
    setDraft((prev) => prev.filter((d) => d.subtopic_id !== subtopicId));
  }

  function addBinding(subtopicId: string) {
    if (draftIdSet.has(subtopicId)) return;
    setDraft((prev) => [
      ...prev,
      { subtopic_id: subtopicId, mode: "interleave" },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    const res = await setGroupSubtopicBindings({
      groupId,
      bindings: draft,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(`Save failed: ${res.error}`);
      return;
    }
    toast.success("Bindings saved");
    router.refresh();
  }

  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center justify-between border-b border-border p-4">
        <div>
          <span className="inline-flex items-center gap-1.5">
            <h2 className="font-semibold">Subtopic bindings</h2>
            <HintIcon topic="group.binding_replace_vs_interleave" />
          </span>
          <p className="text-muted-foreground mt-0.5 text-xs">
            <span className="me-2">
              <strong>Replace</strong>: cadence skips this subtopic for members.
            </span>
            <span>
              <strong>Interleave</strong>: cadence picks normally; pushes are additive.
            </span>
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!isDirty || saving}
          onClick={() => void handleSave()}
        >
          {saving ? <Loader2 className="me-2 size-3.5 animate-spin" /> : null}
          Save bindings
        </Button>
      </header>

      <div className="space-y-3 p-4">
        {draft.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
            No bindings. Use the picker below to bind a subtopic.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {draft.map((d) => (
              <li
                key={d.subtopic_id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0 text-sm">
                  {labelById.get(d.subtopic_id) ?? `(unknown ${d.subtopic_id.slice(0, 8)}…)`}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Select
                    value={d.mode}
                    onValueChange={(v) =>
                      setMode(
                        d.subtopic_id,
                        v as JourneyGroupBindingMode,
                      )
                    }
                  >
                    <SelectTrigger className="h-8 min-w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interleave">Interleave</SelectItem>
                      <SelectItem value="replace">Replace</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove binding"
                    onClick={() => remove(d.subtopic_id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <BindingAdder
          options={availableOptions}
          onAdd={addBinding}
        />
      </div>
    </section>
  );
}

function BindingAdder({
  options,
  onAdd,
}: {
  options: SubtopicOption[];
  onAdd: (subtopicId: string) => void;
}) {
  const [pending, setPending] = React.useState<string>("");
  if (options.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Every active subtopic is already bound.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Select value={pending} onValueChange={setPending}>
        <SelectTrigger className="h-9 min-w-[280px]">
          <SelectValue placeholder="Pick a subtopic to bind…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!pending}
        onClick={() => {
          if (!pending) return;
          onAdd(pending);
          setPending("");
        }}
      >
        <Plus className="me-1 size-3.5" />
        Add binding
      </Button>
    </div>
  );
}
