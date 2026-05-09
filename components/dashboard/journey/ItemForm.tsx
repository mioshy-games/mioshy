"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  journeyItemSchema,
  type JourneyItemFormValues,
} from "@/lib/journey-content/validations";
import { saveJourneyItem } from "@/app/dashboard/actions/journey-content";

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
import { t } from "@/lib/admin/i18n";
import type { AdminLocale } from "@/lib/admin/locale";

export interface CategoryOption {
  id: string;
  label: string;
  program_label: string | null;
}

export interface SubtopicOption {
  id: string;
  category_id: string;
  label: string;
}

const SUBTOPIC_NONE = "__none__";

export function ItemForm({
  itemId,
  defaultValues,
  categories,
  subtopics,
  locale = "en",
}: {
  itemId: string | null;
  defaultValues: JourneyItemFormValues;
  categories: CategoryOption[];
  /** Every subtopic across the catalog. The form filters by the
   *  currently-selected category_id at render time. */
  subtopics: SubtopicOption[];
  locale?: AdminLocale;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const methods = useForm<JourneyItemFormValues>({
    resolver: zodResolver(journeyItemSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { register, watch, setValue, handleSubmit, formState } = methods;

  async function onSubmit(values: JourneyItemFormValues) {
    console.log("[ItemForm] submit", { itemId, values });
    setSaving(true);
    const res = await saveJourneyItem(itemId, values);
    setSaving(false);
    console.log("[ItemForm] saveJourneyItem result", res);
    if (!res.ok) {
      const errMap = (res.error ?? {}) as Record<string, string[] | undefined>;
      const firstField = Object.keys(errMap)[0];
      const firstMsg = errMap[firstField ?? ""]?.[0] ?? "Save failed";
      console.error("[ItemForm] save failed", { errors: errMap });
      toast.error(`Save failed: ${firstMsg}`);
      return;
    }
    toast.success("Saved");
    if (!itemId) {
      router.push(`/dashboard/journey/items/${res.id}`);
    }
    router.refresh();
  }

  function onInvalid(errors: typeof formState.errors) {
    // react-hook-form's handleSubmit silently rejects when the form fails
    // client-side validation, so users see no feedback and assume "save
    // didn't do anything". Surface every problem field as a toast +
    // console.warn so the cause is visible.
    console.warn("[ItemForm] validation rejected submit", errors);
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
        : `Cannot save - ${fields.slice(0, 3).join(" · ")}${
            fields.length > 3 ? ` (+${fields.length - 3} more)` : ""
          }`,
    );
  }

  const isActive = watch("is_active");
  const categoryId = watch("category_id");
  const subtopicId = watch("subtopic_id") ?? "";
  const audience = watch("audience") ?? "both";

  // Subtopics scoped to the currently-selected category. Switching the
  // category clears any stale subtopic selection - the DB trigger
  // would reject a cross-category subtopic anyway.
  const subtopicsForCategory = subtopics.filter(
    (s) => s.category_id === categoryId,
  );
  const subtopicSelectValue = subtopicId && subtopicId.length > 0
    ? subtopicId
    : SUBTOPIC_NONE;

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
          title={t(locale, "form.section.stage")}
          description={t(locale, "form.section.stage_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Stage (1-4)">
              <Select
                value={String(watch("stage") ?? 0)}
                onValueChange={(v) => {
                  setValue("stage", Number(v), { shouldDirty: true });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">— None —</SelectItem>
                  <SelectItem value="1">1 · יסודות</SelectItem>
                  <SelectItem value="2">2 · העמקה</SelectItem>
                  <SelectItem value="3">3 · אינטגרציה</SelectItem>
                  <SelectItem value="4">4 · הבשלה</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.placement")}
          description={t(locale, "form.section.placement_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" className="sm:col-span-2">
              <Select
                value={categoryId || undefined}
                onValueChange={(v) => {
                  if (v) {
                    setValue("category_id", v, { shouldDirty: true });
                    // Switching category invalidates any subtopic
                    // (the trigger rejects cross-category subtopics).
                    setValue("subtopic_id", "", { shouldDirty: true });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.program_label ? `${c.program_label} · ` : ""}
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Subtopic"
              hintTopic="item.subtopic_id"
              className="sm:col-span-2"
            >
              <Select
                value={subtopicSelectValue}
                onValueChange={(v) => {
                  setValue(
                    "subtopic_id",
                    v === SUBTOPIC_NONE ? "" : v,
                    { shouldDirty: true },
                  );
                }}
                disabled={!categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !categoryId
                      ? "Pick a category first"
                      : "None (direct on category)"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SUBTOPIC_NONE}>
                    None (direct on category)
                  </SelectItem>
                  {subtopicsForCategory.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Slug" hint="Unique within category" className="sm:col-span-2">
              <Input
                {...register("slug")}
                className="font-mono"
                placeholder="sunday-reset-conversation"
              />
            </Field>

            <Field
              label="Default offset (days)"
              hintTopic="item.default_offset_days"
            >
              <Input
                type="number"
                min={0}
                max={3650}
                {...register("default_offset_days", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Sort order" hint="Ties broken by created_at">
              <Input
                type="number"
                min={-1000}
                max={10000}
                {...register("sort_order", { valueAsNumber: true })}
              />
            </Field>

            <Field
              label="Audience"
              hintTopic="item.audience"
              className="sm:col-span-2"
            >
              <Select
                value={audience}
                onValueChange={(v) => {
                  if (v) {
                    setValue("audience", v as "both" | "owner" | "partner", {
                      shouldDirty: true,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both partners</SelectItem>
                  <SelectItem value="owner">Owner only (partner A)</SelectItem>
                  <SelectItem value="partner">Partner only (partner B)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.content")}
          description={t(locale, "form.section.content_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title (HE)">
              <Input
                {...register("title_he")}
                dir="rtl"
                placeholder="שיחת יום ראשון"
              />
            </Field>
            <Field label="Title (EN)">
              <Input {...register("title_en")} placeholder="Sunday conversation" />
            </Field>

            <Field label="Body (HE)" className="sm:col-span-2">
              <Textarea
                {...register("body_he")}
                dir="rtl"
                rows={8}
                placeholder="הטקסט הראשי - תומך ב-Markdown"
              />
            </Field>
            <Field label="Body (EN)" className="sm:col-span-2">
              <Textarea
                {...register("body_en")}
                rows={8}
                placeholder="Main body - Markdown supported"
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.practice")}
          description={t(locale, "form.section.practice_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Task (HE)">
              <Textarea
                {...register("task_he")}
                dir="rtl"
                rows={3}
                placeholder="מה עושים השבוע"
              />
            </Field>
            <Field label="Task (EN)">
              <Textarea
                {...register("task_en")}
                rows={3}
                placeholder="What to do this week"
              />
            </Field>

            <Field label="Challenge (HE)">
              <Textarea
                {...register("challenge_he")}
                dir="rtl"
                rows={3}
                placeholder="אתגר אופציונלי"
              />
            </Field>
            <Field label="Challenge (EN)">
              <Textarea
                {...register("challenge_en")}
                rows={3}
                placeholder="Stretch challenge"
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.lesson_insight")}
          description={t(locale, "form.section.lesson_insight_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expert insight (HE)" className="sm:col-span-2">
              <Textarea
                {...register("expert_insight_he")}
                dir="rtl"
                rows={4}
                placeholder="ההיגיון מאחורי..."
              />
            </Field>
            <Field label="Expert insight (EN)" className="sm:col-span-2">
              <Textarea
                {...register("expert_insight_en")}
                rows={4}
                placeholder="The thinking behind..."
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.lesson_mistakes")}
          description={t(locale, "form.section.lesson_mistakes_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Common mistakes (HE)" className="sm:col-span-2">
              <Textarea
                {...register("common_mistakes_he")}
                dir="rtl"
                rows={3}
                placeholder="טעות נפוצה: ..."
              />
            </Field>
            <Field label="Common mistakes (EN)" className="sm:col-span-2">
              <Textarea
                {...register("common_mistakes_en")}
                rows={3}
                placeholder="Common mistake: ..."
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.lesson_metaphor")}
          description={t(locale, "form.section.lesson_metaphor_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Metaphor (HE)" className="sm:col-span-2">
              <Textarea
                {...register("metaphor_he")}
                dir="rtl"
                rows={3}
                placeholder="כמו ..."
              />
            </Field>
            <Field label="Metaphor (EN)" className="sm:col-span-2">
              <Textarea
                {...register("metaphor_en")}
                rows={3}
                placeholder="Like ..."
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.lesson_measurement")}
          description={t(locale, "form.section.lesson_measurement_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Measurement (HE)" className="sm:col-span-2">
              <Textarea
                {...register("measurement_he")}
                dir="rtl"
                rows={2}
                placeholder="ספרו השבוע: כמה פעמים..."
              />
            </Field>
            <Field label="Measurement (EN)" className="sm:col-span-2">
              <Textarea
                {...register("measurement_en")}
                rows={2}
                placeholder="Count this week: how many times..."
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.lesson_doDont")}
          description={t(locale, "form.section.lesson_doDont_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Do this week (HE)">
              <Textarea
                {...register("do_this_week_he")}
                dir="rtl"
                rows={3}
                placeholder="תרגלו..."
              />
            </Field>
            <Field label="Do this week (EN)">
              <Textarea
                {...register("do_this_week_en")}
                rows={3}
                placeholder="Practice..."
              />
            </Field>
            <Field label="Don't this week (HE)">
              <Textarea
                {...register("dont_this_week_he")}
                dir="rtl"
                rows={3}
                placeholder="אל תוותרו על..."
              />
            </Field>
            <Field label="Don't this week (EN)">
              <Textarea
                {...register("dont_this_week_en")}
                rows={3}
                placeholder="Don't skip..."
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.lesson_progress")}
          description={t(locale, "form.section.lesson_progress_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Progress marker (HE)" className="sm:col-span-2">
              <Textarea
                {...register("progress_marker_he")}
                dir="rtl"
                rows={2}
                placeholder="את/ה תופס/ת את עצמך ש..."
              />
            </Field>
            <Field label="Progress marker (EN)" className="sm:col-span-2">
              <Textarea
                {...register("progress_marker_en")}
                rows={2}
                placeholder="You catch yourself..."
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.lesson_source")}
          description={t(locale, "form.section.lesson_source_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source (HE)">
              <Input
                {...register("source_attribution_he")}
                dir="rtl"
                placeholder="Gary Chapman, The 5 Love Languages"
              />
            </Field>
            <Field label="Source (EN)">
              <Input
                {...register("source_attribution_en")}
                placeholder="Gary Chapman, The 5 Love Languages"
              />
            </Field>
          </div>
        </Section>

        <Section
          title={t(locale, "form.section.media")}
          description={t(locale, "form.section.media_hint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Video URL">
              <Input
                {...register("video_url")}
                placeholder="https://player.vimeo.com/..."
              />
            </Field>
            <Field label="Image URL">
              <Input {...register("image_url")} placeholder="https://..." />
            </Field>
          </div>
        </Section>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save item
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
