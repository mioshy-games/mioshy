"use client";

// ============================================================
// PropagateConfirmDialog
//
// Shared dialog that previews the fallout of a structural catalog change
// (item added / offset changed / item removed) across every existing
// assignment, then applies the plan on confirm. Used anywhere an admin
// wants to trigger propagation explicitly — usually from an item or
// category page.
//
// API is intentionally narrow: pass an async `loadPlan` that returns a
// PropagationPlan, and an async `onConfirm` that applies it. The dialog
// doesn't know the shape of the specific action — it just renders the
// plan and calls back.
// ============================================================

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { PropagationPlan } from "@/lib/journey-content/propagate";

export interface PropagateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Called when the dialog opens — loads the plan from the server. */
  loadPlan: () => Promise<PropagationPlan>;
  /** Called when admin confirms — executes the plan. */
  onConfirm: () => Promise<void>;
  /** Copy for the confirm button. */
  confirmLabel?: string;
  /** Use destructive styling (red) on the confirm button. */
  destructive?: boolean;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function ownerShort(row: {
  user_id: string | null;
  couple_id: string | null;
}) {
  if (row.couple_id) return `couple · ${row.couple_id.slice(0, 8)}`;
  if (row.user_id) return `user · ${row.user_id.slice(0, 8)}`;
  return "—";
}

export function PropagateConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  loadPlan,
  onConfirm,
  confirmLabel = "Apply",
  destructive = false,
}: PropagateConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PropagationPlan | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPlan(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadPlan()
      .then((p) => {
        if (cancelled) return;
        setPlan(p);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load plan");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // loadPlan identity is intentionally excluded — the caller creates a
    // fresh closure on every render, but we only want to refetch when the
    // dialog is actually opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleConfirm() {
    setApplying(true);
    try {
      await onConfirm();
      toast.success("Propagation applied");
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  const nothingToDo =
    plan !== null &&
    plan.summary.rows_to_insert === 0 &&
    plan.summary.rows_to_update === 0 &&
    plan.summary.rows_to_delete === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Computing changes…
          </div>
        ) : error ? (
          <div className="text-destructive flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4" />
            <span>{error}</span>
          </div>
        ) : plan ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCell
                label="Assignments"
                value={plan.summary.affected_assignments}
              />
              <SummaryCell
                label="Inserts"
                value={plan.summary.rows_to_insert}
              />
              <SummaryCell
                label="Updates"
                value={plan.summary.rows_to_update}
              />
              <SummaryCell
                label="Deletes"
                value={plan.summary.rows_to_delete}
                destructive
              />
            </div>

            {plan.summary.rows_skipped_override > 0 ? (
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <TriangleAlert className="size-3.5" />
                {plan.summary.rows_skipped_override} rows kept their custom
                unlock dates (admin override).
              </p>
            ) : null}

            {plan.preview.length > 0 ? (
              <div className="rounded-md border">
                <ScrollArea className="h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">Owner</th>
                        <th className="px-3 py-2 font-medium">Change</th>
                        <th className="px-3 py-2 font-medium">Unlock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.preview.map((row) => (
                        <tr
                          key={row.assignment_id}
                          className="border-t"
                        >
                          <td className="px-3 py-1.5 font-mono text-xs">
                            {ownerShort(row)}
                          </td>
                          <td className="px-3 py-1.5">
                            <Badge
                              variant={
                                row.change === "delete"
                                  ? "destructive"
                                  : row.change === "update"
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {row.change}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5">
                            {fmtDate(row.unlock_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
                {plan.summary.affected_assignments > plan.preview.length ? (
                  <div className="bg-muted/30 border-t px-3 py-2 text-xs text-muted-foreground">
                    Showing first {plan.preview.length} of{" "}
                    {plan.summary.affected_assignments} affected assignments.
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nothing to propagate — no existing assignments match this
                change.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={applying || loading || nothingToDo}
            onClick={() => void handleConfirm()}
          >
            {applying ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCell({
  label,
  value,
  destructive,
}: {
  label: string;
  value: number;
  destructive?: boolean;
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={`text-lg font-semibold ${destructive && value > 0 ? "text-destructive" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
