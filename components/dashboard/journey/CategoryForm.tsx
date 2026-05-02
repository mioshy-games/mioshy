"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  journeyCategorySchema,
  type JourneyCategoryFormValues,
} from "@/lib/journey-content/validations";
import { saveJourneyCategory } from "@/app/dashboard/actions/journey-content";

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
import { Field, Section } from "./Field";

export interface ProgramOption {
  id: string;
  name_he: string;
  name_en: string | null;
}

const STANDALONE = "__standalone__";

export function CategoryForm({
  categoryId,
  defaultValues,
  programs,
}: {
  categoryId: string | null;
  defaultValues: JourneyCategoryFormValues;
  programs: ProgramOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const methods = useForm<JourneyCategoryFormValues>({
    resolver: zodResolver(journeyCategorySchema),
    defaultValues,
    mode: "onBlur",
  });

  const { register, watch, setValue, handleSubmit, formState } = methods;

  async function onSubmit(values: JourneyCategoryFormValues) {
    console.log("[CategoryForm] submit", { categoryId, values });
    setSaving(true);
    const res = await saveJourneyCategory(categoryId, values);
    setSaving(false);
    console.log("[CategoryForm] saveJourneyCategory result", res);
    if (!res.ok) {
      const errMap = (res.error ?? {}) as Record<string, string[] | undefined>;
      const firstField = Object.keys(errMap)[0];
      const firstMsg = errMap[firstField ?? ""]?.[0] ?? "Save failed";
      console.error("[CategoryForm] save failed", { errors: errMap });
      toast.error(`Save failed: ${firstMsg}`);
      return;
    }
    toast.success("Saved");
    if (!categoryId) {
      router.push(`/dashboard/journey/categories/${res.id}`);
    }
    router.refresh();
  }

  function onInvalid(errors: typeof formState.errors) {
    // Surface client-side validation rejections so users don't experience
    // a silent no-op when react-hook-form blocks the submit.
    console.warn("[CategoryForm] validation rejected submit", errors);
    const fields = Object.entries(errors).flatMap(([field, err]) => {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message?: string }).message ?? "invalid"
          : "invalid";
      return [`${field}: ${msg}`];
    });
    toast.error(
      fields.length === 0
        ? "Form invalid"
        : `Cannot save — ${fields.slice(0, 3).join(" · ")}${
            fields.length > 3 ? ` (+${fields.length - 3} more)` : ""
          }`,
    );
  }

  const isActive = watch("is_active");
  const programId = watch("program_id") ?? null;
  const selectValue = programId ? programId : STANDALONE;

  return (
    <FormProvider {...methods}>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit, onInvalid)(e);
        }}
      >
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={!!isActive}
              onCheckedChange={(v) =>
                setValue("is_active", v, { shouldDirty: true })
              }
              id="is_active"
            />
            <Label htmlFor="is_active" className="cursor-pointer text-sm">
              {isActive ? "Active" : "Draft"}
            </Label>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {formState.isDirty ? "• unsaved" : "• saved"}
            </span>
          </div>
          <Button type="submit" disabled={saving} size="sm" className="min-w-[110px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>

        <Section
          title="Identity"
          description="A category groups items topically. Standalone categories can be assigned on their own; program-owned categories ride along with their program."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Program"
              hintTopic="category.program_id"
              className="sm:col-span-2"
            >
              <Select
                value={selectValue}
                onValueChange={(v) =>
                  setValue(
                    "program_id",
                    v === STANDALONE ? null : v,
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STANDALONE}>
                    Standalone (no program)
                  </SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name_he}
                      {p.name_en ? ` - ${p.name_en}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Slug"
              hint="Unique within program (or globally for standalone)"
              className="sm:col-span-2"
            >
              <Input
                {...register("slug")}
                className="font-mono"
                placeholder="week-1-reconnect"
              />
            </Field>

            <Field label="Name (HE)">
              <Input {...register("name_he")} dir="rtl" placeholder="שבוע 1 - חיבור מחדש" />
            </Field>
            <Field label="Name (EN)">
              <Input {...register("name_en")} placeholder="Week 1 - Reconnect" />
            </Field>

            <Field label="Description (HE)">
              <Textarea
                {...register("description_he")}
                dir="rtl"
                rows={2}
                placeholder="תיאור קצר"
              />
            </Field>
            <Field label="Description (EN)">
              <Textarea
                {...register("description_en")}
                rows={2}
                placeholder="Short description"
              />
            </Field>

            <Field label="Sort order" hint="Lower renders earlier">
              <Input
                type="number"
                min={-1000}
                max={10000}
                {...register("sort_order", { valueAsNumber: true })}
              />
            </Field>
          </div>
        </Section>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save category
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
