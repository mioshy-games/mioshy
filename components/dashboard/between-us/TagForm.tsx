"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  experienceGameTagSchema,
  type ExperienceGameTagFormValues,
} from "@/lib/between-us/validations";
import { saveTag } from "@/app/dashboard/actions/between-us-taxonomy";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function TagForm({
  tagId,
  defaultValues,
}: {
  tagId: string | null;
  defaultValues: ExperienceGameTagFormValues;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const methods = useForm<ExperienceGameTagFormValues>({
    resolver: zodResolver(experienceGameTagSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { register, watch, setValue, handleSubmit, formState } = methods;

  async function onSubmit(values: ExperienceGameTagFormValues) {
    setSaving(true);
    const res = await saveTag(tagId, values);
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
    if (!tagId) {
      router.push(`/dashboard/adults/tags/${res.id}/edit`);
    }
    router.refresh();
  }

  const colorHex = watch("color_hex") ?? "";

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
          <Button type="submit" disabled={saving} size="sm" className="min-w-[110px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>

        <section className="bg-card space-y-4 rounded-lg border p-5">
          <header className="flex items-baseline justify-between gap-3 border-b pb-2">
            <h2 className="text-base font-semibold">Tag</h2>
            <span className="text-muted-foreground text-xs">
              Lightweight label - multiple tags per game
            </span>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug" className="sm:col-span-2">
              <Input
                {...register("slug")}
                className="font-mono"
                placeholder="date-night"
              />
            </Field>

            <Field label="Name (HE)">
              <Input {...register("name_he")} dir="rtl" placeholder="ערב דייט" />
            </Field>
            <Field label="Name (EN)">
              <Input {...register("name_en")} placeholder="Date Night" />
            </Field>

            <Field label="Color (hex)" className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="border-input h-9 w-12 cursor-pointer rounded-md border p-1"
                  value={colorHex || "#888888"}
                  onChange={(e) =>
                    setValue("color_hex", e.target.value, { shouldDirty: true })
                  }
                />
                <Input
                  value={colorHex}
                  placeholder="#888888"
                  onChange={(e) =>
                    setValue("color_hex", e.target.value, { shouldDirty: true })
                  }
                  className="font-mono"
                />
                {colorHex ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setValue("color_hex", null, { shouldDirty: true })
                    }
                  >
                    Clear
                  </Button>
                ) : null}
                <TagPreview colorHex={colorHex} label={watch("name_he")} />
              </div>
            </Field>
          </div>
        </section>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save tag
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

function TagPreview({
  colorHex,
  label,
}: {
  colorHex: string;
  label: string;
}) {
  if (!label) return null;
  const bg = colorHex || "#e5e7eb";
  const fg = readableFg(bg);
  return (
    <span
      className="ms-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: bg, color: fg }}
      dir="rtl"
    >
      {label}
    </span>
  );
}

function readableFg(hex: string): string {
  const m = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!m) return "#111111";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // Per-channel relative luminance approximation
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#111111" : "#ffffff";
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
