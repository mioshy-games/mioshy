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
import { FormProvider, useForm } from "react-hook-form";
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

            <div className="space-y-2 sm:col-span-2">
              <Label>Cover image URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  {...methods.register("cover_image_url")}
                  placeholder="https://..."
                />
                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
                  <Upload className="size-4" />
                  {uploading ? "Uploading..." : "Upload"}
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
              </div>
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
                  value={methods.getValues("content_en") ?? ""}
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
              <Label>Content (HE)</Label>
              <div dir="rtl" data-color-mode="dark">
                <MDEditor
                  value={methods.getValues("content_he") ?? ""}
                  onChange={(v) =>
                    methods.setValue("content_he", v ?? "", { shouldDirty: true })
                  }
                  height={360}
                  preview="live"
                  visibleDragbar={false}
                />
              </div>
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

