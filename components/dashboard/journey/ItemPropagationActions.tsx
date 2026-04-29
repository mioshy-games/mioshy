"use client";

// ============================================================
// Admin controls for propagating item changes into existing timelines.
// Lives on the item edit page as a small card with two buttons:
//   - "Propagate additions" — add this item to assignments that already
//     reference the parent category/program but don't yet include it.
//   - "Propagate offset change" — recompute unlock_at for all existing
//     scheduled rows of this item based on its CURRENT default_offset_days
//     (skipping admin-overridden rows).
// Both open PropagateConfirmDialog with a preview before applying.
// ============================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Clock } from "lucide-react";
import { PropagateConfirmDialog } from "./PropagateConfirmDialog";
import {
  planPropagateItemAddedAction,
  applyPropagateItemAddedAction,
  planPropagateItemOffsetAction,
  applyPropagateItemOffsetAction,
} from "@/app/dashboard/actions/journey-assignments";

export function ItemPropagationActions({
  itemId,
  currentOffsetDays,
}: {
  itemId: string;
  currentOffsetDays: number;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [offsetOpen, setOffsetOpen] = useState(false);

  return (
    <div className="rounded-md border p-4">
      <div className="mb-1 text-sm font-medium">Propagate to existing timelines</div>
      <p className="text-muted-foreground mb-3 text-xs">
        Content edits already flow through automatically. Use these when you
        added this item to the catalog after assignments were created, or
        after changing its unlock offset.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="me-1.5 size-3.5" />
          Add to existing assignments
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOffsetOpen(true)}
        >
          <Clock className="me-1.5 size-3.5" />
          Recompute unlock dates
        </Button>
      </div>

      <PropagateConfirmDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add this item to existing assignments?"
        description="We'll INSERT scheduled rows into every active assignment that already references the parent program/category. Assignments that already have this item are skipped."
        loadPlan={() => planPropagateItemAddedAction(itemId)}
        onConfirm={async () => {
          const res = await applyPropagateItemAddedAction(itemId);
          if (!res.ok) throw new Error(res.error);
        }}
        confirmLabel="Add to timelines"
      />

      <PropagateConfirmDialog
        open={offsetOpen}
        onOpenChange={setOffsetOpen}
        title="Recompute unlock dates?"
        description={`We'll recompute unlock_at for every scheduled row of this item using the CURRENT offset (${currentOffsetDays} day${currentOffsetDays === 1 ? "" : "s"}). Rows with admin-overridden dates are left alone.`}
        loadPlan={() =>
          planPropagateItemOffsetAction(itemId, currentOffsetDays)
        }
        onConfirm={async () => {
          const res = await applyPropagateItemOffsetAction(
            itemId,
            currentOffsetDays,
          );
          if (!res.ok) throw new Error(res.error);
        }}
        confirmLabel="Recompute dates"
      />
    </div>
  );
}
