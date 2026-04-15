import { getTranslations } from "next-intl/server";
import { DashboardClient } from "@/components/DashboardClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const supabase = await createServerSupabaseClient();

  const { data: game } = await supabase
    .from("games")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: questions } = game
    ? await supabase
        .from("questions")
        .select("id, type, text_he, text_en")
        .eq("game_id", game.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as unknown[] };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-zinc-950 via-fuchsia-950 to-rose-950 font-[family-name:var(--font-geist-sans)]">
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-center text-3xl font-bold text-white sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-center text-white/70">
          {t("subtitle")}
        </p>
        <div className="mt-10">
          <DashboardClient
            questions={
              ((questions ?? []) as Array<{
                id: string;
                type: "truth" | "dare" | "custom";
                text_he: string;
                text_en: string;
              }>) ?? []
            }
          />
        </div>
      </main>
    </div>
  );
}
