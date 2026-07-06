"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { articleFormSchema } from "@/lib/validations";
import { estimateReadingTimeMinutes, israelWallToUtcIso } from "@/lib/articles";

export async function toggleArticlePublished(articleId: string, publish: boolean) {
  const { supabase } = await requireAdmin();
  const payload = publish
    ? { is_published: true, published_at: new Date().toISOString() }
    : { is_published: false, published_at: null };

  const { error } = await supabase.from("articles").update(payload).eq("id", articleId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/articles");
  revalidatePath("/en/articles");
  revalidatePath("/he/articles");
  return { ok: true as const };
}

export async function deleteArticle(articleId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("articles").delete().eq("id", articleId);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard/articles");
  revalidatePath("/en/articles");
  revalidatePath("/he/articles");
  return { ok: true as const };
}

export async function saveArticle(articleId: string | null, raw: unknown) {
  const parsed = articleFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }

  const v = parsed.data;
  const { supabase } = await requireAdmin();

  const cover_image_url =
    v.cover_image_url && v.cover_image_url !== "" ? v.cover_image_url : null;

  const canonical_url =
    v.canonical_url && v.canonical_url !== "" ? v.canonical_url : null;

  const og_image_url =
    v.og_image_url && v.og_image_url !== ""
      ? v.og_image_url
      : cover_image_url;

  const tags = (v.tags_csv ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const contentForReading =
    (v.content_en && v.content_en.trim()) ||
    (v.content_he && v.content_he.trim()) ||
    "";
  const reading_time_minutes = estimateReadingTimeMinutes(contentForReading);

  // Timed publishing. A `datetime-local` value is browser-local; normalise to
  // UTC ISO. published_at tracks the intended publish moment (= the schedule
  // when set) so the displayed date is correct the instant it goes live.
  const scheduledIso =
    v.scheduled_publish_at && v.scheduled_publish_at.trim()
      ? israelWallToUtcIso(v.scheduled_publish_at.trim())
      : null;
  const willPublish = Boolean(v.is_published);
  const published_at = willPublish
    ? scheduledIso ?? new Date().toISOString()
    : null;

  // FAQ + graph: drop empty rows; a graph with no bars stores as null.
  const faqClean = (v.faq ?? []).filter(
    (f) => (f.q ?? "").trim() && (f.a ?? "").trim(),
  );
  const graphBars = (v.graph?.bars ?? []).filter(
    (b) => (b.label ?? "").trim() !== "" && Number.isFinite(b.value),
  );
  // The admin editor only handles single-series bars. When it has bars, save
  // them; when it's EMPTY we OMIT graph from the update entirely rather than
  // null it, so a grouped-bars graph seeded outside the admin (e.g. article 2)
  // is never silently wiped by editing that article's text.
  const graphPatch =
    graphBars.length > 0
      ? {
          graph: {
            type: "bars" as const,
            title: v.graph?.title?.trim() || undefined,
            source: v.graph?.source?.trim() || undefined,
            bars: graphBars.map((b) => ({
              label: b.label.trim(),
              value: b.value,
              display: b.display?.trim() || undefined,
            })),
          },
        }
      : {};

  const payload = {
    slug: v.slug,
    scheduled_publish_at: scheduledIso,
    faq: faqClean.length > 0 ? faqClean : null,
    ...graphPatch,
    title_he: (v.title_he ?? "").trim() || null,
    title_en: (v.title_en ?? "").trim() || null,
    excerpt_he: (v.excerpt_he ?? "").trim() || null,
    excerpt_en: (v.excerpt_en ?? "").trim() || null,
    content_he: (v.content_he ?? "").trim() || null,
    content_en: (v.content_en ?? "").trim() || null,
    cover_image_url,
    author: v.author,
    is_published: willPublish,
    published_at,
    meta_title_he: (v.meta_title_he ?? "").trim() || null,
    meta_title_en: (v.meta_title_en ?? "").trim() || null,
    meta_description_he: (v.meta_description_he ?? "").trim() || null,
    meta_description_en: (v.meta_description_en ?? "").trim() || null,
    canonical_url,
    og_image_url,
    tags,
    reading_time_minutes,
  };

  if (articleId) {
    const { error } = await supabase.from("articles").update(payload).eq("id", articleId);
    if (error) return { ok: false as const, error: error.message };
    revalidatePath("/dashboard/articles");
    revalidatePath(`/dashboard/articles/${articleId}/edit`);
    revalidatePath("/en/articles");
    revalidatePath("/he/articles");
    revalidatePath(`/he/articles/${v.slug}`);
    revalidatePath(`/en/articles/${v.slug}`);
    return { ok: true as const, id: articleId };
  }

  const { data: inserted, error } = await supabase
    .from("articles")
    .insert(payload)
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false as const, error: error?.message ?? "Insert failed" };
  }

  revalidatePath("/dashboard/articles");
  revalidatePath("/en/articles");
  revalidatePath("/he/articles");
  return { ok: true as const, id: inserted.id as string };
}

