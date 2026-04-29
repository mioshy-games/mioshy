"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Power, RefreshCw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelJourneyAssignment,
  reactivateJourneyAssignment,
  rematerializeJourneyAssignment,
  deleteJourneyAssignment,
} from "@/app/dashboard/actions/journey-assignments";

export function AssignmentControls({
  assignmentId,
  isActive,
}: {
  assignmentId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "toggle" | "remat" | "delete">(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function toggleActive() {
    setBusy("toggle");
    const res = isActive
      ? await cancelJourneyAssignment(assignmentId)
      : await reactivateJourneyAssignment(assignmentId);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(isActive ? "Assignment cancelled" : "Assignment reactivated");
    router.refresh();
  }

  async function rematerialize() {
    setBusy("remat");
    const res = await rematerializeJourneyAssignment(assignmentId);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Re-materialized — ${res.inserted} new rows`);
    router.refresh();
  }

  async function confirmDelete() {
    setBusy("delete");
    const res = await deleteJourneyAssignment(assignmentId);
    setBusy(null);
    setDeleteOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Assignment deleted");
    router.push("/dashboard/journey/assignments");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void rematerialize()}
        disabled={busy !== null}
      >
        {busy === "remat" ? (
          <Loader2 className="me-1.5 size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="me-1.5 size-3.5" />
        )}
        Re-materialize
      </Button>
      <Button
        type="button"
        variant={isActive ? "outline" : "default"}
        size="sm"
        onClick={() => void toggleActive()}
        disabled={busy !== null}
      >
        {busy === "toggle" ? (
          <Loader2 className="me-1.5 size-3.5 animate-spin" />
        ) : (
          <Power className="me-1.5 size-3.5" />
        )}
        {isActive ? "Cancel assignment" : "Reactivate"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDeleteOpen(true)}
        disabled={busy !== null}
      >
        <Trash2 className="me-1.5 size-3.5" />
        Delete
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete assignment?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This cascades through scheduled rows, completions, and responses.
            For a softer path, cancel instead — cancelled assignments stop
            appearing in the owner&apos;s timeline but keep their history.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy === "delete"}
              onClick={() => void confirmDelete()}
            >
              {busy === "delete" ? (
                <Loader2 className="me-2 size-4 animate-spin" />
              ) : null}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
