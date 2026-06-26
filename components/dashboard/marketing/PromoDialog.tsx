"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";
import { savePromo } from "@/app/dashboard/actions/subscription-promos";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type PromoRow = {
  id: string;
  name: string;
  code: string | null;
  discount_type: "percent" | "fixed_amount";
  percent: number | null;
  amount_ils: number | null;
  amount_usd: number | null;
  product: "journey" | "games" | "all";
  discounted_charges: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground";

function toLocalDT(iso: string | null): string {
  return iso ? iso.slice(0, 16) : ""; // ISO → YYYY-MM-DDTHH:mm for datetime-local
}

export function PromoDialog({
  promo,
  locale,
  children,
}: {
  promo: PromoRow | null;
  locale: AdminLocale;
  children: React.ReactNode;
}) {
  const tt = (k: string) => t(locale, k);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  const [form, setForm] = useState({
    name: promo?.name ?? "",
    code: promo?.code ?? "",
    discount_type: promo?.discount_type ?? "percent",
    percent: promo?.percent != null ? String(promo.percent) : "",
    amount_ils: promo?.amount_ils != null ? String(promo.amount_ils) : "",
    amount_usd: promo?.amount_usd != null ? String(promo.amount_usd) : "",
    product: promo?.product ?? "journey",
    starts_at: toLocalDT(promo?.starts_at ?? null),
    ends_at: toLocalDT(promo?.ends_at ?? null),
    discounted_charges: promo?.discounted_charges != null ? String(promo.discounted_charges) : "4",
    is_active: promo?.is_active ?? false,
  });
  const set = <K extends keyof typeof form>(k: K, val: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: val }));

  const err = (k: string) => errors[k]?.[0];

  function submit() {
    setErrors({});
    const raw = {
      name: form.name,
      code: form.code,
      discount_type: form.discount_type,
      percent: form.percent === "" ? null : Number(form.percent),
      amount_ils: form.amount_ils === "" ? null : Number(form.amount_ils),
      amount_usd: form.amount_usd === "" ? null : Number(form.amount_usd),
      product: form.product,
      discounted_charges: form.discounted_charges === "" ? 4 : Number(form.discounted_charges),
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      is_active: form.is_active,
    };
    startTransition(async () => {
      const res = await savePromo(promo?.id ?? null, raw);
      if (!res.ok) {
        setErrors(res.error);
        if (res.error._root?.[0]) toast.error(res.error._root[0]);
        return;
      }
      toast.success(tt("promos.saved"));
      setOpen(false);
      router.refresh();
    });
  }

  const isFixed = form.discount_type === "fixed_amount";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir={locale === "he" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{promo ? tt("promos.edit") : tt("promos.new")}</DialogTitle>
        </DialogHeader>

        {err("_root") ? (
          <p className="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
            {err("_root")}
          </p>
        ) : null}

        <div className="grid gap-3">
          <Field label={tt("promos.field.name")} error={err("name")}>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={tt("promos.field.discount_type")}>
              <select className={inputCls} value={form.discount_type} onChange={(e) => set("discount_type", e.target.value as typeof form.discount_type)}>
                <option value="percent">{tt("promos.type.percent")}</option>
                <option value="fixed_amount">{tt("promos.type.fixed")}</option>
              </select>
            </Field>
            <Field label={tt("promos.field.product")}>
              <select className={inputCls} value={form.product} onChange={(e) => set("product", e.target.value as typeof form.product)}>
                <option value="journey">{tt("promos.product.journey")}</option>
                <option value="games">{tt("promos.product.games")}</option>
                <option value="all">{tt("promos.product.all")}</option>
              </select>
            </Field>
          </div>

          {isFixed ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={tt("promos.field.amount_ils")} error={err("amount_ils")}>
                <input type="number" inputMode="decimal" className={inputCls} dir="ltr" value={form.amount_ils} onChange={(e) => set("amount_ils", e.target.value)} />
              </Field>
              <Field label={tt("promos.field.amount_usd")}>
                <input type="number" inputMode="decimal" className={inputCls} dir="ltr" value={form.amount_usd} onChange={(e) => set("amount_usd", e.target.value)} />
              </Field>
            </div>
          ) : (
            <Field label={tt("promos.field.percent")} error={err("percent")}>
              <input type="number" inputMode="decimal" className={inputCls} dir="ltr" value={form.percent} onChange={(e) => set("percent", e.target.value)} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={tt("promos.field.starts_at")} error={err("starts_at")}>
              <input type="datetime-local" className={inputCls} dir="ltr" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
            </Field>
            <Field label={tt("promos.field.ends_at")} error={err("ends_at")}>
              <input type="datetime-local" className={inputCls} dir="ltr" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
            </Field>
          </div>

          <Field label={tt("promos.field.discounted_charges")} error={err("discounted_charges")} hint={tt("promos.field.charges_hint")}>
            <input type="number" inputMode="numeric" className={inputCls} dir="ltr" value={form.discounted_charges} onChange={(e) => set("discounted_charges", e.target.value)} />
          </Field>

          <Field label={tt("promos.field.code")} hint={tt("promos.field.code_hint")}>
            <input className={inputCls} dir="ltr" value={form.code} onChange={(e) => set("code", e.target.value)} />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
            <Label htmlFor="promo-active" className="cursor-pointer text-sm">{tt("promos.field.is_active")}</Label>
            {/* dir="ltr": the switch widget is inline-flex; in a RTL dialog the
                flex origin flips so the thumb starts on the right and the
                translate-x pushes it off-track. Forcing LTR keeps off=left /
                on=right (+ data-checked:bg-primary) — the toggle now reads "on"
                visually. The state itself already toggles (Base UI passes a
                boolean to onCheckedChange). */}
            <Switch id="promo-active" dir="ltr" checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{tt("promos.cancel")}</Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? tt("promos.saving") : tt("promos.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      {error ? <span className="text-[11px] text-rose-500">{error}</span> : null}
    </label>
  );
}
