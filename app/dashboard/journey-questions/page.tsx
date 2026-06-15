import { requireAdmin } from "@/lib/auth/admin";
import Link from "next/link";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  JourneyQuestionsManager,
} from "@/components/dashboard/journey-questions/JourneyQuestionsManager";
import type { JourneyQuestionRow } from "@/app/dashboard/journey-questions/actions";

export const dynamic = "force-dynamic";

export default async function JourneyQuestionsAdminPage() {
  await requireAdmin();
  const admin = createAdminSupabaseClient();

  const { data } = await admin
    .from("journey_questions")
    .select("slug, position, phase, type, domain, axes, reverse, he_text, en_text, options, meta, is_active")
    .order("position", { ascending: true });

  const questions = (data ?? []) as JourneyQuestionRow[];
  const activeCount = questions.filter((q) => q.is_active).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-muted-foreground text-xs hover:underline">
          ← לוח הבקרה
        </Link>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">שאלון המסע — ניהול שאלות</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {activeCount} שאלות פעילות · עריכת טקסט, שלב (לפני/אחרי רכישה), סדר, הוספה והשבתה · ייבוא/ייצוא CSV.
        </p>
      </div>

      <JourneyQuestionsManager initialQuestions={questions} />
    </div>
  );
}
