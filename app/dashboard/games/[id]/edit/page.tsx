import { notFound } from "next/navigation";
import { GameForm } from "@/components/dashboard/GameForm";
import { requireAdmin } from "@/lib/auth/admin";
import { mapToGameFormValues } from "@/lib/map-game-to-form";
import type { GameRow, QuestionRow, WheelConfigRow } from "@/lib/types/database";
import { SettingsTrigger } from "@/components/settings/SettingsTrigger";
import { InlineSettingsEditor } from "@/components/settings/InlineSettingsEditor";
import { FloatingSaveButton } from "@/components/settings/FloatingSaveButton";

export default async function EditGamePage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase } = await requireAdmin();
  const { id } = params;

  const { data: game, error: ge } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (ge || !game) {
    notFound();
  }

  const { data: wheel } = await supabase
    .from("wheel_configs")
    .select("*")
    .eq("game_id", id)
    .maybeSingle();

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("game_id", id)
    .order("created_at", { ascending: true });

  const defaults = mapToGameFormValues(
    game as GameRow,
    wheel as WheelConfigRow | null,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit game</h1>
          <p className="text-muted-foreground mt-1 text-sm font-mono">{id}</p>
        </div>
        <SettingsTrigger gameId={id} label="Save to" />
      </div>

      <FloatingSaveButton gameId={id} />
      <InlineSettingsEditor gameId={id} />

      <GameForm
        gameId={id}
        defaultValues={defaults}
        initialQuestions={(questions ?? []) as QuestionRow[]}
      />
    </div>
  );
}
