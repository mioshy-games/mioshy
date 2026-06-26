"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { togglePromoActive, deletePromo } from "@/app/dashboard/actions/subscription-promos";
import { PromoDialog, type PromoRow } from "./PromoDialog";

export function PromoRowActions({ promo, locale }: { promo: PromoRow; locale: AdminLocale }) {
  const tt = (k: string) => t(locale, k);
  const router = useRouter();
  const [, startToggle] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    const res = await deletePromo(promo.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(tt("promos.deleted"));
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Native checkbox — always clickable, no Base UI / RTL quirks. */}
      <input
        type="checkbox"
        dir="ltr"
        className="size-4 cursor-pointer accent-primary"
        checked={promo.is_active}
        aria-label={promo.is_active ? tt("promos.deactivate") : tt("promos.activate")}
        onChange={(e) => {
          const v = e.target.checked;
          startToggle(async () => {
            const res = await togglePromoActive(promo.id, v);
            if (!res.ok) { toast.error(res.error); return; }
            router.refresh();
          });
        }}
      />
      <PromoDialog promo={promo} locale={locale}>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Pencil className="size-3.5" />
          {tt("promos.edit")}
        </Button>
      </PromoDialog>
      <Button type="button" variant="ghost" size="icon" aria-label={tt("promos.delete")} onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-4" />
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent dir={locale === "he" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{tt("promos.delete_confirm")}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>{tt("promos.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {tt("promos.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
