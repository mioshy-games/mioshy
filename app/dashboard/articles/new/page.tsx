import { ArticleForm } from "@/components/dashboard/ArticleForm";
import { requireAdmin } from "@/lib/auth/admin";

export default async function NewArticlePage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New article</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Draft first. Publish when ready.
        </p>
      </div>
      <ArticleForm
        articleId={null}
        defaultValues={{
          slug: "",
          title_he: "",
          title_en: "",
          excerpt_he: "",
          excerpt_en: "",
          content_he: "",
          content_en: "",
          cover_image_url: "",
          author: "Itzik Berlav",
          is_published: false,
          meta_title_he: "",
          meta_title_en: "",
          meta_description_he: "",
          meta_description_en: "",
          canonical_url: "",
          og_image_url: "",
          tags_csv: "",
        }}
      />
    </div>
  );
}

