import { requireAdmin } from "@/lib/auth/admin";
import { QuestionsPageClient } from "@/components/dashboard/QuestionsPageClient";
import type { QuestionTableRow } from "@/components/dashboard/QuestionsTable";

type QuestionWithJoin = {
  id: string;
  game_id: string;
  type: string;
  level: string;
  text_he: string;
  text_en: string;
  is_active: boolean;
  created_at: string;
  games: { name_en: string; name_he: string } | null;
};

export default async function DashboardQuestionsPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("questions")
    .select(
      "id, game_id, type, level, text_he, text_en, is_active, created_at, games(name_en, name_he)",
    )
    .order("created_at", { ascending: false });

  const rows: QuestionTableRow[] = (data as QuestionWithJoin[] | null)?.map(
    (q) => {
      const { games: g, ...rest } = q;
      return {
        ...rest,
        type: rest.type as QuestionTableRow["type"],
        level: rest.level as QuestionTableRow["level"],
        game_name: g?.name_en ?? g?.name_he ?? "",
      };
    },
  ) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Questions</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          All questions across games. Filter by type and level.
        </p>
      </div>
      <QuestionsPageClient initialQuestions={rows} />
    </div>
  );
}
