import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TruthOrDarePage({
  params,
}: {
  params: { locale: string };
}) {
  const supabase = await createServerSupabaseClient();

  const { data: game } = await supabase
    .from("games")
    .select("slug")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!game) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">No active game yet</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          An admin needs to publish a game in the dashboard first.
        </p>
      </div>
    );
  }
  redirect(`/${params.locale}/games/${game.slug}`);
}
