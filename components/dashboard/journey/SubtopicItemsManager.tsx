"use client";

// ============================================================
// SubtopicItemsManager — drag-reorder list of items inside a subtopic.
// Lives on /dashboard/journey/categories/[id]/subtopics/[subId].
// Same shape as the DirectItemsSection in CategoryChildrenManager but
// scoped to subtopic_id = this subtopic.
// ============================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  reorderJourneyChildren,
  deleteJourneyItem,
} from "@/app/dashboard/actions/journey-content";
import { SortableList } from "./SortableList";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ItemRow {
  id: string;
  slug: string;
  title_he: string;
  title_en: string | null;
  is_active: boolean;
  default_offset_days: number;
}

export function SubtopicItemsManager({
  categoryId,
  subtopicId,
  items,
}: {
  categoryId: string;
  subtopicId: string;
  items: ItemRow[];
}) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<ItemRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reorder(orderedIds: string[]) {
    return reorderJourneyChildren({
      parentKind: "subtopic",
      parentId: subtopicId,
      childKind: "item",
      orderedIds,
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await deleteJourneyItem(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) {
      toast.error(`Delete failed: ${res.error}`);
      return;
    }
    toast.success("Item deleted");
    router.refresh();
  }

  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="font-semibold">Items in this subtopic</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Drag to reorder. New items default to this subtopic.
          </p>
        </div>
        <Link
          href={`/dashboard/journey/items/new?category=${categoryId}&subtopic=${subtopicId}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex gap-1.5",
          )}
        >
          <Plus className="size-3.5" /> New item
        </Link>
      </header>

      <div className="p-3">
        {items.length === 0 ? (
          <div className="text-muted-foreground flex h-20 items-center justify-center text-sm">
            No items yet. Click "+ New item" to add one.
          </div>
        ) : (
          <SortableList
            items={items}
            onReorder={reorder}
            renderRow={(it) => (
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/dashboard/journey/items/${it.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <div className="truncate font-medium">{it.title_he}</div>
                  {it.title_en ? (
                    <div className="text-muted-foreground truncate text-xs">
                      {it.title_en}
                    </div>
                  ) : null}
                </Link>
                <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
                  +{it.default_offset_days}d
                </span>
                <Badge variant={it.is_active ? "default" : "secondary"}>
                  {it.is_active ? "Active" : "Draft"}
                </Badge>
                <Link
                  href={`/dashboard/journey/items/${it.id}`}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Edit item"
                >
                  <Pencil className="size-4" />
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Delete item"
                  onClick={() => setPendingDelete(it)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          />
        )}
      </div>

      <Dialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete item?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Deleting an item removes it from the catalog and cascades to every
            scheduled row using it.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
