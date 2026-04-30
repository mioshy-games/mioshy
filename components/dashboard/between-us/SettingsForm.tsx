"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";

import {
  betweenUsSettingsSchema,
  type BetweenUsSettingsFormValues,
} from "@/lib/between-us/validations";
import { saveBetweenUsSettings } from "@/app/dashboard/actions/between-us-settings";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "commerce", label: "Commerce" },
  { id: "badges", label: "Badges" },
  { id: "storefront", label: "Storefront" },
] as const;

export function SettingsForm({
  defaultValues,
}: {
  defaultValues: BetweenUsSettingsFormValues;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const methods = useForm<BetweenUsSettingsFormValues>({
    resolver: zodResolver(betweenUsSettingsSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { control, register, watch, setValue, handleSubmit, formState } = methods;

  const tiersArray = useFieldArray({
    control,
    name: "buy_x_get_x_tiers",
  });

  const singleEnabled = watch("single_purchase_enabled");
  const monthlyEnabled = watch("monthly_enabled");
  const annualEnabled = watch("annual_enabled");
  const buyXEnabled = watch("buy_x_get_x_enabled");

  async function onSubmit(values: BetweenUsSettingsFormValues) {
    setSaving(true);
    const res = await saveBetweenUsSettings(values);
    setSaving(false);
    if (!res.ok) {
      const firstField = Object.keys(res.error ?? {})[0];
      const firstMsg =
        (res.error as Record<string, string[] | undefined>)?.[firstField ?? ""]?.[0] ??
        "Save failed";
      toast.error(firstMsg);
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  async function uploadBadge(
    file: File,
    fieldName:
      | "default_intimacy_badge_url"
      | "default_communication_badge_url"
      | "default_heat_badge_url",
  ) {
    const client = createBrowserSupabaseClient();
    if (!client) {
      toast.error("Supabase is not configured");
      return;
    }
    setUploadingKey(fieldName);
    try {
      const ext = file.name.split(".").pop() ?? "webp";
      const path = `badges/${fieldName}-${Date.now()}.${ext}`.replace(/\s+/g, "-");
      const { error: upErr } = await client.storage
        .from("between-us")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data } = client.storage.from("between-us").getPublicUrl(path);
      setValue(fieldName, data.publicUrl, { shouldDirty: true });
      toast.success("Uploaded");
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <FormProvider {...methods}>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit(onSubmit)(e);
        }}
      >
        {/* Sticky top bar */}
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 -mx-4 mb-6 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4">
          <p className="text-muted-foreground text-xs">
            {formState.isDirty ? "Unsaved changes" : "All changes saved"}
          </p>
          <Button type="submit" disabled={saving} size="sm" className="min-w-[140px]">
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
          <aside className="hidden lg:block">
            <nav className="sticky top-20 flex flex-col gap-1 text-sm">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#section-${s.id}`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-3 py-1.5 transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-8">
            {/* Identity */}
            <Section
              id="identity"
              title="Section identity"
              hint="Name and tagline shown across the public site."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Section slug"
                  hint="Used in public URLs"
                  className="sm:col-span-2"
                >
                  <Input
                    {...register("section_slug")}
                    className="font-mono"
                    placeholder="between-us"
                  />
                </Field>
                <Field label="Section name (HE)">
                  <Input
                    {...register("section_name_he")}
                    dir="rtl"
                    placeholder="למבוגרים בלבד"
                  />
                </Field>
                <Field label="Section name (EN)">
                  <Input
                    {...register("section_name_en")}
                    placeholder="Adults Only"
                  />
                </Field>
                <Field label="Tagline (HE)">
                  <Textarea
                    {...register("section_tagline_he")}
                    dir="rtl"
                    rows={2}
                  />
                </Field>
                <Field label="Tagline (EN)">
                  <Textarea
                    {...register("section_tagline_en")}
                    rows={2}
                  />
                </Field>
              </div>
            </Section>

            {/* Commerce */}
            <Section
              id="commerce"
              title="Commerce"
              hint="How couples acquire games. Turn features on or off any time."
            >
              <CommerceBlock
                title="Single purchase"
                hint="Buy a game once, lifetime access (default - per-game override lives on the game form)."
                enabled={singleEnabled}
                onToggle={(v) =>
                  setValue("single_purchase_enabled", v, { shouldDirty: true })
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Default price (ILS ₪)">
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      {...register("single_price_ils", { valueAsNumber: true })}
                      disabled={!singleEnabled}
                    />
                  </Field>
                  <Field label="Default price (USD $)">
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      {...register("single_price_usd", { valueAsNumber: true })}
                      disabled={!singleEnabled}
                    />
                  </Field>
                </div>
              </CommerceBlock>

              <CommerceBlock
                title="Monthly membership"
                hint="Recurring plan - content drip + access to the catalogue."
                enabled={monthlyEnabled}
                onToggle={(v) =>
                  setValue("monthly_enabled", v, { shouldDirty: true })
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Price (ILS ₪ / month)">
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      {...register("monthly_price_ils", { valueAsNumber: true })}
                      disabled={!monthlyEnabled}
                    />
                  </Field>
                  <Field label="Price (USD $ / month)">
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      {...register("monthly_price_usd", { valueAsNumber: true })}
                      disabled={!monthlyEnabled}
                    />
                  </Field>
                </div>
              </CommerceBlock>

              <CommerceBlock
                title="Annual membership"
                hint="Yearly plan - monthly benefits + one rotating Games-pillar game (30-day slot)."
                enabled={annualEnabled}
                onToggle={(v) =>
                  setValue("annual_enabled", v, { shouldDirty: true })
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Price (ILS ₪ / year)">
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      {...register("annual_price_ils", { valueAsNumber: true })}
                      disabled={!annualEnabled}
                    />
                  </Field>
                  <Field label="Price (USD $ / year)">
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      {...register("annual_price_usd", { valueAsNumber: true })}
                      disabled={!annualEnabled}
                    />
                  </Field>
                </div>
              </CommerceBlock>

              <CommerceBlock
                title="Buy X Get X"
                hint="Bundled gift offers: buy 1 get 1, buy 2 get 2, etc."
                enabled={buyXEnabled}
                onToggle={(v) =>
                  setValue("buy_x_get_x_enabled", v, { shouldDirty: true })
                }
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {tiersArray.fields.map((field, idx) => (
                      <div
                        key={field.id}
                        className="bg-background flex items-end gap-2 rounded-md border border-dashed p-2"
                      >
                        <Field label="Buy" className="w-16">
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            className="h-8"
                            {...register(
                              `buy_x_get_x_tiers.${idx}.buy` as const,
                              { valueAsNumber: true },
                            )}
                            disabled={!buyXEnabled}
                          />
                        </Field>
                        <Field label="Get" className="w-16">
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            className="h-8"
                            {...register(
                              `buy_x_get_x_tiers.${idx}.get` as const,
                              { valueAsNumber: true },
                            )}
                            disabled={!buyXEnabled}
                          />
                        </Field>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => tiersArray.remove(idx)}
                          disabled={!buyXEnabled}
                          aria-label="Remove tier"
                          className="h-8 w-8"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => tiersArray.append({ buy: 1, get: 1 })}
                    disabled={!buyXEnabled || tiersArray.fields.length >= 6}
                  >
                    <Plus className="me-1 size-4" /> Add tier
                  </Button>
                </div>
              </CommerceBlock>
            </Section>

            {/* Badges */}
            <Section
              id="badges"
              title="Default metric badges"
              hint="Fallback images when a game has no custom badge. WebP 240×240."
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <BadgeUploader
                  label="Intimacy"
                  url={watch("default_intimacy_badge_url") ?? null}
                  uploading={uploadingKey === "default_intimacy_badge_url"}
                  onUpload={(f) => uploadBadge(f, "default_intimacy_badge_url")}
                  onClear={() =>
                    setValue("default_intimacy_badge_url", null, {
                      shouldDirty: true,
                    })
                  }
                />
                <BadgeUploader
                  label="Communication"
                  url={watch("default_communication_badge_url") ?? null}
                  uploading={uploadingKey === "default_communication_badge_url"}
                  onUpload={(f) =>
                    uploadBadge(f, "default_communication_badge_url")
                  }
                  onClear={() =>
                    setValue("default_communication_badge_url", null, {
                      shouldDirty: true,
                    })
                  }
                />
                <BadgeUploader
                  label="Heat"
                  url={watch("default_heat_badge_url") ?? null}
                  uploading={uploadingKey === "default_heat_badge_url"}
                  onUpload={(f) => uploadBadge(f, "default_heat_badge_url")}
                  onClear={() =>
                    setValue("default_heat_badge_url", null, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
            </Section>

            {/* Storefront */}
            <Section id="storefront" title="Storefront">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Preview cards on homepage"
                  hint="How many to feature on the teaser."
                >
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    {...register("preview_cards_count", { valueAsNumber: true })}
                  />
                </Field>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Empty-state CTA</p>
                    <p className="text-muted-foreground text-xs">
                      Friendly prompt when no games exist yet.
                    </p>
                  </div>
                  <Switch
                    checked={watch("show_empty_state_cta")}
                    onCheckedChange={(v) =>
                      setValue("show_empty_state_cta", v, { shouldDirty: true })
                    }
                  />
                </label>
              </div>
            </Section>

            <div className="flex items-center justify-end pt-4">
              <Button type="submit" disabled={saving} className="min-w-[180px]">
                {saving ? (
                  <Loader2 className="me-2 size-4 animate-spin" />
                ) : null}
                Save settings
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

/* ------------------------------------------------------------------
   Layout primitives (shared shape with ExperienceGameForm)
   ------------------------------------------------------------------ */

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`section-${id}`}
      className="bg-card scroll-mt-24 space-y-4 rounded-lg border p-5"
    >
      <header className="flex items-baseline justify-between gap-3 border-b pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint ? (
          <p className="text-muted-foreground text-xs">{hint}</p>
        ) : null}
      </header>
      {children}
    </section>
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

function CommerceBlock({
  title,
  hint,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{title}</p>
            <Badge variant={enabled ? "default" : "secondary"} className="text-[10px]">
              {enabled ? "ON" : "OFF"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </label>
      {children}
    </div>
  );
}

function BadgeUploader({
  label,
  url,
  uploading,
  onUpload,
  onClear,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  onUpload: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label className="text-sm">{label}</Label>
      <div className="bg-muted/30 flex aspect-square items-center justify-center overflow-hidden rounded-md border">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${label} badge`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="text-muted-foreground text-center text-[11px]">
            <div>240 × 240</div>
            <div className="mt-0.5">WebP</div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <label className="border-input bg-background hover:bg-muted inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border text-xs font-medium">
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {uploading ? "Uploading" : "Upload"}
          <input
            type="file"
            accept="image/webp,image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.currentTarget.value = "";
            }}
            disabled={uploading}
          />
        </label>
        {url ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={uploading}
            className="h-8"
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
