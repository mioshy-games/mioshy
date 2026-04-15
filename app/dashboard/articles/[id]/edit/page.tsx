import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/dashboard/ArticleForm";
import { requireAdmin } from "@/lib/auth/admin";

export default async function EditArticlePage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase } = await requireAdmin();
  const { id } = params;

  const { data: a, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !a) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit article</h1>
        <p className="text-muted-foreground mt-1 text-sm font-mono">{id}</p>
      </div>
      <ArticleForm
        articleId={id}
        defaultValues={{
          slug: a.slug ?? "",
          title_he: a.title_he ?? "",
          title_en: a.title_en ?? "",
          excerpt_he: a.excerpt_he ?? "",
          excerpt_en: a.excerpt_en ?? "",
          content_he: a.content_he ?? "",
          content_en: a.content_en ?? "",
          cover_image_url: a.cover_image_url ?? "",
          author: a.author ?? "Itzik Berlav",
          is_published: Boolean(a.is_published),
          meta_title_he: a.meta_title_he ?? "",
          meta_title_en: a.meta_title_en ?? "",
          meta_description_he: a.meta_description_he ?? "",
          meta_description_en: a.meta_description_en ?? "",
          canonical_url: a.canonical_url ?? "",
          og_image_url: a.og_image_url ?? "",
          tags_csv: Array.isArray(a.tags) ? a.tags.join(", ") : "",
        }}
      />
    </div>
  );
}

