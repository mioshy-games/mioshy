"use client";

// ============================================================
// UnlockEditDialog - nudge a single scheduled item's unlock date,
// or clear the override back to the catalog default. Shows the
// item's default_offset_days so the admin has a mental reference
// for "how far away from the anchor this normally sits".
// ============================================================

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearScheduledItemOverride,
  updateScheduledItemUnlock,
} from "@/app/dashboard/actions/journey-scheduled";

export function UnlockEditDialog({
  open,
  onOpenChange,
  scheduledItemId,
  itemTitle,
  defaultDate,
  defaultOffsetDays,
  defaultAdminNotes,
  hasOverride,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scheduledItemId: string;
  itemTitle: string;
  /** YYYY-MM-DD - matches the <input type="date"> value shape. */
  defaultDate: string;
  defaultOffsetDays: number;
  defaultAdminNotes: string;
  hasOverride: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(defaultDate);
  const [notes, setNotes] = useState(defaultAdminNotes);
  const [saving, startSave] = useTransition();
  const [clearing, setClearing] = useState(false);

  // Reset local state when the dialog re-opens on a different row.
  useEffect(() => {
    if (open) {
      setDate(defaultDate);
      setNotes(defaultAdminNotes);
    }
  }, [open, defaultDate, defaultAdminNotes]);

  const dirty = date !== defaultDate || notes !== defaultAdminNotes;

  function onSave() {
    if (!date) {
      toast.error("Pick a date first");
      return;
    }
    startSave(async () => {
      const res = await updateScheduledItemUnlock({
        scheduledItemId,
        unlockDate: date,
        adminNotes: notes,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Unlock date updated");
      onOpenChange(false);
      router.refresh();
    });
  }

  async function onClear() {
    setClearing(true);
    const res = await clearScheduledItemOverride(scheduledItemId);
    setClearing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Reverted to catalog default");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="line-clamp-1">
            Edit unlock - {itemTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-muted-foreground rounded-md border bg-muted/40 px-3 py-2 text-xs">
            Catalog default offset:{" "}
            <span className="tabular-nums text-foreground">
              {defaultOffsetDays} day{defaultOffsetDays === 1 ? "" : "s"}
            </span>{" "}
            from the assignment anchor.
            {hasOverride ? (
              <>
                {" "}This row is currently{" "}
                <span className="text-foreground">overridden</span> - clearing
                the override will recompute from the anchor.
              </>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Unlock date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <p className="text-muted-foreground text-[11px]">
              The item becomes available to the client at 00:00 UTC on this
              date. Saving here sets a custom unlock that won&apos;t be moved by
              future catalog edits.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Admin notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why this schedule was adjusted - visible only to admins."
            />
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div>
            {hasOverride ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void onClear()}
                disabled={clearing || saving}
              >
                {clearing ? (
                  <Loader2 className="me-2 size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="me-2 size-3.5" />
                )}
                Clear override
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving || clearing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={saving || clearing || !dirty}
            >
              {saving ? (
                <Loader2 className="me-2 size-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
