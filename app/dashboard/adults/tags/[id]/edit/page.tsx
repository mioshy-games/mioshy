import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { TagForm } from "@/components/dashboard/between-us/TagForm";
import { ArrowLeft } from "lucide-react";
import type { ExperienceGameTagFormValues } from "@/lib/between-us/validations";

export const dynamic = "force-dynamic";

export default async function EditTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { data: tag } = await supabase
    .from("experience_game_tags")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!tag) return notFound();

  const defaultValues: ExperienceGameTagFormValues = {
    slug: tag.slug,
    name_he: tag.name_he ?? "",
    name_en: tag.name_en ?? "",
    color_hex: tag.color_hex ?? null,
    is_active: tag.is_active,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/adults/tags"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to tags
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {tag.name_he || tag.name_en || "Untitled tag"}
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          {tag.slug}
        </p>
      </div>

      <TagForm tagId={tag.id} defaultValues={defaultValues} />
    </div>
  );
}
