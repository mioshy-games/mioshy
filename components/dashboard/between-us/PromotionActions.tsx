"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  deletePromotion,
  togglePromotionActive,
} from "@/app/dashboard/actions/between-us-promotions";
import { Switch } from "@/components/ui/switch";

export function PromotionActions({
  promotionId,
  isActive,
}: {
  promotionId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startToggle] = useTransition();

  async function confirmDelete() {
    setLoading(true);
    const res = await deletePromotion(promotionId);
    setLoading(false);
    setDeleteOpen(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Promotion deleted");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Switch
        checked={isActive}
        onCheckedChange={(v) =>
          startToggle(async () => {
            const res = await togglePromotionActive(promotionId, v);
            if (!res.ok) {
              toast.error(res.error);
              return;
            }
            router.refresh();
          })
        }
        aria-label={isActive ? "Deactivate" : "Activate"}
      />
      <Link
        href={`/dashboard/adults/promotions/${promotionId}/edit`}
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
            <DialogTitle>Delete promotion?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Active coupon codes using this promotion will stop working
            immediately. This cannot be undone.
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
