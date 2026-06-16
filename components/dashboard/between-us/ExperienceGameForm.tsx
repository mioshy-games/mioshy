"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useFormContext,
  type FieldErrors,
} from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, X } from "lucide-react";

import {
  experienceGameSchema,
  type ExperienceGameFormValues,
} from "@/lib/between-us/validations";
import { saveExperienceGame } from "@/app/dashboard/actions/between-us-games";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  ExperienceGameCategory,
  ExperienceGameTag,
} from "@/lib/between-us/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { OpensAtField } from "@/components/dashboard/OpensAtField";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Props = {
  gameId: string | null;
  defaultValues: ExperienceGameFormValues;
  allCategories: ExperienceGameCategory[];
  allTags: ExperienceGameTag[];
};

type SectionId =
  | "basics"
  | "copy"
  | "media"
  | "metrics"
  | "taxonomy"
  | "play-questions"
  | "commerce"
  | "seo";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "copy", label: "Copy" },
  { id: "media", label: "Media" },
  { id: "metrics", label: "Metrics" },
  { id: "taxonomy", label: "Taxonomy" },
  // Optional per game - leave the lists empty for games that don't
  // need an in-play question reference. The play page hides the
  // section automatically when the active locale's array is empty.
  { id: "play-questions", label: "Play questions" },
  { id: "commerce", label: "Commerce" },
  { id: "seo", label: "SEO" },
];

export function ExperienceGameForm({
  gameId,
  defaultValues,
  allCategories,
  allTags,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const methods = useForm<ExperienceGameFormValues>({
    resolver: zodResolver(experienceGameSchema),
    defaultValues,
    mode: "onBlur",
  });

  const { register, watch, setValue, handleSubmit, formState } = methods;

  async function onSubmit(values: ExperienceGameFormValues) {
    setSaving(true);
    try {
      const res = await saveExperienceGame(gameId, values);
      if (!res.ok) {
        // Server-action error path: surface the first field error or _root.
        const errorMap = (res.error ?? {}) as Record<string, string[] | undefined>;
        const firstField = Object.keys(errorMap)[0];
        const firstMsg = errorMap[firstField ?? ""]?.[0] ?? "Save failed";
        // eslint-disable-next-line no-console
        console.warn("[ExperienceGameForm] save rejected:", errorMap);
        toast.error(firstMsg);
        return;
      }
      toast.success("Saved");
      if (!gameId) {
        router.push(`/dashboard/adults/games/${res.gameId}/edit`);
      }
      router.refresh();
    } catch (err) {
      // Unexpected throw from the server action (e.g. requireAdmin redirect,
      // network blip, RLS policy denial). Without this catch the rejection
      // is swallowed by the browser and the user sees nothing happen.
      // eslint-disable-next-line no-console
      console.error("[ExperienceGameForm] save threw:", err);
      const message =
        err instanceof Error ? err.message : "Unexpected error while saving";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  // Called by RHF when client-side Zod validation fails. Without this,
  // a validation failure made the submit silently no-op (handleSubmit
  // never runs onSubmit when validation fails). Now we surface the
  // first failing field as a toast AND log everything to the console
  // so the user has both immediate feedback and full diagnostics.
  function onInvalid(errors: FieldErrors<ExperienceGameFormValues>) {
    // Dump both the errors AND the values RHF actually has - when these
    // disagree with what the user sees in the inputs, the cause is almost
    // always a UI primitive that doesn't forward `ref`/`onChange` to the
    // native <input>, which prevents RHF from tracking the value.
    // eslint-disable-next-line no-console
    console.warn("[ExperienceGameForm] validation failed:", {
      errors,
      values: methods.getValues(),
    });
    const firstKey = Object.keys(errors)[0] as
      | keyof FieldErrors<ExperienceGameFormValues>
      | undefined;
    if (!firstKey) {
      toast.error("Validation failed");
      return;
    }
    const fieldErr = errors[firstKey];
    const message =
      (fieldErr && "message" in fieldErr && typeof fieldErr.message === "string"
        ? fieldErr.message
        : null) ?? `Invalid value in "${String(firstKey)}"`;
    toast.error(`${String(firstKey)}: ${message}`);
  }

  async function uploadImage(
    file: File,
    kind: "cover" | "gallery" | "badge-intimacy" | "badge-communication" | "badge-heat",
  ) {
    const client = createBrowserSupabaseClient();
    if (!client) {
      toast.error("Supabase is not configured");
      return;
    }
    setUploadingKey(kind);
    try {
      const ext = file.name.split(".").pop() ?? "webp";
      const path = `games/${kind}-${Date.now()}.${ext}`.replace(/\s+/g, "-");
      const { error: upErr } = await client.storage
        .from("between-us")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data } = client.storage.from("between-us").getPublicUrl(path);
      const url = data.publicUrl;

      if (kind === "cover") {
        setValue("cover_image_url", url, { shouldDirty: true });
      } else if (kind === "gallery") {
        const current = methods.getValues("gallery") ?? [];
        setValue("gallery", [...current, url].slice(0, 12), { shouldDirty: true });
      } else if (kind === "badge-intimacy") {
        setValue("intimacy_badge_url", url, { shouldDirty: true });
      } else if (kind === "badge-communication") {
        setValue("communication_badge_url", url, { shouldDirty: true });
      } else if (kind === "badge-heat") {
        setValue("heat_badge_url", url, { shouldDirty: true });
      }
      toast.success("Uploaded");
    } finally {
      setUploadingKey(null);
    }
  }

  const categoryIds = watch("category_ids") ?? [];
  const tagIds = watch("tag_ids") ?? [];
  const gallery = watch("gallery") ?? [];
  const coverUrl = watch("cover_image_url");
  const intimacyUrl = watch("intimacy_badge_url");
  const communicationUrl = watch("communication_badge_url");
  const heatUrl = watch("heat_badge_url");

  function toggleCategory(id: string) {
    const next = categoryIds.includes(id)
      ? categoryIds.filter((x) => x !== id)
      : [...categoryIds, id];
    setValue("category_ids", next, { shouldDirty: true });
  }
  function toggleTag(id: string) {
    const next = tagIds.includes(id)
      ? tagIds.filter((x) => x !== id)
      : [...tagIds, id];
    setValue("tag_ids", next, { shouldDirty: true });
  }

  return (
    <FormProvider {...methods}>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          // Pass `onInvalid` so client-side Zod failures actually reach the
          // user as a toast + console log instead of being silently dropped.
          void handleSubmit(onSubmit, onInvalid)(e);
        }}
      >
        {/* ---------- Sticky top bar ---------- */}
        <div className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 -mx-4 mb-6 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border sm:px-4">
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

        <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
          {/* ---------- Section jump nav ---------- */}
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

          {/* ---------- Main form column ---------- */}
          <div className="min-w-0 space-y-8">
            {/* ---------- BASICS ---------- */}
            <Section id="basics" title="Basics">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Slug" className="sm:col-span-2" errorFor="slug">
                  <Input
                    {...register("slug")}
                    className="font-mono"
                    placeholder="memory-lane"
                  />
                </Field>
                <Field label="Title (HE)" errorFor="title_he">
                  <Input
                    {...register("title_he")}
                    dir="rtl"
                    placeholder="זיכרונות משותפים"
                  />
                </Field>
                <Field label="Title (EN)" errorFor="title_en">
                  <Input {...register("title_en")} placeholder="Memory Lane" />
                </Field>
                <Field label="Short description (HE)">
                  <Textarea
                    {...register("short_desc_he")}
                    dir="rtl"
                    rows={2}
                    placeholder="תקציר קצר לכרטיס הראשי"
                  />
                </Field>
                <Field label="Short description (EN)">
                  <Textarea
                    {...register("short_desc_en")}
                    rows={2}
                    placeholder="Short tagline on the card"
                  />
                </Field>

                <InlineSwitchRow
                  label="New"
                  hint="Shows a “New” badge on the card."
                  checked={watch("is_new")}
                  onChange={(v) => setValue("is_new", v, { shouldDirty: true })}
                />
                <InlineSwitchRow
                  label="Popular"
                  hint="Shows a “Popular” badge on the card."
                  checked={watch("is_popular")}
                  onChange={(v) =>
                    setValue("is_popular", v, { shouldDirty: true })
                  }
                />
                <Field label="Sort weight" hint="Higher = earlier." errorFor="sort_weight">
                  <Input
                    type="number"
                    min={0}
                    max={9999}
                    // Use setValueAs so an empty input becomes 0 instead of
                    // NaN - `valueAsNumber: true` produces NaN on empty
                    // inputs and Zod's `z.number().int()` then rejects it
                    // silently, leaving the user unable to save with no clue
                    // why.
                    {...register("sort_weight", {
                      setValueAs: (v) =>
                        v === "" || v == null ? 0 : Number(v),
                    })}
                  />
                </Field>
                {/* D — scheduled "Coming Soon" open time (empty = immediate). */}
                <div className="sm:col-span-2">
                  <OpensAtField
                    value={watch("opens_at") ?? null}
                    onChange={(v) =>
                      setValue("opens_at", v, { shouldDirty: true })
                    }
                  />
                </div>
              </div>
            </Section>

            {/* ---------- COPY ---------- */}
            <Section id="copy" title="Copy">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full description (HE)">
                  <Textarea
                    {...register("full_desc_he")}
                    dir="rtl"
                    rows={7}
                    placeholder="תיאור מלא של המשחק"
                  />
                </Field>
                <Field label="Full description (EN)">
                  <Textarea
                    {...register("full_desc_en")}
                    rows={7}
                    placeholder="Full description"
                  />
                </Field>
              </div>

              <SubHeading>Benefits · פירוט יתרונות</SubHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <StringListColumn label="HE" dir="rtl" field="benefits_he" max={10} />
                <StringListColumn label="EN" dir="ltr" field="benefits_en" max={10} />
              </div>

              <SubHeading>Who it&apos;s for · למי מתאים</SubHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <StringListColumn
                  label="HE"
                  dir="rtl"
                  field="target_audience_he"
                  max={10}
                />
                <StringListColumn
                  label="EN"
                  dir="ltr"
                  field="target_audience_en"
                  max={10}
                />
              </div>
            </Section>

            {/* ---------- MEDIA ---------- */}
            <Section id="media" title="Media">
              <SubHeading>Cover image</SubHeading>
              <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
                <div className="bg-muted/30 flex aspect-video items-center justify-center overflow-hidden rounded-md border">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coverUrl}
                      alt="Cover"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground text-center text-xs">
                      1600 × 900
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Input
                    {...register("cover_image_url")}
                    placeholder="https://..."
                  />
                  <div className="flex gap-2">
                    <UploadButton
                      uploading={uploadingKey === "cover"}
                      onFile={(f) => uploadImage(f, "cover")}
                    />
                    {coverUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setValue("cover_image_url", null, {
                            shouldDirty: true,
                          })
                        }
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <SubHeading>
                Gallery{" "}
                <span className="text-muted-foreground text-xs">
                  ({gallery.length}/12)
                </span>
              </SubHeading>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {gallery.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative">
                    <div className="aspect-square overflow-hidden rounded-md border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      className="bg-background/80 absolute right-1 top-1 rounded-full border p-1"
                      onClick={() =>
                        setValue(
                          "gallery",
                          gallery.filter((_, i) => i !== idx),
                          { shouldDirty: true },
                        )
                      }
                      aria-label="Remove image"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                <UploadButton
                  uploading={uploadingKey === "gallery"}
                  onFile={(f) => uploadImage(f, "gallery")}
                  label="Add"
                  square
                  disabled={gallery.length >= 12}
                />
              </div>
            </Section>

            {/* ---------- METRICS ---------- */}
            <Section
              id="metrics"
              title="Visual metrics"
              hint="Level (1-5) and an optional WebP badge. Uses section default if empty."
            >
              <div className="grid gap-5 sm:grid-cols-3">
                <MetricEditor
                  label="Intimacy"
                  levelField="intimacy_level"
                  urlField="intimacy_badge_url"
                  url={intimacyUrl ?? null}
                  uploading={uploadingKey === "badge-intimacy"}
                  onUpload={(f) => uploadImage(f, "badge-intimacy")}
                />
                <MetricEditor
                  label="Communication"
                  levelField="communication_level"
                  urlField="communication_badge_url"
                  url={communicationUrl ?? null}
                  uploading={uploadingKey === "badge-communication"}
                  onUpload={(f) => uploadImage(f, "badge-communication")}
                />
                <MetricEditor
                  label="Heat"
                  levelField="heat_level"
                  urlField="heat_badge_url"
                  url={heatUrl ?? null}
                  uploading={uploadingKey === "badge-heat"}
                  onUpload={(f) => uploadImage(f, "badge-heat")}
                />
              </div>
            </Section>

            {/* ---------- TAXONOMY ---------- */}
            <Section id="taxonomy" title="Taxonomy">
              <SubHeading>Categories</SubHeading>
              {allCategories.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No categories yet.{" "}
                  <a
                    href="/dashboard/adults/categories"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Create one →
                  </a>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allCategories.map((c) => {
                    const selected = categoryIds.includes(c.id);
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => toggleCategory(c.id)}
                        className={
                          "rounded-full border px-3 py-1 text-xs transition-colors " +
                          (selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted")
                        }
                        aria-pressed={selected}
                      >
                        {c.name_he || c.name_en}
                      </button>
                    );
                  })}
                </div>
              )}

              <SubHeading>Tags</SubHeading>
              {allTags.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No tags yet.{" "}
                  <a
                    href="/dashboard/adults/tags"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Create one →
                  </a>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {allTags.map((t) => {
                    const selected = tagIds.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggleTag(t.id)}
                        className={
                          "rounded-full border px-3 py-1 text-xs transition-colors " +
                          (selected
                            ? "bg-secondary text-secondary-foreground border-secondary"
                            : "bg-background hover:bg-muted")
                        }
                        aria-pressed={selected}
                      >
                        {t.name_he || t.name_en}
                      </button>
                    );
                  })}
                </div>
              )}
            </Section>

            {/* ---------- PLAY QUESTIONS ----------
                Optional in-play reference list. Use it for games that
                ask players to answer a question when a physical event
                triggers (e.g. "draw a heart card"). Leave both lists
                empty for games that don't need this - the play page
                hides the whole section automatically. */}
            <Section
              id="play-questions"
              title="Play questions"
              hint="Optional. Display-only reference list shown on the post-purchase /play page."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Intro text (HE)"
                  hint={`${(watch("play_questions_intro_he") ?? "").length}/280`}
                >
                  <Textarea
                    {...register("play_questions_intro_he")}
                    dir="rtl"
                    rows={2}
                    maxLength={280}
                    placeholder='למשל: "השאלות של המשחק - מי שיצא לו עלה צריך לענות על אחת מהשאלות הבאות."'
                  />
                </Field>
                <Field
                  label="Intro text (EN)"
                  hint={`${(watch("play_questions_intro_en") ?? "").length}/280`}
                >
                  <Textarea
                    {...register("play_questions_intro_en")}
                    rows={2}
                    maxLength={280}
                    placeholder='e.g. "Whoever draws a leaf must answer one of these questions."'
                  />
                </Field>
              </div>

              <SubHeading>Questions list (in order)</SubHeading>
              <div className="grid gap-4 sm:grid-cols-2">
                <StringListColumn
                  label="HE"
                  dir="rtl"
                  field="play_questions_he"
                  max={30}
                />
                <StringListColumn
                  label="EN"
                  dir="ltr"
                  field="play_questions_en"
                  max={30}
                />
              </div>
            </Section>

            {/* ---------- COMMERCE ---------- */}
            <Section
              id="commerce"
              title="Commerce"
              hint="Leave price blank to use section default."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Price override (ILS ₪)">
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    placeholder="Default"
                    {...register("price_ils", {
                      setValueAs: (v) =>
                        v === "" || v == null ? null : Number(v),
                    })}
                  />
                </Field>
                <Field label="Price override (USD $)">
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    placeholder="Default"
                    {...register("price_usd", {
                      setValueAs: (v) =>
                        v === "" || v == null ? null : Number(v),
                    })}
                  />
                </Field>
                <InlineSwitchRow
                  className="sm:col-span-2"
                  label="Subscription eligible"
                  hint="Members can pick this game as their recurring unlock."
                  checked={watch("is_subscription_eligible")}
                  onChange={(v) =>
                    setValue("is_subscription_eligible", v, {
                      shouldDirty: true,
                    })
                  }
                />
              </div>
            </Section>

            {/* ---------- SEO ---------- */}
            <Section
              id="seo"
              title="SEO"
              hint="Falls back to title and short description when blank."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Meta title (HE)"
                  hint={`${(watch("meta_title_he") ?? "").length}/70`}
                >
                  <Input
                    {...register("meta_title_he")}
                    dir="rtl"
                    maxLength={70}
                  />
                </Field>
                <Field
                  label="Meta title (EN)"
                  hint={`${(watch("meta_title_en") ?? "").length}/70`}
                >
                  <Input {...register("meta_title_en")} maxLength={70} />
                </Field>
                <Field
                  label="Meta description (HE)"
                  hint={`${(watch("meta_description_he") ?? "").length}/160`}
                >
                  <Textarea
                    {...register("meta_description_he")}
                    dir="rtl"
                    rows={2}
                    maxLength={160}
                  />
                </Field>
                <Field
                  label="Meta description (EN)"
                  hint={`${(watch("meta_description_en") ?? "").length}/160`}
                >
                  <Textarea
                    {...register("meta_description_en")}
                    rows={2}
                    maxLength={160}
                  />
                </Field>
              </div>
            </Section>

            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="min-w-[160px]"
              >
                {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
                Save game
              </Button>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

/* ------------------------------------------------------------------
   Layout primitives - compact section + field wrappers
   ------------------------------------------------------------------ */

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: SectionId;
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

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground mt-5 text-xs font-medium uppercase tracking-wide first:mt-0">
      {children}
    </h3>
  );
}

function Field({
  label,
  hint,
  className,
  errorFor,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  /** Optional RHF field name - when set, renders the validation error
   *  message inline beneath the input. */
  errorFor?: keyof ExperienceGameFormValues;
  children: React.ReactNode;
}) {
  // Pull the live error for this field straight from the form context, if
  // a parent registered one. Avoids prop-drilling errors per field.
  const ctx = useFormContext<ExperienceGameFormValues>();
  const error =
    errorFor && ctx
      ? (ctx.formState.errors[errorFor] as { message?: string } | undefined)
      : undefined;

  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        {hint ? (
          <span className="text-muted-foreground text-[10px]">{hint}</span>
        ) : null}
      </div>
      {children}
      {error?.message ? (
        <p className="text-destructive text-[11px] leading-snug">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function InlineSwitchRow({
  label,
  hint,
  checked,
  onChange,
  className,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 " +
        (className ?? "")
      }
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? (
          <p className="text-muted-foreground text-xs">{hint}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/* ------------------------------------------------------------------
   String list column - inline repeating text inputs
   ------------------------------------------------------------------ */

type StringArrayField =
  | "benefits_he"
  | "benefits_en"
  | "target_audience_he"
  | "target_audience_en"
  | "play_questions_he"
  | "play_questions_en";

function StringListColumn({
  label,
  dir,
  field,
  max,
}: {
  label: string;
  dir: "rtl" | "ltr";
  field: StringArrayField;
  max: number;
}) {
  const methods = useFormContextSafe();
  const values = (methods.watch(field) ?? []) as string[];

  function setItem(idx: number, value: string) {
    const next = [...values];
    next[idx] = value;
    methods.setValue(field, next, { shouldDirty: true });
  }
  function addItem() {
    if (values.length >= max) return;
    methods.setValue(field, [...values, ""], { shouldDirty: true });
  }
  function removeItem(idx: number) {
    methods.setValue(
      field,
      values.filter((_, i) => i !== idx),
      { shouldDirty: true },
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="space-y-2">
        {values.length === 0 ? (
          <p className="text-muted-foreground text-xs italic">(empty)</p>
        ) : null}
        {values.map((val, idx) => (
          <div key={`${field}-${idx}`} className="flex items-center gap-2">
            <Input
              dir={dir}
              value={val ?? ""}
              onChange={(e) => setItem(idx, e.target.value)}
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(idx)}
              aria-label="Remove"
              className="shrink-0"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        disabled={values.length >= max}
      >
        <Plus className="me-1 size-4" />
        Add
      </Button>
    </div>
  );
}

function useFormContextSafe() {
  const ctx = useFormContext<ExperienceGameFormValues>();
  if (!ctx) throw new Error("Form context missing");
  return ctx;
}

/* ------------------------------------------------------------------
   Metric editor
   ------------------------------------------------------------------ */

function MetricEditor({
  label,
  levelField,
  urlField,
  url,
  uploading,
  onUpload,
}: {
  label: string;
  levelField: "intimacy_level" | "communication_level" | "heat_level";
  urlField: "intimacy_badge_url" | "communication_badge_url" | "heat_badge_url";
  url: string | null;
  uploading: boolean;
  onUpload: (f: File) => void;
}) {
  const methods = useFormContextSafe();
  const level = methods.watch(levelField);
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <Badge variant="outline" className="text-[10px]">
          Level {level}
        </Badge>
      </div>

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
            <div className="mt-0.5">Uses default</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <UploadButton
          uploading={uploading}
          onFile={onUpload}
          size="sm"
          label="Upload"
          className="flex-1"
        />
        {url ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              methods.setValue(urlField, null, { shouldDirty: true })
            }
          >
            Clear
          </Button>
        ) : null}
      </div>

      <input
        type="range"
        min={1}
        max={5}
        step={1}
        className="w-full"
        value={level ?? 3}
        onChange={(e) =>
          methods.setValue(levelField, Number(e.target.value), {
            shouldDirty: true,
          })
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------
   Upload button (regular & square-tile variants)
   ------------------------------------------------------------------ */

function UploadButton({
  uploading,
  onFile,
  label = "Upload",
  size = "default",
  disabled,
  square,
  className,
}: {
  uploading: boolean;
  onFile: (f: File) => void;
  label?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  square?: boolean;
  className?: string;
}) {
  if (square) {
    const disabledCls = disabled || uploading ? "pointer-events-none opacity-50" : "";
    return (
      <label
        className={
          "border-muted-foreground/30 bg-muted/20 hover:bg-muted/40 flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs transition-colors " +
          disabledCls +
          " " +
          (className ?? "")
        }
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        <span>{uploading ? "..." : label}</span>
        <input
          type="file"
          accept="image/webp,image/png,image/jpeg,image/svg+xml"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.currentTarget.value = "";
          }}
        />
      </label>
    );
  }

  const base =
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted";
  const sizeCls = size === "sm" ? "h-8 py-1 text-xs" : "h-9 py-2";
  const disabledCls = disabled || uploading ? "pointer-events-none opacity-50" : "";
  return (
    <label className={[base, sizeCls, disabledCls, className ?? ""].join(" ")}>
      {uploading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Upload className="size-4" />
      )}
      {uploading ? "Uploading..." : label}
      <input
        type="file"
        accept="image/webp,image/png,image/jpeg,image/svg+xml"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}
