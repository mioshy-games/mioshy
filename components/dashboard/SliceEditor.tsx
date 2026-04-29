"use client";

import { Control, Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LocalizedFieldRow } from "@/components/dashboard/LocalizedFieldRow";
import type { GameFormValues } from "@/lib/validations";
import { makeSliceId } from "@/lib/wheel-defaults";

const COUNTS = [2, 4, 6, 8, 10, 12, 14, 16] as const;

type CategoryRow = {
  id: string;
  key: string;
  label_he: string;
  label_en: string;
  color: string;
};

function ceilToMultiple(n: number, k: number) {
  if (k <= 0) return n;
  return Math.ceil(n / k) * k;
}

function buildSlices(
  categories: CategoryRow[],
  desiredTotal: number,
) {
  const cats = categories.filter((c) => c.key.trim().length > 0);
  const c = cats.length;
  if (c === 0) return { total: 0, slices: [] as GameFormValues["wheel"]["slices"] };

  let total = Math.max(2, Math.min(16, desiredTotal));
  total = ceilToMultiple(total, c);
  if (total > 16) total = Math.floor(16 / c) * c;
  if (total < 2) total = c; // fallback

  const per = Math.max(1, Math.floor(total / c));
  // Interleave categories (round-robin) so wheel alternates evenly.
  const slices: GameFormValues["wheel"]["slices"] = [];
  for (let i = 0; i < per; i += 1) {
    for (const cat of cats) {
      slices.push({
        id: makeSliceId(),
        label_he: cat.label_he,
        label_en: cat.label_en,
        color: cat.color,
        question_type: cat.key,
      });
    }
  }
  return { total, slices };
}

// ── Compact per-slice row ────────────────────────────────────────────────────

function SliceRow({
  control,
  index,
  typeOptions,
  onRemove,
}: {
  control: Control<GameFormValues>;
  index: number;
  typeOptions: { key: string; label: string }[];
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/50 px-2 py-1.5">
      {/* Color swatch */}
      <Controller
        control={control}
        name={`wheel.slices.${index}.color`}
        render={({ field }) => (
          <input
            type="color"
            className="h-7 w-7 shrink-0 cursor-pointer rounded border border-input p-0.5"
            value={field.value || "#a855f7"}
            onChange={(e) => field.onChange(e.target.value)}
            title="Slice color"
          />
        )}
      />

      {/* Hebrew label */}
      <Controller
        control={control}
        name={`wheel.slices.${index}.label_he`}
        render={({ field }) => (
          <Input
            className="h-7 min-w-0 flex-1 text-xs"
            placeholder="עברית"
            dir="rtl"
            {...field}
          />
        )}
      />

      {/* English label */}
      <Controller
        control={control}
        name={`wheel.slices.${index}.label_en`}
        render={({ field }) => (
          <Input
            className="h-7 min-w-0 flex-1 text-xs"
            placeholder="English"
            {...field}
          />
        )}
      />

      {/* Question type */}
      <Controller
        control={control}
        name={`wheel.slices.${index}.question_type`}
        render={({ field }) =>
          typeOptions.length > 0 ? (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label || opt.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-7 w-[110px] font-mono text-xs"
              placeholder="type"
              {...field}
            />
          )
        }
      />

      {/* Delete */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
        onClick={onRemove}
        aria-label="Delete slice"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

// ── Main SliceEditor ─────────────────────────────────────────────────────────

export function SliceEditor() {
  const { control, setValue } = useFormContext<GameFormValues>();
  const { fields, replace, append, remove } = useFieldArray({
    control,
    name: "wheel.slices",
  });

  const categoriesLive = useWatch({
    control,
    name: "wheel.player_config.categories",
  }) as CategoryRow[] | undefined;
  const desiredTotal = useWatch({
    control,
    name: "wheel.player_config.desired_total_slices",
  }) as number | undefined;

  // Derive type options for the per-slice type selector
  const typeOptions = (categoriesLive ?? [])
    .filter((c) => c.key.trim().length > 0)
    .map((c) => ({ key: c.key.trim(), label: c.label_he || c.label_en || c.key }));

  function recomputeSlices(categoriesValues: CategoryRow[], desired: number) {
    const { slices } = buildSlices(categoriesValues, desired);
    replace(slices);
    const colors = Object.fromEntries(
      categoriesValues
        .filter((c) => c.key.trim().length > 0)
        .map((c) => [c.key.trim(), c.color]),
    );
    setValue("wheel.category_colors", colors, { shouldDirty: true });
  }

  return (
    <div className="space-y-6">

      {/* ── SECTION A: Category-based auto-generator ─────────────────────── */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Category generator
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1.5">
            <Label>Total slices (2–16)</Label>
            <Controller
              control={control}
              name="wheel.player_config.desired_total_slices"
              render={({ field }) => (
                <Select
                  value={String(field.value ?? Math.max(2, fields.length))}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTS.map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        {c} slices
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const next = [
                ...(categoriesLive ?? []),
                {
                  id: makeSliceId(),
                  key: "",
                  label_he: "",
                  label_en: "",
                  color: "#f472b6",
                },
              ];
              setValue("wheel.player_config.categories", next, { shouldDirty: true });
            }}
          >
            <Plus className="mr-1 size-4" />
            Add category
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              recomputeSlices(
                (categoriesLive ?? []).map((c) => ({
                  id: c.id,
                  key: c.key,
                  label_he: c.label_he,
                  label_en: c.label_en,
                  color: c.color,
                })),
                desiredTotal ?? Math.max(2, fields.length),
              );
            }}
          >
            Recompute slices
          </Button>
        </div>

        <Separator />

        <div className="space-y-6">
          {(categoriesLive ?? []).length === 0 ? (
            <div className="text-muted-foreground text-sm">
              Add categories, then recompute slices.
            </div>
          ) : (
            (categoriesLive ?? []).map((field, index) => (
              <div
                key={field.id}
                className="bg-card text-card-foreground rounded-xl border p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Category {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => {
                      const next = (categoriesLive ?? []).filter((_, i) => i !== index);
                      setValue("wheel.player_config.categories", next, { shouldDirty: true });
                    }}
                    aria-label="Remove category"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Key (category id)</Label>
                    <Controller
                      control={control}
                      name={`wheel.player_config.categories.${index}.key`}
                      render={({ field }) => (
                        <Input
                          className="font-mono text-sm"
                          placeholder="e.g. truth, dare, spicy"
                          {...field}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Color</Label>
                    <Controller
                      control={control}
                      name={`wheel.player_config.categories.${index}.color`}
                      render={({ field }) => (
                        <div className="flex gap-2">
                          <input
                            type="color"
                            className="border-input h-10 w-14 shrink-0 cursor-pointer rounded-md border p-1"
                            value={field.value || "#000000"}
                            onChange={(e) => field.onChange(e.target.value)}
                            aria-label="Pick color"
                          />
                          <Input
                            className="font-mono text-sm"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </div>
                      )}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <LocalizedFieldRow
                    control={control}
                    fieldBase={`wheel.player_config.categories.${index}.label`}
                    multiline={false}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Slices are generated evenly across categories. If total slices isn't
              divisible by category count, the system will round to the nearest
              supported distribution (up to 16).
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── SECTION B: Direct slice list ──────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">
              Slices{" "}
              <span className="text-muted-foreground font-normal">
                ({fields.length})
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Edit or delete individual slices directly. Use the generator above to rebuild from categories.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              append({
                id: makeSliceId(),
                label_he: "",
                label_en: "",
                color: "#a855f7",
                question_type: typeOptions[0]?.key ?? "custom",
              });
            }}
          >
            <Plus className="mr-1 size-4" />
            Add slice
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No slices yet. Add categories and click Recompute, or add a slice manually.
          </p>
        ) : (
          <div className="space-y-1.5">
            {/* Header row */}
            <div className="grid px-1" style={{ gridTemplateColumns: "28px 1fr 1fr 110px 28px" }}>
              <span />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-1">עברית</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-1">English</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide px-1">Type</span>
              <span />
            </div>
            {fields.map((slice, index) => (
              <SliceRow
                key={slice.id}
                control={control}
                index={index}
                typeOptions={typeOptions}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
