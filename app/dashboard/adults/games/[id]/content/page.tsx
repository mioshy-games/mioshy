import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { ArrowLeft } from "lucide-react";
import { ContentManager } from "@/components/dashboard/between-us/ContentManager";
import type { ExperienceGameContent } from "@/lib/between-us/types";

export const dynamic = "force-dynamic";

type Level = "מרגש" | "מעורר" | "ללא_גבולות";

export default async function GameContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { id } = await params;

  const { data: game } = await supabase
    .from("experience_games")
    .select("id, slug, title_he, title_en, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!game) return notFound();

  const { data: contentRows } = await supabase
    .from("experience_game_content")
    .select("*")
    .eq("game_id", id)
    .order("level", { ascending: true })
    .order("order_index", { ascending: true });

  const rows = (contentRows ?? []) as ExperienceGameContent[];
  const byLevel: Record<Level, ExperienceGameContent[]> = {
    מרגש: [],
    מעורר: [],
    ללא_גבולות: [],
  };
  for (const r of rows) {
    const lvl = r.level as Level;
    if (byLevel[lvl]) byLevel[lvl].push(r);
  }

  const totals = {
    total: rows.length,
    active: rows.filter((r) => r.is_active).length,
    preview: rows.filter((r) => r.is_preview && r.is_active).length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/dashboard/adults/games/${game.id}/edit`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" />
            Back to {game.title_he || game.title_en || "game"}
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Content — {game.title_he || game.title_en || "Untitled"}
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-xs">
            {game.slug}
          </p>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage the content cards shown to couples. Each card belongs to one
            level: <strong>מרגש</strong> (emotional), <strong>מעורר</strong>{" "}
            (arousing), <strong>ללא גבולות</strong> (no-limits, 18+).
          </p>
        </div>
        <div className="text-muted-foreground flex flex-col items-end gap-1 text-xs">
          <span>
            Total <strong className="text-foreground">{totals.total}</strong> ·{" "}
            Active <strong className="text-foreground">{totals.active}</strong> ·
            Preview <strong className="text-foreground">{totals.preview}</strong>
          </span>
        </div>
      </div>

      <ContentManager
        gameId={game.id}
        initialByLevel={{
          מרגש: byLevel["מרגש"],
          מעורר: byLevel["מעורר"],
          ללא_גבולות: byLevel["ללא_גבולות"],
        }}
      />
    </div>
  );
}
