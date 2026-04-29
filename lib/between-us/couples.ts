// ============================================================
// Server-side helpers for the current user's couple context
// ============================================================
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CoupleContext {
  user_id: string;
  couple_id: string | null;
  role: "owner" | "partner" | null;
  pair_code: string | null;
  display_name: string | null;
  partner_count: number; // how many members in this couple (1 = solo, 2 = paired)
  entitled_game_ids: Set<string>;
}

export async function getCurrentCoupleContext(): Promise<CoupleContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Current user's couple membership (at most one active)
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return {
      user_id: user.id,
      couple_id: null,
      role: null,
      pair_code: null,
      display_name: null,
      partner_count: 0,
      entitled_game_ids: new Set(),
    };
  }

  const coupleId = membership.couple_id as string;

  const [{ data: couple }, { data: members }, { data: ents }] =
    await Promise.all([
      supabase
        .from("couples")
        .select("pair_code, display_name")
        .eq("id", coupleId)
        .maybeSingle(),
      supabase
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", coupleId),
      supabase
        .from("couple_entitlements")
        .select("game_id")
        .eq("couple_id", coupleId),
    ]);

  return {
    user_id: user.id,
    couple_id: coupleId,
    role: (membership.role as "owner" | "partner") ?? "partner",
    pair_code: couple?.pair_code ?? null,
    display_name: couple?.display_name ?? null,
    partner_count: (members ?? []).length,
    entitled_game_ids: new Set((ents ?? []).map((r) => r.game_id as string)),
  };
}

export async function isGameEntitled(
  ctx: CoupleContext | null,
  gameId: string,
): Promise<boolean> {
  if (!ctx || !ctx.couple_id) return false;
  return ctx.entitled_game_ids.has(gameId);
}

// ------------------------------------------------------------
// Library — full game rows for every game the couple owns
// ------------------------------------------------------------
export interface OwnedGame {
  id: string;
  slug: string;
  title_he: string;
  title_en: string;
  short_desc_he: string;
  short_desc_en: string;
  cover_image_url: string | null;
  intimacy_level: number;
  communication_level: number;
  heat_level: number;
  is_new: boolean;
  is_popular: boolean;
  acquired_at: string | null;
  source: string | null;
}

export async function listOwnedGamesForCouple(
  coupleId: string,
): Promise<OwnedGame[]> {
  const supabase = await createServerSupabaseClient();

  const { data: ents, error: entErr } = await supabase
    .from("couple_entitlements")
    .select("game_id, acquired_at, source")
    .eq("couple_id", coupleId)
    .order("acquired_at", { ascending: false });
  if (entErr) throw new Error(entErr.message);

  const rows = ents ?? [];
  if (rows.length === 0) return [];

  const gameIds = Array.from(new Set(rows.map((r) => r.game_id as string)));
  const { data: games, error: gamesErr } = await supabase
    .from("experience_games")
    .select(
      "id, slug, title_he, title_en, short_desc_he, short_desc_en, cover_image_url, intimacy_level, communication_level, heat_level, is_new, is_popular, is_active",
    )
    .in("id", gameIds);
  if (gamesErr) throw new Error(gamesErr.message);

  const byId = new Map((games ?? []).map((g) => [g.id as string, g]));

  const merged: OwnedGame[] = [];
  for (const ent of rows) {
    const g = byId.get(ent.game_id as string);
    if (!g) continue; // game was deleted; skip
    merged.push({
      id: g.id as string,
      slug: g.slug as string,
      title_he: (g.title_he as string) ?? "",
      title_en: (g.title_en as string) ?? "",
      short_desc_he: (g.short_desc_he as string) ?? "",
      short_desc_en: (g.short_desc_en as string) ?? "",
      cover_image_url: (g.cover_image_url as string) ?? null,
      intimacy_level: (g.intimacy_level as number) ?? 0,
      communication_level: (g.communication_level as number) ?? 0,
      heat_level: (g.heat_level as number) ?? 0,
      is_new: !!g.is_new,
      is_popular: !!g.is_popular,
      acquired_at: (ent.acquired_at as string) ?? null,
      source: (ent.source as string) ?? null,
    });
  }
  return merged;
}
