import { requireAdmin } from "@/lib/auth/admin";

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  // Escape double-quotes, wrap in quotes if needed
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("questions")
    .select(
      "id, game_id, type, level, category, text_he, text_en, is_active, created_at, games(slug, name_en, name_he)",
    )
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(`Failed to export: ${error.message}`, { status: 500 });
  }

  const header = [
    "game_id",
    "game_slug",
    "game_name_he",
    "game_name_en",
    "question_id",
    "type",
    "level",
    "category",
    "text_he",
    "text_en",
    "is_active",
    "created_at",
  ];

  const rows = (data ?? []).map((q) => {
    const g = (q as { games?: { slug?: string; name_he?: string; name_en?: string } | null })
      .games;
    return [
      (q as { game_id: string }).game_id,
      g?.slug ?? "",
      g?.name_he ?? "",
      g?.name_en ?? "",
      (q as { id: string }).id,
      (q as { type: string }).type,
      (q as { level: string }).level,
      (q as { category?: string }).category ?? "",
      (q as { text_he: string }).text_he,
      (q as { text_en: string }).text_en,
      String((q as { is_active: boolean }).is_active),
      (q as { created_at: string }).created_at,
    ].map(csvEscape);
  });

  const csv = [header.map(csvEscape).join(","), ...rows.map((r) => r.join(","))].join("\n");
  const filename = `questions_export_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

