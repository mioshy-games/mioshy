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
import { deleteCategory } from "@/app/dashboard/actions/between-us-taxonomy";

export function CategoryActions({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function confirmDelete() {
    setLoading(true);
    const res = await deleteCategory(categoryId);
    setLoading(false);
    setDeleteOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Category deleted");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/dashboard/adults/categories/${categoryId}/edit`}
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
        onClick={() => setDeleteOpen(true)}
        aria-label="Delete"
      >
        <Trash2 className="size-4" />
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Games will lose this category assignment. This cannot be undone.
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
