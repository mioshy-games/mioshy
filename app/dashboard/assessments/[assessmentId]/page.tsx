import { requireAdmin } from "@/lib/auth/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAssessment } from "@/lib/assessments/catalog";
import { QuestionsManager, type QuestionRow } from "@/components/dashboard/assessments/QuestionsManager";

export const dynamic = "force-dynamic";

export default async function AssessmentQuestionsAdminPage({
  params,
}: {
  params: { assessmentId: string };
}) {
  await requireAdmin();
  const def = getAssessment(params.assessmentId);
  if (!def) notFound();

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("assessment_questions")
    .select("slug, position, dimension_key, type, reverse, is_open, text_he, text_en, source_slugs, is_active")
    .eq("assessment_id", params.assessmentId)
    .order("position", { ascending: true });

  const questions = (data ?? []) as QuestionRow[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/assessments" className="text-muted-foreground text-xs hover:underline">
            ← כל האבחונים
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{def.he_title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {questions.length} שאלות · עריכה, הוספה, מחיקה, ייבוא/ייצוא CSV.
          </p>
        </div>
      </div>

      <QuestionsManager
        assessmentId={def.id}
        dimensions={def.dimensions}
        initialQuestions={questions}
      />
    </div>
  );
}
