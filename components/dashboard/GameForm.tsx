"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { saveGame } from "@/app/dashboard/actions/save-game";
import { gameFormSchema, type GameFormValues } from "@/lib/validations";
import { useGameSettings } from "@/hooks/useGameSettings";
import { slugifyNameEn } from "@/lib/wheel-defaults";
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
import { SettingsSection, SectionGroupContext } from "@/components/settings/SettingsSection";
import { LocalizedFieldRow } from "@/components/dashboard/LocalizedFieldRow";
import { SliceEditor } from "@/components/dashboard/SliceEditor";
import { WheelFormSync } from "@/components/dashboard/WheelFormSync";
import { QuestionsTable } from "@/components/dashboard/QuestionsTable";
import { PageDesignEditor } from "@/components/settings/PageDesignEditor";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { QuestionRow } from "@/lib/types/database";

type GameFormProps = {
  gameId: string | null;
  defaultValues: GameFormValues;
  initialQuestions: QuestionRow[];
};

export function GameForm({
  gameId,
  defaultValues,
  initialQuestions,
}: GameFormProps) {
  const router = useRouter();
  // Visual settings (game_settings table) - save alongside the main form.
  // gameId is null for new games; in that case we skip the settings save.
  const { save: saveVisualSettings, isSaving: isSavingSettings } =
    useGameSettings(gameId ?? "");
  const slugTouched = useRef(false);
  // Reset the form only when we're loading a different game (mount or navigation).
  // Router refreshes would otherwise flow a new `defaultValues` reference down on
  // every render - even a subtly stale one - and overwrite the user's unsaved or
  // just-saved edits. By anchoring to gameId we keep the form authoritative once
  // it has been populated.
  const lastGameIdRef = useRef<string | null | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  // Top-level section expand / collapse
  const [formOpenVersion, setFormOpenVersion] = useState(0);
  const [formCloseVersion, setFormCloseVersion] = useState(0);

  const methods = useForm<GameFormValues>({
    resolver: zodResolver(gameFormSchema) as unknown as Resolver<GameFormValues>,
    defaultValues,
    mode: "onBlur",
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting, isDirty, errors },
    reset,
    setValue,
  } = methods;

  const slicesForCategories = useWatch({ control, name: "wheel.slices" }) as
    | Array<{ question_type?: string }>
    | undefined;
  const bgType = useWatch({ control, name: "bg_type" }) as string | undefined;
  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (slicesForCategories ?? [])
            .map((s) => String(s.question_type ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [slicesForCategories],
  );

  useEffect(() => {
    // Only reset when we're actually switching to a different game (or on first
    // mount). Router refreshes for the same game keep the user's current form
    // state - otherwise a delayed RSC re-render could silently wipe edits they
    // just made, which is what was happening when "Save" appeared to revert to
    // defaults.
    if (lastGameIdRef.current === gameId) return;
    lastGameIdRef.current = gameId;
    reset(defaultValues);
    // A fresh reset means the user hasn't touched the slug yet - allow SlugSync
    // to auto-fill from the English name again if the slug field is empty.
    slugTouched.current = false;
  }, [gameId, defaultValues, reset]); // slugTouched + lastGameIdRef are refs - intentionally omitted

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  async function onUploadThumbnail(file: File) {
    setUploading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("thumbnails")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) {
        toast.error(error.message);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("thumbnails").getPublicUrl(path);
      setValue("thumbnail_url", publicUrl, { shouldDirty: true });
      toast.success("Thumbnail uploaded");
    } finally {
      setUploading(false);
    }
  }

  async function onUploadBackground(file: File) {
    setUploadingBg(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("backgrounds")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (error) {
        toast.error(error.message);
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("backgrounds").getPublicUrl(path);
      setValue("bg_type", "image", { shouldDirty: true });
      setValue("bg_value", publicUrl, { shouldDirty: true });
      toast.success("Background uploaded");
    } finally {
      setUploadingBg(false);
    }
  }

  async function onSubmit(values: GameFormValues) {
    // ── Client-side save logging ──────────────────────────────────────────
    // Keep this verbose so a user hitting "save doesn't persist" can open the
    // browser console and immediately see (a) what we sent, (b) what came back,
    // and (c) whether the form was reset afterwards. We intentionally log the
    // full object - it's admin-only, so leaking the payload shape is fine.
    const saveStart = performance.now();
    console.log("[GameForm] ▶ onSubmit fired", {
      gameId,
      name_he: values.name_he,
      name_en: values.name_en,
      slug: values.slug,
      slicesCount: values.wheel.slices.length,
      categoriesCount: values.wheel.player_config.categories?.length ?? 0,
      isDirty,
    });

    let res: Awaited<ReturnType<typeof saveGame>>;
    try {
      res = await saveGame(gameId, values);
    } catch (err) {
      console.error("[GameForm] ✗ saveGame threw:", err);
      toast.error(
        err instanceof Error ? err.message : "Unexpected error calling saveGame",
      );
      return;
    }
    const elapsed = Math.round(performance.now() - saveStart);
    console.log("[GameForm] ◀ saveGame returned", { elapsedMs: elapsed, res });

    if (!res.ok) {
      if (typeof res.error === "string") {
        console.warn("[GameForm] save rejected:", res.error);
        toast.error(res.error);
      } else {
        console.warn("[GameForm] save rejected (validation):", res.error);
        toast.error("Please fix validation errors");
      }
      return;
    }

    // Confirm what the server says it persisted, if it echoed the row back.
    if ("savedName" in res && res.savedName) {
      console.log("[GameForm] ✓ server confirmed persisted name:", res.savedName);
    }

    // ── Also persist visual settings (game_settings table) ──────────────────
    // The InlineSettingsEditor populates the same Zustand store; we just flush
    // it here so the admin doesn't need a second "Save visual settings" button.
    if (gameId) {
      try {
        await saveVisualSettings();
        console.log("[GameForm] ✓ visual settings saved alongside game");
      } catch (err) {
        console.warn("[GameForm] ⚠ visual settings save failed (game itself was saved):", err);
        toast.error("Game saved - but visual settings failed. Try saving them again.");
      }
    }

    toast.success(gameId ? "Game saved" : "Game created");
    // Reset form to the values we JUST saved so isDirty returns to false without
    // waiting on the server round-trip. The gameId-gated useEffect will no longer
    // clobber these values on the subsequent router.refresh().
    reset(values);
    if (!gameId && res.id) {
      // New game: navigate to the edit page - full re-mount is fine.
      router.push(`/dashboard/games/${res.id}/edit`);
      router.refresh();
    } else {
      // Existing game: refresh the RSC so sibling server components (e.g. the
      // page's question list) pick up the new state. The form itself is already
      // locked to the saved values by the reset() above.
      router.refresh();
    }
  }

  return (
    <FormProvider {...methods}>
      <SlugSync slugTouched={slugTouched} />
      {/* Sync wheel form values → Zustand store so WheelPreviewPanel (in the
          page-level sticky EditGameSidebar) stays updated while the admin scrolls. */}
      <WheelFormSync />
      <form
        onSubmit={handleSubmit(onSubmit, (errors) => {
          console.error("[GameForm] ✗ Validation blocked submit:", errors);
          toast.error("שגיאת אימות - בדוק שדות אדומים (ייתכן בסקשן מקופל)");
        })}
        className="mx-auto max-w-4xl space-y-3"
      >
        {/* ── Section toolbar ───────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 pb-1">
          <Button type="button" variant="outline" size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setFormOpenVersion((v) => v + 1)}>
            <ChevronsUpDown className="w-3 h-3" />פתח הכל
          </Button>
          <Button type="button" variant="outline" size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setFormCloseVersion((v) => v + 1)}>
            <ChevronsDownUp className="w-3 h-3" />מזער הכל
          </Button>
        </div>

        <SectionGroupContext.Provider value={{ forceOpenVersion: formOpenVersion, forceCloseVersion: formCloseVersion }}>

        {/* ── Slices & categories ─────────────────────────────────────────── */}
        <SettingsSection title="Wheel slices" subtitle="עריכת פרוסות, קטגוריות ומספר הסיבובים" defaultOpen>
          <SliceEditor />
        </SettingsSection>

        {/* ── Game info ───────────────────────────────────────────────────── */}
        <SettingsSection title="Game details" subtitle="שם, תיאור, slug ותמונה" defaultOpen>
          <div className="space-y-6">
            <LocalizedFieldRow control={control} fieldBase="name" />
            <LocalizedFieldRow
              control={control}
              fieldBase="description"
              multiline
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Controller
                  control={control}
                  name="slug"
                  render={({ field }) => (
                    <Input
                      id="slug"
                      className="font-mono text-sm"
                      {...field}
                      onChange={(e) => {
                        slugTouched.current = true;
                        field.onChange(e);
                      }}
                    />
                  )}
                />
                {errors.slug ? (
                  <p className="text-xs text-destructive">
                    {errors.slug.message}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Lowercase letters, numbers, and hyphens. Filled from English
                    name when empty.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Active</Label>
                <Controller
                  control={control}
                  name="is_active"
                  render={({ field }) => (
                    <div className="flex h-10 items-center gap-2">
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                      <span className="text-muted-foreground text-sm">
                        {field.value ? "Published" : "Hidden"}
                      </span>
                    </div>
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Player mode</Label>
              <Controller
                control={control}
                name="player_mode"
                render={({ field }) => (
                  <div className="flex h-10 items-center gap-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <span className="text-muted-foreground text-sm">
                      {field.value ? "On" : "Off"}
                    </span>
                  </div>
                )}
              />
              <p className="text-muted-foreground text-xs">
                When enabled, the wheel will be built from player names (entered before the game starts).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Thumbnail</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-xs"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadThumbnail(f);
                    e.target.value = "";
                  }}
                />
                {uploading ? (
                  <Loader2 className="text-muted-foreground size-4 animate-spin" />
                ) : null}
              </div>
              <Controller
                control={control}
                name="thumbnail_url"
                render={({ field }) =>
                  field.value ? (
                    <p className="text-muted-foreground truncate text-xs">
                      {field.value}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      No image yet.
                    </p>
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Background</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <Controller
                    control={control}
                    name="bg_type"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v as "color" | "image")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="color">Color</SelectItem>
                          <SelectItem value="image">Image</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Value</Label>
                  <Controller
                    control={control}
                    name="bg_value"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        {/* Color picker - visible only when type = color */}
                        {bgType === "color" && (
                          <input
                            type="color"
                            value={field.value?.startsWith("#") ? field.value.slice(0, 7) : "#1a0a2e"}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="h-9 w-10 cursor-pointer rounded border border-input bg-transparent p-0.5"
                            title="Pick glow colour"
                          />
                        )}
                        <Input className="font-mono text-sm" {...field} />
                      </div>
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  className="max-w-xs"
                  disabled={uploadingBg}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadBackground(f);
                    e.target.value = "";
                  }}
                />
                {uploadingBg ? (
                  <Loader2 className="text-muted-foreground size-4 animate-spin" />
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                For images, upload to the <code className="text-xs">backgrounds</code>{" "}
                bucket. For colors, use a hex like <code className="text-xs">#0b0b0f</code>.
              </p>
            </div>
          </div>
        </SettingsSection>

        {/* ── Page & Background ───────────────────────────────────────────── */}
        {gameId && (
          <SettingsSection title="Page & Background" subtitle="רקע, חלקיקים, תנועה ופריסת עמוד" defaultOpen={false}>
            <PageDesignEditor gameId={gameId} />
          </SettingsSection>
        )}

        {/* ── SEO ─────────────────────────────────────────────────────────── */}
        <SettingsSection title="Search & social" subtitle="Meta titles, OG image ומילות מפתח" defaultOpen={false}>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="meta_title_he">Meta title (HE)</Label>
                <Controller
                  control={control}
                  name="meta_title_he"
                  render={({ field }) => (
                    <Input
                      id="meta_title_he"
                      placeholder="עד ~60 תווים. ישתמש בשם המשחק אם ריק."
                      dir="rtl"
                      {...field}
                      value={field.value ?? ""}
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meta_title_en">Meta title (EN)</Label>
                <Controller
                  control={control}
                  name="meta_title_en"
                  render={({ field }) => (
                    <Input
                      id="meta_title_en"
                      placeholder="Up to ~60 characters. Falls back to game name."
                      {...field}
                      value={field.value ?? ""}
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="meta_description_he">Meta description (HE)</Label>
                <Controller
                  control={control}
                  name="meta_description_he"
                  render={({ field }) => (
                    <Textarea
                      id="meta_description_he"
                      rows={3}
                      dir="rtl"
                      placeholder="עד ~160 תווים. תקציר שיופיע בתוצאות חיפוש."
                      {...field}
                      value={field.value ?? ""}
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meta_description_en">Meta description (EN)</Label>
                <Controller
                  control={control}
                  name="meta_description_en"
                  render={({ field }) => (
                    <Textarea
                      id="meta_description_en"
                      rows={3}
                      placeholder="Up to ~160 characters. Appears in Google snippet."
                      {...field}
                      value={field.value ?? ""}
                    />
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="og_image_url">Social share image (URL)</Label>
                <Controller
                  control={control}
                  name="og_image_url"
                  render={({ field }) => (
                    <Input
                      id="og_image_url"
                      placeholder="https://… 1200×630 recommended. Falls back to thumbnail."
                      {...field}
                      value={field.value ?? ""}
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sort_order">Sort order</Label>
                <Controller
                  control={control}
                  name="sort_order"
                  render={({ field }) => (
                    <Input
                      id="sort_order"
                      type="number"
                      step={1}
                      {...field}
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                    />
                  )}
                />
                <p className="text-muted-foreground text-xs">
                  Lower numbers appear first on the /games catalogue.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="keywords_csv">Keywords</Label>
              <Controller
                control={control}
                name="keywords_csv"
                render={({ field }) => (
                  <Input
                    id="keywords_csv"
                    placeholder="couples games, date night, truth or dare, …"
                    {...field}
                    value={field.value ?? ""}
                  />
                )}
              />
              <p className="text-muted-foreground text-xs">
                Comma-separated. Used for internal search and related-games
                suggestions (not rendered as deprecated meta keywords).
              </p>
            </div>
          </div>
        </SettingsSection>

        {/* ── Questions ─────────────────────────────────────────────────────── */}
        <SettingsSection title="Questions" subtitle={gameId ? "ניהול שאלות למשחק זה" : "שמור את המשחק תחילה להוספת שאלות"} defaultOpen={false}>
          <QuestionsTable
            gameId={gameId}
            initialQuestions={initialQuestions}
            categoryOptions={categoryOptions}
          />
        </SettingsSection>

        </SectionGroupContext.Provider>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting || isSavingSettings}>
            {isSubmitting || isSavingSettings ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save game"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset(defaultValues);
              toast.message("Changes discarded");
            }}
            disabled={isSubmitting || !isDirty}
          >
            Reset
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

function SlugSync({
  slugTouched,
}: {
  slugTouched: MutableRefObject<boolean>;
}) {
  const { watch, setValue, getValues } = useFormContext<GameFormValues>();
  const nameEn = watch("name_en");
  useEffect(() => {
    if (slugTouched.current) return;
    const current = getValues("slug");
    if (current && current.length > 0) return;
    const next = slugifyNameEn(nameEn || "");
    if (next) setValue("slug", next, { shouldValidate: true });
  }, [nameEn, getValues, setValue, slugTouched]);
  return null;
}
