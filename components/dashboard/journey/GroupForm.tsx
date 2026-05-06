"use client";

// ============================================================
// GroupForm - slice 7 v3 group identity editor.
// Mirrors CategoryForm / SubtopicForm: react-hook-form + zod +
// Sonner toast + sticky save header. Membership and subtopic
// bindings are handled by separate components below the form.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  journeyGroupSchema,
  type JourneyGroupFormValues,
} from "@/lib/journey-content/validations";
import { saveJourneyGroup } from "@/app/dashboard/actions/journey-groups";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Field, Section } from "./Field";

export function GroupForm({
  groupId,
  defaultValues,
}: {
  groupId: string | null;
  defaultValues: JourneyGroupFormValues;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const methods = useForm<JourneyGroupFormValues>({
    resolver: zodResolver(journeyGroupSchema),
    defaultValues,
    mode: "onBlur",
  });
  const { register, watch, setValue, handleSubmit, formState } = methods;

  async function onSubmit(values: JourneyGroupFormValues) {
    setSaving(true);
    const res = await saveJourneyGroup(groupId, values);
    setSaving(false);
    if (!res.ok) {
      const errMap = (res.error ?? {}) as Record<string, string[] | undefined>;
      const firstField = Object.keys(errMap)[0];
      const firstMsg = errMap[firstField ?? ""]?.[0] ?? "Save failed";
      toast.error(`Save failed: ${firstMsg}`);
      return;
    }
    toast.success("Saved");
    if (!groupId) {
      router.push(`/dashboard/journey/groups/${res.id}`);
    }
    router.refresh();
  }

  function onInvalid(errors: typeof formState.errors) {
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
          description="A group is a cohort of users that admins bind to specific subtopics. The cadence engine respects each binding's mode (replace vs interleave)."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug" hint="Unique" className="sm:col-span-2">
              <Input
                {...register("slug")}
                className="font-mono"
                placeholder="bdsm-curious-2026"
              />
            </Field>

            <Field label="Label (HE)">
              <Input {...register("label_he")} dir="rtl" placeholder="קבוצת BDSM" />
            </Field>
            <Field label="Label (EN)">
              <Input {...register("label_en")} placeholder="BDSM-curious cohort" />
            </Field>

            <Field label="Description (HE)">
              <Textarea
                {...register("description_he")}
                dir="rtl"
                rows={2}
                placeholder="תיאור פנימי לאדמין"
              />
            </Field>
            <Field label="Description (EN)">
              <Textarea
                {...register("description_en")}
                rows={2}
                placeholder="Internal admin description"
              />
            </Field>
          </div>
        </Section>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save group
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
