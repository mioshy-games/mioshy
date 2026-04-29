"use client";

// ============================================================
// Admin bulk-assign form. Steps inline (no multi-page wizard):
//   1. Owner picker (user | couple)
//   2. Source picker (program | category | item)
//   3. Anchor kind + optional date
//   4. Optional notes
// On submit we call previewJourneyAssignment() first to show the admin
// "this will materialize N items" before actually creating. Clicking
// confirm creates + materializes.
// ============================================================

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, Section } from "./Field";

import {
  journeyAssignmentSchema,
  type JourneyAssignmentFormValues,
} from "@/lib/journey-content/validations";
import type { AssignmentSourceKind } from "@/lib/journey-content/types";
import {
  createJourneyAssignment,
  previewJourneyAssignment,
} from "@/app/dashboard/actions/journey-assignments";

export interface OwnerOption {
  key: string;
  kind: "user" | "couple";
  label: string;
  sublabel?: string;
}

export interface SourceOption {
  id: string;
  label: string;
  sublabel?: string;
}

export function AssignmentForm({
  owners,
  programs,
  categories,
  items,
  defaultOwnerKey,
}: {
  owners: OwnerOption[];
  programs: SourceOption[];
  categories: SourceOption[];
  items: SourceOption[];
  defaultOwnerKey?: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<
    | { items_count: number; anchor_date: string }
    | null
  >(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const methods = useForm<JourneyAssignmentFormValues>({
    resolver: zodResolver(journeyAssignmentSchema),
    defaultValues: {
      owner_key: defaultOwnerKey ?? "",
      source_kind: "program",
      source_id: "",
      anchor_kind: "assignment",
      anchor_date: "",
      origin: "admin_manual",
      notes: "",
    },
    mode: "onBlur",
  });

  const { register, watch, setValue, handleSubmit, getValues } = methods;

  const sourceKind = watch("source_kind") as AssignmentSourceKind;
  const anchorKind = watch("anchor_kind");
  const sourceOptions =
    sourceKind === "program"
      ? programs
      : sourceKind === "category"
        ? categories
        : items;

  const ownerLabel = useMemo(() => {
    const key = watch("owner_key");
    if (!key) return null;
    const hit = owners.find((o) => o.key === key);
    if (!hit) return null;
    return `${hit.kind}: ${hit.label}${hit.sublabel ? ` · ${hit.sublabel}` : ""}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch("owner_key")]);

  async function runPreview() {
    setLoadingPreview(true);
    const values = getValues();
    const res = await previewJourneyAssignment(values);
    setLoadingPreview(false);
    if (!res.ok) {
      const firstMsg =
        Object.values(res.error).flat().find((v) => typeof v === "string") ??
        "Preview failed";
      toast.error(firstMsg);
      setPreview(null);
      return;
    }
    setPreview({
      items_count: res.items_count,
      anchor_date: res.anchor_date,
    });
  }

  async function onSubmit(values: JourneyAssignmentFormValues) {
    setSaving(true);
    const res = await createJourneyAssignment(values);
    setSaving(false);
    if (!res.ok) {
      const firstMsg =
        Object.values(res.error).flat().find((v) => typeof v === "string") ??
        "Create failed";
      toast.error(firstMsg);
      return;
    }
    toast.success(
      `Assignment created — ${res.inserted ?? 0} scheduled rows materialized`,
    );
    router.push(`/dashboard/journey/assignments/${res.id}`);
    router.refresh();
  }

  return (
    <FormProvider {...methods}>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)(e);
        }}
      >
        <Section
          title="Owner"
          description="Pick the couple or single user who should see this content."
        >
          <Field label="Owner" hint="Couples include both partners automatically.">
            <Select
              value={watch("owner_key") || undefined}
              onValueChange={(v) => {
                if (v) {
                  setValue("owner_key", v, { shouldDirty: true });
                  setPreview(null);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select owner" />
              </SelectTrigger>
              <SelectContent>
                {owners.length === 0 ? (
                  <div className="text-muted-foreground px-3 py-4 text-xs">
                    No owners available.
                  </div>
                ) : null}
                {owners.map((o) => (
                  <SelectItem key={o.key} value={o.key}>
                    <span className="text-xs uppercase text-muted-foreground me-2">
                      {o.kind}
                    </span>
                    {o.label}
                    {o.sublabel ? (
                      <span className="text-muted-foreground ms-2 text-xs">
                        · {o.sublabel}
                      </span>
                    ) : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {ownerLabel ? (
            <div className="text-muted-foreground mt-1 text-xs">{ownerLabel}</div>
          ) : null}
        </Section>

        <Section
          title="Source"
          description="Pick what the timeline should unfold from: an entire program, a single category, or one specific item."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kind">
              <Select
                value={sourceKind}
                onValueChange={(v) => {
                  if (v) {
                    setValue(
                      "source_kind",
                      v as AssignmentSourceKind,
                      { shouldDirty: true },
                    );
                    setValue("source_id", "", { shouldDirty: true });
                    setPreview(null);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="program">Program</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="item">Single item</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Source" className="sm:col-span-1">
              <Select
                value={watch("source_id") || undefined}
                onValueChange={(v) => {
                  if (v) {
                    setValue("source_id", v, { shouldDirty: true });
                    setPreview(null);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${sourceKind}`} />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.length === 0 ? (
                    <div className="text-muted-foreground px-3 py-4 text-xs">
                      No active {sourceKind}s.
                    </div>
                  ) : null}
                  {sourceOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                      {o.sublabel ? (
                        <span className="text-muted-foreground ms-2 text-xs">
                          · {o.sublabel}
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section
          title="Schedule"
          description="Anchor determines day 0 — all item offsets are relative to this date."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Anchor kind">
              <Select
                value={anchorKind}
                onValueChange={(v) => {
                  if (v) {
                    setValue(
                      "anchor_kind",
                      v as JourneyAssignmentFormValues["anchor_kind"],
                      { shouldDirty: true },
                    );
                    setPreview(null);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assignment">
                    Assignment — unlock from today
                  </SelectItem>
                  <SelectItem value="purchase">
                    Purchase — unlock from the purchase date
                  </SelectItem>
                  <SelectItem value="fixed">
                    Fixed — pick a specific date
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Anchor date"
              hint={
                anchorKind === "fixed"
                  ? "Required for 'fixed'"
                  : "Optional — leave empty to use now"
              }
            >
              <Input
                type="date"
                {...register("anchor_date", {
                  onChange: () => setPreview(null),
                })}
              />
            </Field>

            <Field label="Origin" hint="Tag used for reporting">
              <Select
                value={watch("origin")}
                onValueChange={(v) => {
                  if (v) {
                    setValue(
                      "origin",
                      v as JourneyAssignmentFormValues["origin"],
                      { shouldDirty: true },
                    );
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_manual">Admin manual</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="trigger">Trigger</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                rows={2}
                {...register("notes")}
                placeholder="Context for coach follow-up (optional)"
              />
            </Field>
          </div>
        </Section>

        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-sm">Preview materialization</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Runs the same catalog expansion that will happen on create.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void runPreview()}
              disabled={loadingPreview}
            >
              {loadingPreview ? (
                <Loader2 className="me-2 size-4 animate-spin" />
              ) : null}
              Preview
            </Button>
          </div>
          {preview ? (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted/40 rounded-md px-3 py-2">
                <div className="text-muted-foreground text-xs">
                  Items to materialize
                </div>
                <div className="text-lg font-semibold">{preview.items_count}</div>
              </div>
              <div className="bg-muted/40 rounded-md px-3 py-2">
                <div className="text-muted-foreground text-xs">
                  Resolved anchor
                </div>
                <div className="font-mono text-xs">
                  {new Date(preview.anchor_date).toISOString().slice(0, 10)}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="min-w-[160px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Create + materialize
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
