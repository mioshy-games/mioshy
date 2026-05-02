import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  adminListAllSubtopics,
  adminListCategoriesWithItemCounts,
  adminListPrograms,
  getItemById,
} from "@/lib/journey-content/queries";
import { getItemLiveStats } from "@/lib/journey-content/observability";
import { ItemForm } from "@/components/dashboard/journey/ItemForm";
import type {
  CategoryOption,
  SubtopicOption,
} from "@/components/dashboard/journey/ItemForm";
import { ItemLiveStatsSidebar } from "@/components/dashboard/journey/ItemLiveStatsSidebar";
import { ItemPropagationActions } from "@/components/dashboard/journey/ItemPropagationActions";
import { AssessmentEditor } from "@/components/dashboard/journey/AssessmentEditor";
import { ArrowLeft } from "lucide-react";
import type { JourneyItemFormValues } from "@/lib/journey-content/validations";
import type {
  JourneyItemKind,
  JourneyAssessmentPayload,
} from "@/lib/journey-content/types";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const item = await getItemById(params.id);
  if (!item) notFound();

  const [categories, programs, subtopics, liveStats] = await Promise.all([
    adminListCategoriesWithItemCounts(),
    adminListPrograms(),
    adminListAllSubtopics(),
    getItemLiveStats(item.id),
  ]);
  const programNameById = new Map(programs.map((p) => [p.id, p.name_he] as const));

  const categoryOptions: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    label: c.name_he,
    program_label: c.program_id
      ? programNameById.get(c.program_id) ?? null
      : null,
  }));

  const subtopicOptions: SubtopicOption[] = subtopics.map((s) => ({
    id: s.id,
    category_id: s.category_id,
    label: s.name_he,
  }));

  const defaults: JourneyItemFormValues = {
    category_id: item.category_id,
    subtopic_id: item.subtopic_id ?? "",
    slug: item.slug,
    title_he: item.title_he,
    title_en: item.title_en ?? "",
    body_he: item.body_he,
    body_en: item.body_en ?? "",
    task_he: item.task_he ?? "",
    task_en: item.task_en ?? "",
    challenge_he: item.challenge_he ?? "",
    challenge_en: item.challenge_en ?? "",
    video_url: item.video_url ?? "",
    image_url: item.image_url ?? "",
    sort_order: item.sort_order,
    default_offset_days: item.default_offset_days,
    is_active: item.is_active,
    audience: (item.audience ?? "both") as "both" | "owner" | "partner",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          href="/dashboard/journey/items"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to items
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {item.title_he}
        </h1>
      </div>

      {/* Two-column layout: editor on the left, live-stats rail on
          the right. Stacks to single column at < lg. */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <ItemForm
            itemId={item.id}
            defaultValues={defaults}
            categories={categoryOptions}
            subtopics={subtopicOptions}
          />

          {/* Phase 3 step 3 — assessment / reflection editor.
              Available on every item; for content items it just shows the
              kind selector. Setting kind=assessment opens the JSON editor
              + live preview using the same form the end user will see. */}
          <AssessmentEditor
            itemId={item.id}
            initialKind={(item.kind as JourneyItemKind | undefined) ?? "content"}
            initialPayload={
              (item.assessment_payload as JourneyAssessmentPayload | null | undefined) ??
              null
            }
          />

          <ItemPropagationActions
            itemId={item.id}
            currentOffsetDays={item.default_offset_days}
          />
        </div>

        <div className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
          <ItemLiveStatsSidebar stats={liveStats} />
        </div>
      </div>
    </div>
  );
}
