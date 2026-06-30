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

export type PromoRow = {
  id: string;
  name: string;
  display_text: string | null;
  cadence: string | null;
  code: string | null;
  discount_type: "percent" | "fixed_amount";
  percent: number | null;
  amount_ils: number | null;
  amount_usd: number | null;
  product: "journey" | "games" | "all";
  /** Stage-1 coaching targeting (migration 149). */
  coaching_scope: "with" | "without" | "all" | null;
  discounted_charges: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground";

// ── Asia/Jerusalem ⇄ UTC, DST-correct via Intl (same approach as the analytics
// page's jerusalemParts). The datetime-local inputs hold Israel wall-clock; the
// DB stores a UTC instant. ─────────────────────────────────────────────────────
const TZ = "Asia/Jerusalem";
const DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const jpartsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});
function jParts(date: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const p = jpartsFmt.formatToParts(date);
  const g = (type: string) => Number(p.find((x) => x.type === type)?.value ?? "0");
  return { y: g("year"), mo: g("month") - 1, d: g("day"), h: g("hour") % 24, mi: g("minute") };
}
const pad2 = (n: number) => String(n).padStart(2, "0");

/** Israel wall-clock "YYYY-MM-DDTHH:mm" → UTC ISO instant (e.g. 18:32 summer → 15:32Z). */
function israelWallToUtcIso(local: string): string {
  const m = DT_RE.exec(local);
  if (!m) return local; // empty/invalid — let zod reject it
  const asUTC = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const p = jParts(new Date(asUTC));
  const tzAsUTC = Date.UTC(p.y, p.mo, p.d, p.h, p.mi);
  const offset = tzAsUTC - asUTC; // Jerusalem offset (ms) at that instant
  return new Date(asUTC - offset).toISOString();
}

/** Stored UTC ISO → Israel wall-clock "YYYY-MM-DDTHH:mm" for the datetime-local input. */
function utcIsoToIsraelWall(iso: string | null): string {
  if (!iso) return "";
  const p = jParts(new Date(iso));
  return `${p.y}-${pad2(p.mo + 1)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.mi)}`;
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
    display_text: promo?.display_text ?? "",
    cadence: promo?.cadence ?? "",
    code: promo?.code ?? "",
    discount_type: promo?.discount_type ?? "percent",
    percent: promo?.percent != null ? String(promo.percent) : "",
    amount_ils: promo?.amount_ils != null ? String(promo.amount_ils) : "",
    amount_usd: promo?.amount_usd != null ? String(promo.amount_usd) : "",
    product: promo?.product ?? "journey",
    coaching_scope: promo?.coaching_scope ?? "all",
    starts_at: utcIsoToIsraelWall(promo?.starts_at ?? null),
    ends_at: utcIsoToIsraelWall(promo?.ends_at ?? null),
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
      display_text: form.display_text,
      cadence: form.cadence,
      code: form.code,
      discount_type: form.discount_type,
      percent: form.percent === "" ? null : Number(form.percent),
      amount_ils: form.amount_ils === "" ? null : Number(form.amount_ils),
      amount_usd: form.amount_usd === "" ? null : Number(form.amount_usd),
      product: form.product,
      coaching_scope: form.coaching_scope,
      discounted_charges: form.discounted_charges === "" ? 4 : Number(form.discounted_charges),
      // Inputs hold Israel wall-clock; persist a UTC instant (DST-correct).
      starts_at: israelWallToUtcIso(form.starts_at),
      ends_at: israelWallToUtcIso(form.ends_at),
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

          <Field label={tt("promos.field.display_text")} hint={tt("promos.field.display_text_hint")}>
            <input className={inputCls} value={form.display_text} onChange={(e) => set("display_text", e.target.value)} />
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

          {/* Cadence restriction (migration 148). Empty value = all plans. */}
          <Field label={tt("promos.field.cadence")}>
            <select className={inputCls} value={form.cadence} onChange={(e) => set("cadence", e.target.value)}>
              <option value="">{tt("promos.cadence.all")}</option>
              <option value="monthly">{tt("promos.cadence.monthly")}</option>
              <option value="quarterly">{tt("promos.cadence.quarterly")}</option>
              <option value="yearly">{tt("promos.cadence.yearly")}</option>
            </select>
          </Field>

          {/* Coaching targeting (migration 149). 'all' = both options. */}
          <Field label={locale === "he" ? "מיקוד ליווי" : "Coaching target"}>
            <select
              className={inputCls}
              value={form.coaching_scope}
              onChange={(e) => set("coaching_scope", e.target.value as typeof form.coaching_scope)}
            >
              <option value="all">{locale === "he" ? "עם וגם בלי ליווי" : "With & without coaching"}</option>
              <option value="with">{locale === "he" ? "רק עם ליווי" : "With coaching only"}</option>
              <option value="without">{locale === "he" ? "רק בלי ליווי" : "Without coaching only"}</option>
            </select>
          </Field>

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
            <Field label={tt("promos.field.starts_at")} error={err("starts_at")} hint={tt("af.controls.israel_time")}>
              <input type="datetime-local" className={inputCls} dir="ltr" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
            </Field>
            <Field label={tt("promos.field.ends_at")} error={err("ends_at")} hint={tt("af.controls.israel_time")}>
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
            {/* Native checkbox — always clickable (label toggles it too), no
                Base UI Switch / RTL quirks. */}
            <input
              id="promo-active"
              type="checkbox"
              dir="ltr"
              className="size-4 cursor-pointer accent-primary"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
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
