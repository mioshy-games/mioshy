"use client";

// Markdown editor styles are imported here (only with the editor component)
// instead of in app/globals.css so they don't ship in every page bundle —
// they were the dominant contributor to the unused-css-rules audit failure
// (~37 KB of editor styles loaded on every public page).
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { ArticleFormInput, articleFormSchema } from "@/lib/validations";
import { saveArticle } from "@/app/dashboard/actions/articles";
import { slugifyTitleEn, estimateReadingTimeMinutes } from "@/lib/articles";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

export function ArticleForm({
  articleId,
  defaultValues,
}: {
  articleId: string | null;
  defaultValues: ArticleFormInput;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const methods = useForm<ArticleFormInput>({
    resolver: zodResolver(articleFormSchema),
    defaultValues,
    mode: "onBlur",
  });

  const titleEn = methods.watch("title_en") ?? "";
  const contentEn = methods.watch("content_en") ?? "";
  const contentHe = methods.watch("content_he") ?? "";
  const isPublished = methods.watch("is_published") ?? false;
  const coverUrl = methods.watch("cover_image_url") ?? "";

  const faqArray = useFieldArray({ control: methods.control, name: "faq" });
  const barsArray = useFieldArray({
    control: methods.control,
    name: "graph.bars",
  });

  const readingTime = useMemo(() => {
    const base = (contentEn.trim() || contentHe.trim() || "").trim();
    return estimateReadingTimeMinutes(base);
  }, [contentEn, contentHe]);

  useEffect(() => {
    const currentSlug = (methods.getValues("slug") ?? "").trim();
    if (currentSlug) return;
    const candidate = slugifyTitleEn(titleEn || "");
    if (candidate) {
      methods.setValue("slug", candidate, { shouldDirty: true });
    }
  }, [methods, titleEn]);

  async function onSubmit(values: ArticleFormInput) {
    setSaving(true);
    const res = await saveArticle(articleId, values);
    setSaving(false);
    if (!res.ok) {
      toast.error("Save failed");
      return;
    }
    toast.success(values.is_published ? "Saved & published" : "Saved");
    if (!articleId) {
      router.push(`/dashboard/articles/${res.id}/edit`);
    }
    router.refresh();
  }

  async function uploadCover(file: File) {
    const client = createBrowserSupabaseClient();
    if (!client) {
      toast.error("Supabase is not configured");
      return;
    }
    setUploading(true);
    try {
      const path = `covers/${Date.now()}-${file.name}`.replace(/\s+/g, "-");
      const { error: upErr } = await client.storage
        .from("article-covers")
        .upload(path, file, { upsert: true });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data } = client.storage.from("article-covers").getPublicUrl(path);
      methods.setValue("cover_image_url", data.publicUrl, { shouldDirty: true });
      toast.success("Cover uploaded");
    } finally {
      setUploading(false);
    }
  }

  // Upload an image and append it into the HE body as markdown at the end.
  async function uploadBodyImage(file: File) {
    const client = createBrowserSupabaseClient();
    if (!client) {
      toast.error("Supabase is not configured");
      return;
    }
    setUploading(true);
    try {
      const path = `body/${Date.now()}-${file.name}`.replace(/\s+/g, "-");
      const { error: upErr } = await client.storage
        .from("article-covers")
        .upload(path, file, { upsert: true });
      if (upErr) {
        toast.error(upErr.message);
        return;
      }
      const { data } = client.storage.from("article-covers").getPublicUrl(path);
      const cur = methods.getValues("content_he") ?? "";
      methods.setValue("content_he", `${cur}\n\n![](${data.publicUrl})\n`, {
        shouldDirty: true,
      });
      toast.success("תמונה נוספה לגוף (עברית) — הזז אותה למקום הרצוי");
    } finally {
      setUploading(false);
    }
  }

  return (
    <FormProvider {...methods}>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void methods.handleSubmit(onSubmit)(e);
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Title (EN)</Label>
              <Input {...methods.register("title_en")} placeholder="English title" />
            </div>
            <div className="space-y-2">
              <Label>Title (HE)</Label>
              <Input {...methods.register("title_he")} placeholder="כותרת בעברית" />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Slug</Label>
              <Input
                {...methods.register("slug")}
                placeholder="lowercase-slug"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Author</Label>
              <Input {...methods.register("author")} />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Published</p>
                <p className="text-muted-foreground text-xs">
                  Reading time: ~{readingTime} min
                </p>
              </div>
              <Switch
                checked={Boolean(isPublished)}
                onCheckedChange={(v) => methods.setValue("is_published", v, { shouldDirty: true })}
              />
            </div>

            <div className="space-y-2 rounded-lg border p-3 sm:col-span-2">
              <Label>Scheduled publish (empty = immediate)</Label>
              <Input
                type="datetime-local"
                {...methods.register("scheduled_publish_at")}
              />
              <p className="text-muted-foreground text-xs">
                Until this time the article is fully hidden from the public — 404,
                and absent from /articles, the sitemap and “more articles”. It
                goes live automatically at the set moment (needs “Published” on).
                Change the time any moment before it publishes.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>תמונת שער (מוצגת בהירו במקום הגרדיאנט)</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  {...methods.register("cover_image_url")}
                  placeholder="https://..."
                />
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
                  <Upload className="size-4" />
                  {uploading ? "מעלה..." : coverUrl ? "החלף" : "העלה"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadCover(f);
                      e.currentTarget.value = "";
                    }}
                    disabled={uploading}
                  />
                </label>
                {coverUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      methods.setValue("cover_image_url", "", { shouldDirty: true })
                    }
                  >
                    הסר
                  </Button>
                ) : null}
              </div>
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverUrl}
                  alt=""
                  className="mt-2 h-40 w-full rounded-lg object-cover"
                />
              ) : (
                <p className="text-muted-foreground text-xs">
                  אין תמונת שער — ההירו יוצג כגרדיאנט עם אימוג׳י.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Excerpt (EN)</Label>
              <Textarea {...methods.register("excerpt_en")} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Excerpt (HE)</Label>
              <Textarea {...methods.register("excerpt_he")} rows={4} dir="rtl" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="space-y-2">
              <Label>Content (EN)</Label>
              <div data-color-mode="dark">
                <MDEditor
                  value={contentEn}
                  onChange={(v) =>
                    methods.setValue("content_en", v ?? "", { shouldDirty: true })
                  }
                  height={360}
                  preview="live"
                  visibleDragbar={false}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Content (HE)</Label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium">
                  <Upload className="size-3.5" />
                  {uploading ? "מעלה..." : "העלה תמונה לגוף"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadBodyImage(f);
                      e.currentTarget.value = "";
                    }}
                    disabled={uploading}
                  />
                </label>
              </div>
              <div dir="rtl" data-color-mode="dark">
                <MDEditor
                  value={contentHe}
                  onChange={(v) =>
                    methods.setValue("content_he", v ?? "", { shouldDirty: true })
                  }
                  height={360}
                  preview="live"
                  visibleDragbar={false}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                טוקן <code>{"{{graph}}"}</code> בגוף = מיקום הגרף. קישור עם כותרת
                <code> &quot;cta&quot;</code> = כפתור מותג. תמונות: <code>![](url)</code>.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Meta title (EN) (max ~60)</Label>
              <Input {...methods.register("meta_title_en")} />
              <p className="text-muted-foreground text-xs">
                {(methods.watch("meta_title_en") ?? "").length}/60
              </p>
            </div>
            <div className="space-y-2">
              <Label>Meta title (HE) (max ~60)</Label>
              <Input {...methods.register("meta_title_he")} dir="rtl" />
              <p className="text-muted-foreground text-xs">
                {(methods.watch("meta_title_he") ?? "").length}/60
              </p>
            </div>
            <div className="space-y-2">
              <Label>Meta description (EN) (max ~160)</Label>
              <Textarea {...methods.register("meta_description_en")} rows={3} />
              <p className="text-muted-foreground text-xs">
                {(methods.watch("meta_description_en") ?? "").length}/160
              </p>
            </div>
            <div className="space-y-2">
              <Label>Meta description (HE) (max ~160)</Label>
              <Textarea {...methods.register("meta_description_he")} rows={3} dir="rtl" />
              <p className="text-muted-foreground text-xs">
                {(methods.watch("meta_description_he") ?? "").length}/160
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Canonical URL (optional)</Label>
              <Input {...methods.register("canonical_url")} placeholder="https://..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>OG image URL (optional, defaults to cover)</Label>
              <Input {...methods.register("og_image_url")} placeholder="https://..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Tags (comma-separated)</Label>
              <Input {...methods.register("tags_csv")} placeholder="intimacy, communication, date night" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>שאלות ותשובות (FAQ)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-xs">
              מופיע במאמר וכסכמת FAQPage לגוגל (״שאלות שאנשים שואלים״).
            </p>
            {faqArray.fields.map((f, i) => (
              <div key={f.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label>שאלה {i + 1}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => faqArray.remove(i)}
                  >
                    הסר
                  </Button>
                </div>
                <Input
                  {...methods.register(`faq.${i}.q`)}
                  dir="rtl"
                  placeholder="השאלה"
                />
                <Textarea
                  {...methods.register(`faq.${i}.a`)}
                  dir="rtl"
                  rows={3}
                  placeholder="התשובה"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => faqArray.append({ q: "", a: "" })}
            >
              + הוסף שאלה
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>גרף (אופציונלי)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-xs">
              מוצג במקום הטוקן <code>{"{{graph}}"}</code> בגוף המאמר. בלי עמודות —
              לא מוצג גרף.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>כותרת הגרף</Label>
                <Input {...methods.register("graph.title")} dir="rtl" />
              </div>
              <div className="space-y-2">
                <Label>מקור</Label>
                <Input {...methods.register("graph.source")} dir="rtl" />
              </div>
            </div>
            {barsArray.fields.map((b, i) => (
              <div
                key={b.id}
                className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
              >
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">תווית</Label>
                  <Input
                    {...methods.register(`graph.bars.${i}.label`)}
                    dir="rtl"
                    placeholder="2024"
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-xs">ערך</Label>
                  <Input
                    type="number"
                    step="any"
                    {...methods.register(`graph.bars.${i}.value`)}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">תצוגה</Label>
                  <Input
                    {...methods.register(`graph.bars.${i}.display`)}
                    placeholder="37%"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => barsArray.remove(i)}
                >
                  הסר
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                barsArray.append({ label: "", value: 0, display: "" })
              }
            >
              + הוסף עמודה
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="submit"
            disabled={saving || uploading}
            className="min-w-[160px]"
          >
            {saving ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

