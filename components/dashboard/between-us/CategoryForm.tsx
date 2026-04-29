"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

import {
  experienceGameCategorySchema,
  type ExperienceGameCategoryFormValues,
} from "@/lib/between-us/validations";
import { saveCategory } from "@/app/dashboard/actions/between-us-taxonomy";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function CategoryForm({
  categoryId,
  defaultValues,
}: {
  categoryId: string | null;
  defaultValues: ExperienceGameCategoryFormValues;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const methods = useForm<ExperienceGameCategoryFormValues>({
    resolver: zodResolver(experienceGameCategorySchema),
    defaultValues,
    mode: "onBlur",
  });

  const { register, watch, setValue, handleSubmit, formState } = methods;

  async function onSubmit(values: ExperienceGameCategoryFormValues) {
    setSaving(true);
    const res = await saveCategory(categoryId, values);
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
    if (!categoryId) {
      router.push(`/dashboard/adults/categories/${res.id}/edit`);
    }
    router.refresh();
  }

  async function uploadIcon(file: File) {
    const client = createBrowserSupabaseClient();
    if (!client) {
      toast.error("Supabase is not configured");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "webp";
      const path = `categories/icon-${Date.now()}.${ext}`.replace(/\s+/g, "-");
      const { error: upErr } = await client.storage
        .from("between-us")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data } = client.storage.from("between-us").getPublicUrl(path);
      setValue("icon_url", data.publicUrl, { shouldDirty: true });
      toast.success("Uploaded");
    } finally {
      setUploading(false);
    }
  }

  const iconUrl = watch("icon_url");
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
            <h2 className="text-base font-semibold">Category</h2>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug" className="sm:col-span-2">
              <Input
                {...register("slug")}
                className="font-mono"
                placeholder="intimacy"
              />
            </Field>

            <Field label="Name (HE)">
              <Input {...register("name_he")} dir="rtl" placeholder="אינטימיות" />
            </Field>
            <Field label="Name (EN)">
              <Input {...register("name_en")} placeholder="Intimacy" />
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

            <Field label="Sort weight" hint="Lower sorts earlier">
              <Input
                type="number"
                min={0}
                max={9999}
                {...register("sort_weight", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Color (hex)">
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
              </div>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
            <div className="bg-muted/30 flex aspect-square items-center justify-center overflow-hidden rounded-md border">
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={iconUrl}
                  alt="Category icon"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-muted-foreground text-center text-[11px]">
                  Icon
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Icon URL</Label>
              <Input
                {...register("icon_url")}
                placeholder="https://..."
              />
              <div className="flex gap-2">
                <label className="border-input bg-background hover:bg-muted inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-medium">
                  {uploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5" />
                  )}
                  {uploading ? "Uploading..." : "Upload icon"}
                  <input
                    type="file"
                    accept="image/webp,image/png,image/svg+xml"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadIcon(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                {iconUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() =>
                      setValue("icon_url", null, { shouldDirty: true })
                    }
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

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
