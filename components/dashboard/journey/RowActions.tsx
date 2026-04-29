"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteJourneyProgram,
  deleteJourneyCategory,
  deleteJourneyItem,
} from "@/app/dashboard/actions/journey-content";

type Kind = "program" | "category" | "item";

const COPY: Record<
  Kind,
  { title: string; body: string; successMsg: string }
> = {
  program: {
    title: "Delete program?",
    body: "Deleting the program removes its categories and items (via cascade) and any active assignments pointing at it. This cannot be undone.",
    successMsg: "Program deleted",
  },
  category: {
    title: "Delete category?",
    body: "Deleting a category removes all items inside it. If items are still referenced by scheduled rows the deletion will be blocked by the database.",
    successMsg: "Category deleted",
  },
  item: {
    title: "Delete item?",
    body: "Deleting an item removes it from the catalog and cascades to every scheduled row using it. Responses and completions on those rows are deleted as well.",
    successMsg: "Item deleted",
  },
};

export function RowActions({
  kind,
  id,
  editHref,
}: {
  kind: Kind;
  id: string;
  editHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function confirmDelete() {
    setLoading(true);
    const res =
      kind === "program"
        ? await deleteJourneyProgram(id)
        : kind === "category"
          ? await deleteJourneyCategory(id)
          : await deleteJourneyItem(id);
    setLoading(false);
    setOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(COPY[kind].successMsg);
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={editHref}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "inline-flex gap-1.5",
        )}
      >
        <Pencil className="size-3.5" />
        Edit
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Delete"
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY[kind].title}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{COPY[kind].body}</p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={loading}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
