import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListPrograms,
  getCategoryById,
  listItems,
  listSubtopics,
} from "@/lib/journey-content/queries";
import { CategoryForm } from "@/components/dashboard/journey/CategoryForm";
import { CategoryChildrenManager } from "@/components/dashboard/journey/CategoryChildrenManager";
import { HintIcon } from "@/components/ui/hint-icon";
import { ArrowLeft } from "lucide-react";
import type { JourneyCategoryFormValues } from "@/lib/journey-content/validations";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const category = await getCategoryById(params.id);
  if (!category) notFound();

  const [programs, subtopics, allItemsInCategory, directItems] =
    await Promise.all([
      adminListPrograms(),
      listSubtopics({ categoryId: category.id }),
      // All items in this category — used to compute per-subtopic counts
      // for the subtopics rail. A single fetch covers both.
      listItems({ categoryId: category.id }),
      // Items that hang directly off the category (no subtopic).
      listItems({ categoryId: category.id, subtopicId: null }),
    ]);

  // Per-subtopic item counts
  const itemCountBySubtopic = new Map<string, number>();
  for (const it of allItemsInCategory) {
    if (it.subtopic_id) {
      itemCountBySubtopic.set(
        it.subtopic_id,
        (itemCountBySubtopic.get(it.subtopic_id) ?? 0) + 1,
      );
    }
  }

  const subtopicRows = subtopics.map((s) => ({
    id: s.id,
    slug: s.slug,
    name_he: s.name_he,
    name_en: s.name_en,
    is_active: s.is_active,
    item_count: itemCountBySubtopic.get(s.id) ?? 0,
  }));

  const directItemRows = directItems.map((it) => ({
    id: it.id,
    slug: it.slug,
    title_he: it.title_he,
    title_en: it.title_en,
    is_active: it.is_active,
    default_offset_days: it.default_offset_days,
  }));

  const defaults: JourneyCategoryFormValues = {
    program_id: category.program_id,
    slug: category.slug,
    name_he: category.name_he,
    name_en: category.name_en ?? "",
    description_he: category.description_he ?? "",
    description_en: category.description_en ?? "",
    sort_order: category.sort_order,
    is_active: category.is_active,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/dashboard/journey/categories"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to categories
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {category.name_he}
        </h1>
        {category.assessment_priority_key ? (
          <p className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-xs">
            <span>
              Priority key:{" "}
              <code className="font-mono">
                {category.assessment_priority_key}
              </code>{" "}
              — used by the assessment ranking step.
            </span>
            <HintIcon topic="category.assessment_priority_key" />
          </p>
        ) : null}
      </div>

      <CategoryForm
        categoryId={category.id}
        defaultValues={defaults}
        programs={programs.map((p) => ({
          id: p.id,
          name_he: p.name_he,
          name_en: p.name_en,
        }))}
      />

      <CategoryChildrenManager
        categoryId={category.id}
        subtopics={subtopicRows}
        directItems={directItemRows}
      />
    </div>
  );
}
