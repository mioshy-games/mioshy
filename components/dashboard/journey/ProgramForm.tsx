"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  journeyProgramSchema,
  type JourneyProgramFormValues,
} from "@/lib/journey-content/validations";
import { saveJourneyProgram } from "@/app/dashboard/actions/journey-content";

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

const ANCHOR_OPTIONS: Array<{
  value: "assignment" | "purchase" | "fixed";
  label: string;
  hint: string;
}> = [
  {
    value: "assignment",
    label: "Assignment date",
    hint: "Timeline starts on the day the program is assigned",
  },
  {
    value: "purchase",
    label: "Purchase date",
    hint: "Anchored to the owner's purchase timestamp",
  },
  {
    value: "fixed",
    label: "Fixed date",
    hint: "Admin sets a specific calendar date per assignment",
  },
];

// Sentinel used for "not automation-eligible" in the picker. Zod's
// productSlug union accepts "" so we reuse it here — the action layer
// maps "" → NULL before writing.
const PRODUCT_NONE = "" as const;

const PRODUCT_OPTIONS: Array<{
  value: "" | "games" | "journey" | "adults";
  label: string;
  hint: string;
}> = [
  {
    value: PRODUCT_NONE,
    label: "— None —",
    hint: "Admin-only program. Never auto-assigned by the purchase webhook.",
  },
  {
    value: "journey",
    label: "Journey",
    hint: "Assigned when a user subscribes to the Journey pillar.",
  },
  {
    value: "games",
    label: "Games",
    hint: "Assigned when a user subscribes to the Games pillar.",
  },
  {
    value: "adults",
    label: "Adults",
    hint: "Assigned when a user subscribes to the Adults pillar.",
  },
];

export function ProgramForm({
  programId,
  defaultValues,
}: {
  programId: string | null;
  defaultValues: JourneyProgramFormValues;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const methods = useForm<JourneyProgramFormValues>({
    resolver: zodResolver(journeyProgramSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { register, watch, setValue, handleSubmit, formState } = methods;

  async function onSubmit(values: JourneyProgramFormValues) {
    setSaving(true);
    const res = await saveJourneyProgram(programId, values);
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
    if (!programId) {
      router.push(`/dashboard/journey/programs/${res.id}`);
    }
    router.refresh();
  }

  const isActive = watch("is_active");
  const anchor = watch("default_anchor");
  const productSlug = watch("product_slug");

  return (
    <FormProvider {...methods}>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)(e);
        }}
      >
        {/* Sticky save bar */}
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
          description="How this program appears in the admin and public timeline."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Slug"
              hint="Lowercase, unique"
              className="sm:col-span-2"
            >
              <Input
                {...register("slug")}
                className="font-mono"
                placeholder="intimacy-reset-6w"
              />
            </Field>

            <Field label="Name (HE)">
              <Input
                {...register("name_he")}
                dir="rtl"
                placeholder="איפוס אינטימיות — 6 שבועות"
              />
            </Field>
            <Field label="Name (EN)">
              <Input {...register("name_en")} placeholder="Intimacy Reset — 6 weeks" />
            </Field>

            <Field label="Description (HE)">
              <Textarea
                {...register("description_he")}
                dir="rtl"
                rows={3}
                placeholder="תיאור קצר למסלול"
              />
            </Field>
            <Field label="Description (EN)">
              <Textarea
                {...register("description_en")}
                rows={3}
                placeholder="Short description"
              />
            </Field>

            <Field label="Cover image URL" className="sm:col-span-2">
              <Input
                {...register("cover_image_url")}
                placeholder="https://..."
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Scheduling"
          description="Controls how item unlock dates are computed when this program is assigned."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Default anchor"
              hint="Overridable per assignment"
            >
              <Select
                value={anchor}
                onValueChange={(v) =>
                  setValue("default_anchor", v as JourneyProgramFormValues["default_anchor"], {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANCHOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {ANCHOR_OPTIONS.find((o) => o.value === anchor)?.hint}
              </p>
            </Field>

            <Field
              label="Sort weight"
              hint="Higher sorts earlier in admin listings"
            >
              <Input
                type="number"
                min={-1000}
                max={1000}
                {...register("sort_weight", { valueAsNumber: true })}
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Automation"
          description="Wire this program to a product pillar so subscribers are auto-assigned when their payment clears."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Product pillar"
              hint="Only ONE active program per pillar"
            >
              <Select
                value={
                  productSlug && productSlug.length > 0
                    ? productSlug
                    : "__none__"
                }
                onValueChange={(v) =>
                  setValue(
                    "product_slug",
                    (v === "__none__" ? "" : v) as
                      JourneyProgramFormValues["product_slug"],
                    { shouldDirty: true },
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_OPTIONS.map((o) => (
                    <SelectItem
                      key={o.value || "__none__"}
                      value={o.value === "" ? "__none__" : o.value}
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {
                  PRODUCT_OPTIONS.find(
                    (o) => o.value === (productSlug ?? ""),
                  )?.hint
                }
              </p>
            </Field>
            <div className="text-muted-foreground rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
              When a user buys the selected pillar, the Cardcom webhook
              creates a purchase-anchored assignment from this program and
              materializes its items. Existing active assignments are left
              alone — no overwrites.
            </div>
          </div>
        </Section>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save program
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
