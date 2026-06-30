"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  pricingFormSchema,
  type PricingFormValues,
  PRICING_PRODUCTS,
} from "@/lib/billing/pricing-validations";
import { saveSubscriptionPrices } from "@/app/dashboard/actions/subscription-prices";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const PRODUCT_LABEL: Record<string, string> = {
  games: "משחקים (Games)",
  journey: "ליווי (Journey)",
};

const CADENCE_LABEL: Record<string, string> = {
  weekly: "שבועי",
  monthly: "חודשי",
  quarterly: "רבעוני",
  yearly: "שנתי",
};

// Precise weeks per cadence — internal math is exact; only the display
// is rounded to whole units.
const WEEKS_PER_CADENCE: Record<string, number> = {
  weekly: 1,
  monthly: 4.345,
  quarterly: 13.04,
  yearly: 52.14,
};

export function PricingForm({
  defaultValues,
}: {
  defaultValues: PricingFormValues;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PricingFormValues>({
    resolver: zodResolver(pricingFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const rows = watch("rows");

  const rowsByProduct = useMemo(() => {
    const map: Record<string, number[]> = {};
    rows.forEach((r, i) => {
      (map[r.product] ??= []).push(i);
    });
    return map;
  }, [rows]);

  // Weekly price is the savings baseline for each product (it's the
  // display unit — stays defined even after weekly is disabled).
  const weeklyBaselineIls = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.cadence === "weekly") map[r.product] = Number(r.price_ils) || 0;
    });
    return map;
  }, [rows]);

  function setDefault(product: string, chosenIndex: number) {
    rows.forEach((r, i) => {
      if (r.product !== product) return;
      const isChosen = i === chosenIndex;
      setValue(`rows.${i}.is_default`, isChosen, { shouldDirty: true });
      // Invariant: the default must be enabled. Auto-enable the row the
      // admin just made default (so the DB CHECK never rejects the save).
      if (isChosen && !r.enabled) {
        setValue(`rows.${i}.enabled`, true, { shouldDirty: true });
      }
    });
  }

  // Toggle "enabled" with the two invariants enforced up-front so the
  // admin gets a clear toast instead of a raw DB rejection:
  //   • can't disable the current default (pick another default first),
  //   • can't disable the last enabled cadence for a product.
  function toggleEnabled(product: string, i: number, next: boolean) {
    if (!next) {
      const row = rows[i];
      if (row.is_default) {
        toast.error("לא ניתן לכבות את ברירת המחדל — בחרו ברירת מחדל אחרת קודם.");
        return;
      }
      const enabledCount = rows.filter(
        (r) => r.product === product && r.enabled,
      ).length;
      if (enabledCount <= 1) {
        toast.error(
          `חייבת להישאר לפחות קדנציה אחת פעילה ל${PRODUCT_LABEL[product]}.`,
        );
        return;
      }
    }
    setValue(`rows.${i}.enabled`, next, { shouldDirty: true });
  }

  async function onSubmit(values: PricingFormValues) {
    setSaving(true);
    try {
      const res = await saveSubscriptionPrices(values);
      // Defensive: the action is contracted to always return { ok, error? },
      // but guard against undefined too (e.g. a swallowed prod throw) so we
      // never crash on res.ok.
      if (!res || !res.ok) {
        const err = (res?.error ?? {}) as Record<string, string[] | undefined>;
        const firstKey = Object.keys(err)[0];
        toast.error(err[firstKey ?? ""]?.[0] ?? "השמירה נכשלה");
        return;
      }
      toast.success("המחירים נשמרו");
      router.refresh();
    } catch {
      toast.error("השמירה נכשלה — נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  const rootError = (errors.rows as { message?: string } | undefined)?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {PRICING_PRODUCTS.map((product) => {
        const indices = rowsByProduct[product] ?? [];
        if (indices.length === 0) return null;
        const baseline = weeklyBaselineIls[product] || 0;
        return (
          <section key={product} className="space-y-4 rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{PRODUCT_LABEL[product]}</h2>
              <Badge variant="secondary">פעיל</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 text-right font-medium">קדנציה</th>
                    <th className="py-2 text-right font-medium">₪ (ILS)</th>
                    <th className="py-2 text-right font-medium">$ (USD)</th>
                    <th className="py-2 text-right font-medium">עלות ליווי ₪</th>
                    <th className="py-2 text-right font-medium">עלות ליווי $</th>
                    <th className="py-2 text-center font-medium">אפקטיבי/שבוע</th>
                    <th className="py-2 text-center font-medium">חיסכון</th>
                    <th className="py-2 text-center font-medium">פעיל</th>
                    <th className="py-2 text-center font-medium">ברירת מחדל</th>
                  </tr>
                </thead>
                <tbody>
                  {indices.map((i) => {
                    const row = rows[i];
                    const weeks = WEEKS_PER_CADENCE[row.cadence] ?? 1;
                    const priceIls = Number(row.price_ils) || 0;
                    const effWeekly = Math.round(priceIls / weeks);
                    const isWeekly = row.cadence === "weekly";
                    // Savings vs the weekly baseline (precise calc, rounded
                    // display). Weekly itself is the baseline → no figure.
                    const savingsPct =
                      !isWeekly && baseline > 0
                        ? Math.round(((baseline - priceIls / weeks) / baseline) * 100)
                        : null;
                    // |saving| ≤ 1% is rounding noise (e.g. monthly with no
                    // real discount) → show a neutral 0%, never red.
                    const savingsNeutral =
                      savingsPct === null || Math.abs(savingsPct) <= 1;
                    const savingsTone = savingsNeutral
                      ? "text-muted-foreground"
                      : savingsPct! > 0
                        ? "text-emerald-600"
                        : "text-rose-600";
                    return (
                      <tr key={row.cadence} className="border-b last:border-0">
                        <td className="py-3 font-medium">
                          {CADENCE_LABEL[row.cadence]}
                          {isWeekly ? (
                            <span className="ms-1 text-[11px] text-muted-foreground">
                              (יחידת תצוגה)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3">
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            inputMode="numeric"
                            className="w-24"
                            {...register(`rows.${i}.price_ils`, {
                              valueAsNumber: true,
                            })}
                          />
                        </td>
                        <td className="py-3">
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            inputMode="numeric"
                            className="w-24"
                            {...register(`rows.${i}.price_usd`, {
                              valueAsNumber: true,
                            })}
                          />
                        </td>
                        {/* Stage-1 coaching add-on cost — journey only. Games
                            rows keep 0 (from defaultValues) and show "—". */}
                        <td className="py-3">
                          {product === "journey" ? (
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              inputMode="numeric"
                              className="w-24"
                              {...register(`rows.${i}.coaching_cost_ils`, {
                                valueAsNumber: true,
                              })}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          {product === "journey" ? (
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              inputMode="numeric"
                              className="w-24"
                              {...register(`rows.${i}.coaching_cost_usd`, {
                                valueAsNumber: true,
                              })}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 text-center text-muted-foreground">
                          ₪{effWeekly}
                        </td>
                        <td className={`py-3 text-center ${savingsTone}`}>
                          {savingsPct === null
                            ? "—"
                            : `${savingsNeutral ? 0 : savingsPct}%`}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={!!watch(`rows.${i}.enabled`)}
                              onCheckedChange={(c) =>
                                toggleEnabled(product, i, c)
                              }
                              aria-label={`הפעלת קדנציה ${CADENCE_LABEL[row.cadence]}`}
                              className="cursor-pointer border border-zinc-300 shadow-sm data-checked:!bg-emerald-500 data-unchecked:!bg-zinc-200 [&_[data-slot=switch-thumb]]:!bg-white"
                            />
                            <span className="w-8 text-start text-xs text-muted-foreground">
                              {watch(`rows.${i}.enabled`) ? "פעיל" : "כבוי"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 text-center">
                          <input
                            type="radio"
                            name={`default-${product}`}
                            checked={!!watch(`rows.${i}.is_default`)}
                            onChange={() => setDefault(product, i)}
                            className="size-4 accent-fuchsia-600"
                            aria-label={`קבע ${CADENCE_LABEL[row.cadence]} כברירת מחדל`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="flex items-center justify-end gap-3">
        <p className="text-muted-foreground me-auto text-xs">
          אפקטיבי/שבוע = מחיר ÷ שבועות-בקדנציה (חודשי 4.345 · רבעוני 13.04 ·
          שנתי 52.14). חיסכון מול המחיר השבועי. הכול מעוגל למספר שלם.
        </p>
        {rootError ? (
          <p className="text-sm text-rose-600">{rootError}</p>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> שומר…
            </>
          ) : (
            "שמירה"
          )}
        </Button>
      </div>
    </form>
  );
}
