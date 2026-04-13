"use client";

import { Controller, useFieldArray, useFormContext } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
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
import { defaultSlices, makeSliceId } from "@/lib/wheel-defaults";
import type { QuestionType } from "@/lib/types/database";

const COUNTS = [2, 4, 6, 8] as const;

const PRESETS: {
  id: string;
  label: string;
  apply: () => GameFormValues["wheel"]["slices"];
}[] = [
  {
    id: "classic",
    label: "Classic truth / dare",
    apply: () => defaultSlices(6),
  },
  {
    id: "romantic",
    label: "Romantic",
    apply: () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: makeSliceId(),
        label_he: i % 2 === 0 ? "מתוק" : "מעז",
        label_en: i % 2 === 0 ? "Sweet" : "Spicy",
        color: i % 2 === 0 ? "#fda4af" : "#fb7185",
        question_type: (i % 2 === 0 ? "truth" : "dare") as QuestionType,
      })),
  },
  {
    id: "balanced",
    label: "Balanced 4",
    apply: () => defaultSlices(4),
  },
];

export function SliceEditor() {
  const { control } = useFormContext<GameFormValues>();
  const { fields, remove, replace, append } = useFieldArray({
    control,
    name: "wheel.slices",
  });

  function setSliceCount(n: 2 | 4 | 6 | 8) {
    replace(defaultSlices(n));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <Label>Number of slices</Label>
          <Select
            value={String(fields.length)}
            onValueChange={(v) => setSliceCount(Number(v) as 2 | 4 | 6 | 8)}
          >
            <SelectTrigger className="w-[140px]">
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
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => replace(p.apply())}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-6">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="bg-card text-card-foreground rounded-xl border p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Slice {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-8 w-8"
                disabled={fields.length <= 2}
                onClick={() => remove(index)}
                aria-label="Remove slice"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <LocalizedFieldRow
              control={control}
              fieldBase={`wheel.slices.${index}.label`}
              multiline={false}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Controller
                  control={control}
                  name={`wheel.slices.${index}.color`}
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
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </div>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Question type</Label>
                <Controller
                  control={control}
                  name={`wheel.slices.${index}.question_type`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="truth">Truth</SelectItem>
                        <SelectItem value="dare">Dare</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {fields.length < 8 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              id: makeSliceId(),
              label_he: "חדש",
              label_en: "New",
              color: "#94a3b8",
              question_type: "custom",
            })
          }
        >
          <Plus className="mr-1 size-4" />
          Add slice
        </Button>
      ) : null}
    </div>
  );
}
