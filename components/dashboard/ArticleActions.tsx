"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MoreHorizontal, Pencil } from "lucide-react";
import { deleteArticle, toggleArticlePublished } from "@/app/dashboard/actions/articles";

export function ArticleActions({
  articleId,
  isPublished,
}: {
  articleId: string;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [published, setPublished] = useState(isPublished);
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function onToggle(checked: boolean) {
    setLoading(true);
    const res = await toggleArticlePublished(articleId, checked);
    setLoading(false);
    if (res.ok) {
      setPublished(checked);
      toast.success(checked ? "Published" : "Unpublished");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function confirmDelete() {
    setLoading(true);
    const res = await deleteArticle(articleId);
    setLoading(false);
    setDeleteOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Article deleted");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Published</span>
        <Switch
          checked={published}
          disabled={loading}
          onCheckedChange={(v) => void onToggle(v)}
        />
      </div>
      <Link
        href={`/dashboard/articles/${articleId}/edit`}
        className={cn(
          buttonVariants({ variant: "default", size: "sm" }),
          "inline-flex gap-1.5",
        )}
      >
        <Pencil className="size-3.5" />
        עריכה
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            loading && "pointer-events-none opacity-50",
          )}
          disabled={loading}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete article
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete article?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This cannot be undone.
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

