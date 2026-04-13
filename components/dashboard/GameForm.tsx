"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        />
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

function ColorField({
  name,
}: {
  name:
    | "wheel.pointer_color"
    | "wheel.border_color"
    | "wheel.inner_circle_color"
    | "wheel.inner_circle_border_color";
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

  const methods = useForm<GameFormValues>({
    resolver: zodResolver(gameFormSchema),
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
