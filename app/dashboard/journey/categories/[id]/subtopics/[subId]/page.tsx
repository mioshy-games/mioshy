import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getCategoryById,
  getSubtopicById,
  listItems,
} from "@/lib/journey-content/queries";
import { SubtopicForm } from "@/components/dashboard/journey/SubtopicForm";
import { SubtopicItemsManager } from "@/components/dashboard/journey/SubtopicItemsManager";
import { ArrowLeft } from "lucide-react";
import type { JourneySubtopicFormValues } from "@/lib/journey-content/validations";

export const dynamic = "force-dynamic";

export default async function EditSubtopicPage({
  params,
}: {
  params: { id: string; subId: string };
}) {
  await requireAdmin();
  const [category, subtopic] = await Promise.all([
    getCategoryById(params.id),
    getSubtopicById(params.subId),
  ]);
  if (!category || !subtopic) notFound();
  if (subtopic.category_id !== category.id) notFound();

  const items = await listItems({
    categoryId: category.id,
    subtopicId: subtopic.id,
  });

  const itemRows = items.map((it) => ({
    id: it.id,
    slug: it.slug,
    title_he: it.title_he,
    title_en: it.title_en,
    is_active: it.is_active,
    default_offset_days: it.default_offset_days,
  }));

  const defaults: JourneySubtopicFormValues = {
    category_id: subtopic.category_id,
    slug: subtopic.slug,
    name_he: subtopic.name_he,
    name_en: subtopic.name_en ?? "",
    description_he: subtopic.description_he ?? "",
    description_en: subtopic.description_en ?? "",
    sort_order: subtopic.sort_order,
    is_active: subtopic.is_active,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href={`/dashboard/journey/categories/${category.id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to {category.name_he}
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {subtopic.name_he}
        </h1>
        <p className="text-muted-foreground mt-1 text-xs">
          Subtopic of{" "}
          <Link
            href={`/dashboard/journey/categories/${category.id}`}
            className="hover:underline"
          >
            {category.name_he}
          </Link>
        </p>
      </div>

      <SubtopicForm
        subtopicId={subtopic.id}
        categoryId={category.id}
        defaultValues={defaults}
      />

      <SubtopicItemsManager
        categoryId={category.id}
        subtopicId={subtopic.id}
        items={itemRows}
      />
    </div>
  );
}
