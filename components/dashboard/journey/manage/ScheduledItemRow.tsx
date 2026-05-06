"use client";

// ============================================================
// ScheduledItemRow - one line per journey_scheduled_item row on the
// Manage-Client panel. Shows:
//   • status dot (locked / available / completed)
//   • title (linked to the admin item editor)
//   • override pill when the admin has nudged the date
//   • unlock date (click to edit)
//   • remove action
//
// Designed to be scannable: a dense-but-readable row with muted
// ancillary text and a visible cursor on the primary interaction
// (editing the date).
// ============================================================

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteScheduledItem,
  clearScheduledItemOverride,
} from "@/app/dashboard/actions/journey-scheduled";
import { UnlockEditDialog } from "./UnlockEditDialog";
import type {
  JourneyItem,
  JourneyScheduledItem,
  ScheduledItemStatus,
} from "@/lib/journey-content/types";

function toDateInputValue(iso: string) {
  // The <input type="date"> wants YYYY-MM-DD in local interpretation; we
  // slice the ISO so the value matches what the user sees in the row.
  // unlock_at is always stored at start-of-UTC-day so this is safe.
  return iso.slice(0, 10);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatusDot({ status }: { status: ScheduledItemStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3.5" />
      </span>
    );
  }
  if (status === "available") {
    return (
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <Clock className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Lock className="size-3" />
    </span>
  );
}

export function ScheduledItemRow({
  scheduled,
  item,
  status,
  completedAt,
}: {
  // ownerKey is part of the parent's data shape but unused here; keep the
  // type doc-only so future props can land if/when needed.
  ownerKey?: string;
  scheduled: JourneyScheduledItem;
  item: JourneyItem;
  status: ScheduledItemStatus;
  completedAt: string | null;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [clearing, setClearing] = useState(false);

  async function onClearOverride() {
    setClearing(true);
    const res = await clearScheduledItemOverride(scheduled.id);
    setClearing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Reverted to catalog default");
    router.refresh();
  }

  function onDeleteConfirmed() {
    startTransition(async () => {
      const res = await deleteScheduledItem(scheduled.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDeleteOpen(false);
      toast.success("Item removed from timeline");
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
        "hover:bg-muted/50",
        status === "locked" && "opacity-90",
      )}
    >
      {/* Status */}
      <StatusDot status={status} />

      {/* Title + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/journey/items/${item.id}`}
            className="group/title inline-flex max-w-[42ch] items-center gap-1 truncate text-sm font-medium hover:underline"
          >
            <span className="truncate">{item.title_he}</span>
            <ExternalLink className="text-muted-foreground/0 group-hover/title:text-muted-foreground size-3 opacity-0 transition-opacity group-hover/title:opacity-100" />
          </Link>
          {scheduled.has_unlock_override ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Pencil className="size-2.5" />
              custom
            </Badge>
          ) : null}
          {scheduled.admin_notes ? (
            <span
              className="text-muted-foreground max-w-[24ch] truncate text-[11px]"
              title={scheduled.admin_notes}
            >
              · {scheduled.admin_notes}
            </span>
          ) : null}
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-[11px]">
          <span>
            Default offset: <span className="tabular-nums">{item.default_offset_days}d</span>
          </span>
          {status === "completed" && completedAt ? (
            <span>Completed {fmtDate(completedAt)}</span>
          ) : null}
        </div>
      </div>
-
      {/* Unlock date - click to edit */}
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium tabular-nums transition",
          "hover:border-foreground/30 hover:bg-muted",
        )}
        title="Change unlock date"
      >
        <CalendarClock className="size-3.5 text-muted-foreground" />
        {fmtDate(scheduled.unlock_at)}
      </button>
-
      {/* Secondary controls - compact, revealed on hover for less noise */}
      <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        {scheduled.has_unlock_override ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            title="Revert to catalog default"
            disabled={clearing}
            onClick={() => void onClearOverride()}
          >
            {clearing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          title="Remove from timeline"
          onClick={() => setDeleteOpen(true)}
          disabled={pending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Edit dialog */}
      <UnlockEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        scheduledItemId={scheduled.id}
        itemTitle={item.title_he}
        defaultDate={toDateInputValue(scheduled.unlock_at)}
        defaultOffsetDays={item.default_offset_days}
        defaultAdminNotes={scheduled.admin_notes ?? ""}
        hasOverride={scheduled.has_unlock_override}
      />

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove item from timeline?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            “{item.title_he}” will disappear from this client&apos;s timeline. Any
            completion and responses on this scheduled row are deleted too (the
            item itself stays in the catalog).
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDeleteConfirmed}
              disabled={pending}
            >
              {pending ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
