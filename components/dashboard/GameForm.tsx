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
import { Loader2 } from "lucide-react";
import { saveGame } from "@/app/dashboard/actions/save-game";
import { gameFormSchema, type GameFormValues } from "@/lib/validations";
import { slugifyNameEn } from "@/lib/wheel-defaults";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocalizedFieldRow } from "@/components/dashboard/LocalizedFieldRow";
import { SliceEditor } from "@/components/dashboard/SliceEditor";
import { WheelPreview } from "@/components/dashboard/WheelPreview";
import { QuestionsTable } from "@/components/dashboard/QuestionsTable";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { QuestionRow, WheelSlice } from "@/lib/types/database";

type GameFormProps = {
  gameId: string | null;
  defaultValues: GameFormValues;
  initialQuestions: QuestionRow[];
};

function WheelPreviewSection() {
  const [labelLang, setLabelLang] = useState<"he" | "en">("he");
  const { control } = useFormContext<GameFormValues>();
  const slices = useWatch({ control, name: "wheel.slices" }) as
    | WheelSlice[]
    | undefined;
  const pointer = useWatch({ control, name: "wheel.pointer_color" }) as
    | string
    | undefined;
  const inner = useWatch({ control, name: "wheel.inner_circle" }) as
    | boolean
    | undefined;
  const innerColor = useWatch({
    control,
    name: "wheel.inner_circle_color",
  }) as string | undefined;
  const innerBorder = useWatch({
    control,
    name: "wheel.inner_circle_border_color",
  }) as string | undefined;
  const border = useWatch({ control, name: "wheel.border_color" }) as
    | string
    | undefined;
  const dividerEnabled = useWatch({ control, name: "wheel.divider_enabled" }) as
    | boolean
    | undefined;
  const dividerColor = useWatch({ control, name: "wheel.divider_color" }) as
    | string
    | undefined;
  const dividerWidth = useWatch({ control, name: "wheel.divider_width" }) as
    | number
    | undefined;
  const markerConfig = useWatch({ control, name: "wheel.marker_config" }) as
    | Record<string, unknown>
    | undefined;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Pointer color</Label>
            <ColorField name="wheel.pointer_color" />
          </div>
          <div className="space-y-1.5">
            <Label>Border color</Label>
            <ColorField name="wheel.border_color" />
          </div>
          <div className="space-y-1.5">
            <Label>Slice divider</Label>
            <DividerSwitch />
          </div>
          <div className="space-y-1.5">
            <Label>Divider color</Label>
            <ColorField name="wheel.divider_color" />
          </div>
          <div className="space-y-1.5">
            <Label>Divider width</Label>
            <DividerWidthField />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Markers</Label>
            <MarkerEditor />
          </div>
          <div className="space-y-1.5">
            <Label>Inner circle</Label>
            <InnerCircleSwitch />
          </div>
          <div className="space-y-1.5">
            <Label>Inner fill</Label>
            <ColorField name="wheel.inner_circle_color" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Inner border</Label>
            <ColorField name="wheel.inner_circle_border_color" />
          </div>
        </div>
      </div>
      <div className="flex w-full shrink-0 flex-col items-center gap-2 lg:w-[320px]">
        <Tabs
          value={labelLang}
          onValueChange={(v) => setLabelLang(v as "he" | "en")}
          className="w-full"
        >
          <TabsList className="grid w-full max-w-[200px] grid-cols-2">
            <TabsTrigger value="he">Preview HE</TabsTrigger>
            <TabsTrigger value="en">Preview EN</TabsTrigger>
          </TabsList>
        </Tabs>
        <WheelPreview
          slices={slices ?? []}
          pointerColor={pointer ?? "#ffffff"}
          borderColor={border ?? "#ffffff"}
          innerCircle={inner ?? true}
          innerCircleColor={innerColor ?? "#fafafa"}
          innerCircleBorderColor={innerBorder ?? "#e5e5e5"}
          labelLang={labelLang}
          dividerEnabled={dividerEnabled ?? true}
          dividerColor={dividerColor ?? "#ffffff"}
          dividerWidth={dividerWidth ?? 2}
          markerConfig={markerConfig ?? {}}
        />
        <p className="text-muted-foreground text-center text-xs">
          Divider: {dividerEnabled ? "On" : "Off"} ·{" "}
          <span className="font-mono">
            {dividerColor ?? "#ffffff"} / {dividerWidth ?? 2}px
          </span>
        </p>
      </div>
    </div>
  );
}

function InnerCircleSwitch() {
  const { control } = useFormContext<GameFormValues>();
  return (
    <Controller
      control={control}
      name="wheel.inner_circle"
      render={({ field }) => (
        <div className="flex h-10 items-center gap-2">
          <Switch checked={field.value} onCheckedChange={field.onChange} />
          <span className="text-muted-foreground text-sm">
            {field.value ? "On" : "Off"}
          </span>
        </div>
      )}
    />
  );
}

function DividerSwitch() {
  const { control } = useFormContext<GameFormValues>();
  return (
    <Controller
      control={control}
      name="wheel.divider_enabled"
      render={({ field }) => (
        <div className="flex h-10 items-center gap-2">
          <Switch checked={field.value} onCheckedChange={field.onChange} />
          <span className="text-muted-foreground text-sm">
            {field.value ? "On" : "Off"}
          </span>
        </div>
      )}
    />
  );
}

function DividerWidthField() {
  const { control } = useFormContext<GameFormValues>();
  return (
    <Controller
      control={control}
      name="wheel.divider_width"
      render={({ field }) => (
        <Input
          type="number"
          min={1}
          max={10}
          inputMode="numeric"
          className="font-mono text-sm"
          value={field.value}
          onChange={(e) => field.onChange(Number(e.target.value))}
        />
      )}
    />
  );
}

function MarkerEditor() {
  const { control } = useFormContext<GameFormValues>();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Controller
        control={control}
        name="wheel.marker_config.marker_type"
        render={({ field }) => (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Type</Label>
            <Select
              value={String(field.value)}
              onValueChange={(v) => field.onChange(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="svg_icon">SVG icon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      />

      <Controller
        control={control}
        name="wheel.marker_config.marker_color"
        render={({ field }) => (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                className="border-input h-10 w-14 shrink-0 cursor-pointer rounded-md border p-1"
                value={field.value || "#ffffff"}
                onChange={(e) => field.onChange(e.target.value)}
                aria-label="Pick marker color"
              />
              <Input
                className="font-mono text-sm"
                value={field.value}
                onChange={field.onChange}
              />
            </div>
          </div>
        )}
      />

      <Controller
        control={control}
        name="wheel.marker_config.marker_size"
        render={({ field }) => (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Size (px)</Label>
            <Input
              type="number"
              min={2}
              max={64}
              inputMode="numeric"
              className="font-mono text-sm"
              value={field.value ?? 14}
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          </div>
        )}
      />

      <Controller
        control={control}
        name="wheel.marker_config.marker_count"
        render={({ field }) => (
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Count</Label>
            <Input
              type="number"
              min={0}
              max={64}
              inputMode="numeric"
              className="font-mono text-sm"
              value={field.value ?? 0}
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          </div>
        )}
      />

      <Controller
        control={control}
        name="wheel.marker_config.marker_position"
        render={({ field }) => (
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">
              Position (% radius): {Math.round((field.value ?? 100) * 10) / 10}
            </Label>
            <input
              type="range"
              min={0}
              max={120}
              step={1}
              value={field.value ?? 100}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}
      />

      <Controller
        control={control}
        name="wheel.marker_config.svg_path_d"
        render={({ field }) => (
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-muted-foreground text-xs">
              SVG path (d)
            </Label>
            <Input
              className="font-mono text-xs"
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder="M10 20L..."
            />
          </div>
        )}
      />

      {/* ── Wheel size ─────────────────────────────────────────────────── */}
      <Controller
        control={control}
        name="wheel.marker_config.wheel_size_rem"
        render={({ field }) => {
          const val = typeof field.value === "number" ? field.value : 22;
          return (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">
                Wheel size — {val} rem ({Math.round(val * 16)}px)
              </Label>
              <input
                type="range"
                min={14}
                max={36}
                step={0.5}
                value={val}
                onChange={(e) => field.onChange(Number(e.target.value))}
                className="w-full accent-fuchsia-500"
              />
              <p className="text-muted-foreground text-[11px]">
                Only affects wheel diameter — all other settings stay unchanged. Default: 22 rem.
              </p>
            </div>
          );
        }}
      />

      {/* ── Label position (radial fraction) ───────────────────────────── */}
      <Controller
        control={control}
        name="wheel.marker_config.label_radius_fraction"
        render={({ field }) => {
          const val = typeof field.value === "number" ? field.value : 0.72;
          const pct = Math.round(val * 100);
          return (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-muted-foreground text-xs">
                Text position in slice — {pct}% from centre
              </Label>
              <input
                type="range"
                min={0.4}
                max={0.92}
                step={0.01}
                value={val}
                onChange={(e) => field.onChange(Number(e.target.value))}
                className="w-full accent-fuchsia-500"
              />
              <p className="text-muted-foreground text-[11px]">
                Higher % = text closer to outer rim. Default: 72%.
              </p>
            </div>
          );
        }}
      />
    </div>
  );
}

function ColorField({
  name,
}: {
  name:
    | "wheel.pointer_color"
    | "wheel.border_color"
    | "wheel.inner_circle_color"
    | "wheel.inner_circle_border_color"
    | "wheel.divider_color";
}) {
  const { control } = useFormContext<GameFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex gap-2">
          <input
            type="color"
            className="border-input h-10 w-14 shrink-0 cursor-pointer rounded-md border p-1"
            value={field.value || "#000000"}
            onChange={(e) => field.onChange(e.target.value)}
            aria-label="Pick color"
          />
          <Input
            className="font-mono text-sm"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        </div>
      )}
    />
  );
}

export function GameForm({
  gameId,
  defaultValues,
  initialQuestions,
}: GameFormProps) {
  const router = useRouter();
  const slugTouched = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const methods = useForm<GameFormValues>({
    resolver: zodResolver(gameFormSchema) as unknown as Resolver<GameFormValues>,
    defaultValues,
    mode: "onBlur",
  });

  const {
    handleSubmit,
    control,
    formState: { isSubmitting, isDirty },
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
    reset(defaultValues);
  }, [defaultValues, reset]);

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
    const res = await saveGame(gameId, values);
    if (!res.ok) {
      if (typeof res.error === "string") {
        toast.error(res.error);
      } else {
        toast.error("Please fix validation errors");
      }
      return;
    }
    toast.success(gameId ? "Game saved" : "Game created");
    reset(values);
    if (!gameId && res.id) {
      router.push(`/dashboard/games/${res.id}/edit`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  return (
    <FormProvider {...methods}>
      <SlugSync slugTouched={slugTouched} />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-4xl space-y-8"
      >
        <Card>
          <CardHeader>
            <CardTitle>Game details</CardTitle>
            <CardDescription>
              Names, description, URL slug, and thumbnail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
                <p className="text-muted-foreground text-xs">
                  Lowercase letters, numbers, and hyphens. Filled from English
                  name when empty.
                </p>
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
                        {/* Color picker — visible only when type = color */}
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
          </CardContent>
        </Card>

        {/* ──────────────── SEO / Discovery ──────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Search & social</CardTitle>
            <CardDescription>
              Override how this game appears on Google and when shared on
              WhatsApp / Facebook / X. Leave fields empty to use the name &
              description above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wheel appearance</CardTitle>
            <CardDescription>
              Colors and live preview of the wheel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WheelPreviewSection />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wheel slices</CardTitle>
            <CardDescription>
              Labels per language, colors, and question type per slice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SliceEditor />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>
              {gameId
                ? "Manage questions for this game."
                : "Save the game first to add questions."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionsTable
              gameId={gameId}
              initialQuestions={initialQuestions}
              categoryOptions={categoryOptions}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
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
