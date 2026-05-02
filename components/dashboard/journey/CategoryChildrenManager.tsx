"use client";

// ============================================================
// CategoryChildrenManager — the two-list drag-reorder UI on the
// category-detail page.
//
// List A: subtopics inside this category. Drag to reorder, click name
//         to edit, click "+ New" to create.
// List B: items inside this category that have NO subtopic (the
//         "direct" group). Items inside subtopics are managed on the
//         subtopic-detail page so each list maps 1:1 to its parent.
//
// Reorder writes go through reorderJourneyChildren() — a single
// server action that rewrites every row's sort_order to multiples of
// 1000 in the new order.
// ============================================================

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  reorderJourneyChildren,
  deleteJourneySubtopic,
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

interface SubtopicRow {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  is_active: boolean;
  item_count: number;
}

interface ItemRow {
  id: string;
  slug: string;
  title_he: string;
  title_en: string | null;
  is_active: boolean;
  default_offset_days: number;
}

export function CategoryChildrenManager({
  categoryId,
  subtopics,
  directItems,
}: {
  categoryId: string;
  subtopics: SubtopicRow[];
  directItems: ItemRow[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <SubtopicsSection
        categoryId={categoryId}
        subtopics={subtopics}
        onChange={() => router.refresh()}
      />
      <DirectItemsSection
        categoryId={categoryId}
        items={directItems}
        onChange={() => router.refresh()}
      />
    </div>
  );
}

function SubtopicsSection({
  categoryId,
  subtopics,
  onChange,
}: {
  categoryId: string;
  subtopics: SubtopicRow[];
  onChange: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<SubtopicRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reorder(orderedIds: string[]) {
    return reorderJourneyChildren({
      parentKind: "category",
      parentId: categoryId,
      childKind: "subtopic",
      orderedIds,
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await deleteJourneySubtopic(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) {
      toast.error(`Delete failed: ${res.error}`);
      return;
    }
    toast.success("Subtopic deleted");
    onChange();
  }

  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="font-semibold">Subtopics</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Drag to reorder. Items inside a subtopic are managed on the subtopic page.
          </p>
        </div>
        <Link
          href={`/dashboard/journey/categories/${categoryId}/subtopics/new`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex gap-1.5",
          )}
        >
          <Plus className="size-3.5" /> New subtopic
        </Link>
      </header>

      <div className="p-3">
        {subtopics.length === 0 ? (
          <div className="text-muted-foreground flex h-20 items-center justify-center text-sm">
            No subtopics yet. Use the "+ New subtopic" button to add one.
          </div>
        ) : (
          <SortableList
            items={subtopics}
            onReorder={reorder}
            renderRow={(s) => (
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/dashboard/journey/categories/${categoryId}/subtopics/${s.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <div className="truncate font-medium">{s.name_he}</div>
                  {s.name_en ? (
                    <div className="text-muted-foreground truncate text-xs">
                      {s.name_en}
                    </div>
                  ) : null}
                </Link>
                <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
                  {s.item_count} {s.item_count === 1 ? "item" : "items"}
                </span>
                <Badge variant={s.is_active ? "default" : "secondary"}>
                  {s.is_active ? "Active" : "Draft"}
                </Badge>
                <Link
                  href={`/dashboard/journey/categories/${categoryId}/subtopics/${s.id}`}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Edit subtopic"
                >
                  <Pencil className="size-4" />
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Delete subtopic"
                  onClick={() => setPendingDelete(s)}
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
            <DialogTitle>Delete subtopic?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Items inside this subtopic will lose their subtopic link and become
            direct-on-category items (their content is preserved). The
            subtopic itself is deleted permanently.
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

function DirectItemsSection({
  categoryId,
  items,
  onChange,
}: {
  categoryId: string;
  items: ItemRow[];
  onChange: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<ItemRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reorder(orderedIds: string[]) {
    return reorderJourneyChildren({
      parentKind: "category",
      parentId: categoryId,
      childKind: "item",
      scope: "direct",
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
    onChange();
  }

  return (
    <section className="bg-card rounded-lg border">
      <header className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="font-semibold">Items directly on this category</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Items without a subtopic. Drag to reorder.
          </p>
        </div>
        <Link
          href={`/dashboard/journey/items/new?category=${categoryId}`}
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
            No direct-on-category items. Items can also be created inside a subtopic.
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
            scheduled row using it. Responses and completions on those rows are
            deleted as well.
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
