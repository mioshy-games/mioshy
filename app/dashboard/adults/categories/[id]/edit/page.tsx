import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { CategoryForm } from "@/components/dashboard/between-us/CategoryForm";
import { ArrowLeft } from "lucide-react";
import type { ExperienceGameCategoryFormValues } from "@/lib/between-us/validations";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { data: category } = await supabase
    .from("experience_game_categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!category) return notFound();

  const defaultValues: ExperienceGameCategoryFormValues = {
    slug: category.slug,
    name_he: category.name_he ?? "",
    name_en: category.name_en ?? "",
    description_he: category.description_he ?? "",
    description_en: category.description_en ?? "",
    icon_url: category.icon_url ?? null,
    color_hex: category.color_hex ?? null,
    sort_weight: category.sort_weight ?? 0,
    is_active: category.is_active,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/adults/categories"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to categories
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {category.name_he || category.name_en || "Untitled category"}
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          {category.slug}
        </p>
      </div>

      <CategoryForm categoryId={category.id} defaultValues={defaultValues} />
    </div>
  );
}
