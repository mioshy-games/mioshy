"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  promotionSchema,
  type PromotionFormValues,
} from "@/lib/between-us/validations";
import { savePromotion } from "@/app/dashboard/actions/between-us-promotions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPE_OPTIONS: { value: PromotionFormValues["type"]; label: string; hint: string }[] = [
  {
    value: "buy_x_get_y",
    label: "Buy X Get Y",
    hint: "Bundle: purchase X games to unlock Y free",
  },
  {
    value: "percent_off",
    label: "Percent off",
    hint: "Discount a % off the total",
  },
  {
    value: "amount_off",
    label: "Amount off",
    hint: "Flat currency amount off the total",
  },
];

const SCOPE_OPTIONS: { value: PromotionFormValues["applies_to_scope"]; label: string }[] = [
  { value: "between_us", label: "Adults Only (couples games)" },
  { value: "wheel", label: "Wheel" },
  { value: "snakes", label: "Snakes" },
  { value: "all", label: "All sections" },
];

export function PromotionForm({
  promotionId,
  defaultValues,
}: {
  promotionId: string | null;
  defaultValues: PromotionFormValues;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const methods = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { register, watch, setValue, handleSubmit, formState } = methods;

  async function onSubmit(values: PromotionFormValues) {
    setSaving(true);
    const res = await savePromotion(promotionId, values);
    setSaving(false);
    if (!res.ok) {
      const firstField = Object.keys(res.error ?? {})[0];
      const firstMsg =
        (res.error as Record<string, string[] | undefined>)?.[firstField ?? ""]?.[0] ??
        "Save failed";
      toast.error(firstMsg);
      return;
    }
    toast.success("Saved");
    if (!promotionId) {
      router.push(`/dashboard/adults/promotions/${res.id}/edit`);
    }
    router.refresh();
  }

  const type = watch("type");
  const isBuyGet = type === "buy_x_get_y";
  const isPercent = type === "percent_off";
  const isAmount = type === "amount_off";

  return (
    <FormProvider {...methods}>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)(e);
        }}
      >
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={watch("is_active")}
              onCheckedChange={(v) =>
                setValue("is_active", v, { shouldDirty: true })
              }
              id="is_active"
            />
            <Label htmlFor="is_active" className="cursor-pointer text-sm">
              {watch("is_active") ? "Active" : "Draft"}
            </Label>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {formState.isDirty ? "• unsaved" : "• saved"}
            </span>
          </div>
          <Button
            type="submit"
            disabled={saving}
            size="sm"
            className="min-w-[110px]"
          >
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>

        {/* Identity */}
        <section className="bg-card space-y-4 rounded-lg border p-5">
          <header className="flex items-baseline justify-between gap-3 border-b pb-2">
            <h2 className="text-base font-semibold">Identity</h2>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code (optional)" hint="Leave blank for automatic" className="sm:col-span-2">
              <Input
                {...register("code")}
                className="font-mono"
                placeholder="HONEYMOON10"
              />
            </Field>
            <Field label="Name (HE)">
              <Input
                {...register("name_he")}
                dir="rtl"
                placeholder="מבצע ירח דבש"
              />
            </Field>
            <Field label="Name (EN)">
              <Input {...register("name_en")} placeholder="Honeymoon promo" />
            </Field>

            <Field label="Description (HE)">
              <Textarea
                {...register("description_he")}
                dir="rtl"
                rows={2}
                placeholder="תיאור קצר שמופיע ללקוחות"
              />
            </Field>
            <Field label="Description (EN)">
              <Textarea
                {...register("description_en")}
                rows={2}
                placeholder="Short description shown to customers"
              />
            </Field>
          </div>
        </section>

        {/* Mechanics */}
        <section className="bg-card space-y-4 rounded-lg border p-5">
          <header className="flex items-baseline justify-between gap-3 border-b pb-2">
            <h2 className="text-base font-semibold">Mechanics</h2>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" className="sm:col-span-2">
              <Select
                value={type}
                onValueChange={(v) =>
                  setValue("type", v as PromotionFormValues["type"], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose promotion type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{o.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {o.hint}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {isBuyGet ? (
              <>
                <Field label="Buy quantity" hint="How many to purchase">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    {...register("buy_qty", { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Get quantity" hint="How many free">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    {...register("get_qty", { valueAsNumber: true })}
                  />
                </Field>
                <Field
                  label="Max tiers"
                  hint="1 = no stacking, 2+ = repeat deal"
                  className="sm:col-span-2"
                >
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    {...register("max_tiers", { valueAsNumber: true })}
                  />
                </Field>
              </>
            ) : isPercent ? (
              <Field
                label="Percent off"
                hint="Stored in get_qty (1–100)"
                className="sm:col-span-2"
              >
                <Input
                  type="number"
                  min={1}
                  max={100}
                  {...register("get_qty", { valueAsNumber: true })}
                />
              </Field>
            ) : isAmount ? (
              <Field
                label="Amount off"
                hint="Stored in get_qty (currency units)"
                className="sm:col-span-2"
              >
                <Input
                  type="number"
                  min={0}
                  max={9999}
                  {...register("get_qty", { valueAsNumber: true })}
                />
              </Field>
            ) : null}
          </div>
        </section>

        {/* Scope & window */}
        <section className="bg-card space-y-4 rounded-lg border p-5">
          <header className="flex items-baseline justify-between gap-3 border-b pb-2">
            <h2 className="text-base font-semibold">Scope &amp; window</h2>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Applies to" className="sm:col-span-2">
              <Select
                value={watch("applies_to_scope")}
                onValueChange={(v) =>
                  setValue(
                    "applies_to_scope",
                    v as PromotionFormValues["applies_to_scope"],
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Starts at" hint="Empty = available immediately">
              <Input
                type="datetime-local"
                value={toLocalInput(watch("starts_at"))}
                onChange={(e) =>
                  setValue(
                    "starts_at",
                    fromLocalInput(e.target.value),
                    { shouldDirty: true },
                  )
                }
              />
            </Field>
            <Field label="Ends at" hint="Empty = never expires">
              <Input
                type="datetime-local"
                value={toLocalInput(watch("ends_at"))}
                onChange={(e) =>
                  setValue(
                    "ends_at",
                    fromLocalInput(e.target.value),
                    { shouldDirty: true },
                  )
                }
              />
            </Field>

            <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
              <div>
                <Label className="text-sm">Allow stacking</Label>
                <p className="text-muted-foreground text-xs">
                  Allow this promotion to combine with others in the same cart
                </p>
              </div>
              <Switch
                checked={watch("stacking_allowed")}
                onCheckedChange={(v) =>
                  setValue("stacking_allowed", v, { shouldDirty: true })
                }
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save promotion
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

// Convert ISO timestamp to "YYYY-MM-DDTHH:mm" for datetime-local input
function toLocalInput(v: string | null | undefined): string {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        {hint ? (
          <span className="text-muted-foreground text-[10px]">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
