// ============================================================
// Server-side Supabase query helpers for Between Us
// Used by admin pages + public-facing pages
// ============================================================
//
// 2026-05-20 — All public-page queries here are wrapped in
// `React.cache()` so when multiple consumers within the same request
// (e.g. /mioshy-sex's `generateMetadata` + its page component both
// call `getBetweenUsSettings()`) we only round-trip to Supabase
// ONCE per request, not N times. This shaved off ~3-4 redundant
// Supabase RPCs per `/mioshy-sex` render — a meaningful contribution
// to the 835ms server-response time Lighthouse measured.
//
// React.cache() de-duplicates by reference equality of the arguments.
// Across requests it does nothing (each request gets its own cache).
// So this is safe: the cache lifetime is one render, not cross-user.
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  BetweenUsSettings,
  ExperienceGame,
  ExperienceGameCategory,
  ExperienceGameTag,
  ExperienceGameContent,
  Promotion,
} from "./types";

// ------------------------------------------------------------
// Settings (single row)
// ------------------------------------------------------------
export const getBetweenUsSettings = cache(
  async function getBetweenUsSettingsImpl(): Promise<BetweenUsSettings> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("between_us_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error("between_us_settings singleton row missing - run migration 029");
    }
    return data as BetweenUsSettings;
  },
);

// ------------------------------------------------------------
// Games
// ------------------------------------------------------------
export interface GamesListFilters {
  onlyActive?: boolean;
  search?: string;
  categoryId?: string;
}

export async function listGames(
  filters: GamesListFilters = {},
): Promise<ExperienceGame[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("experience_games")
    .select("*")
    .order("sort_weight", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.onlyActive) query = query.eq("is_active", true);
  if (filters.search && filters.search.trim().length > 0) {
    const q = `%${filters.search.trim()}%`;
    query = query.or(
      `title_he.ilike.${q},title_en.ilike.${q},slug.ilike.${q}`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ExperienceGame[];
}

export async function getGameById(id: string): Promise<ExperienceGame | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("experience_games")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ExperienceGame) ?? null;
}

export async function getGameBySlug(slug: string): Promise<ExperienceGame | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("experience_games")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ExperienceGame) ?? null;
}

export async function getGameCategoryIds(gameId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("experience_games_x_categories")
    .select("category_id")
    .eq("game_id", gameId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.category_id as string);
}

export async function getGameTagIds(gameId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("experience_games_x_tags")
    .select("tag_id")
    .eq("game_id", gameId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.tag_id as string);
}

// ------------------------------------------------------------
// Games with taxonomy joined - for the public storefront
// ------------------------------------------------------------
export interface GameCardData {
  game: ExperienceGame;
  category_ids: string[];
  tag_ids: string[];
}

export const listActiveGameCards = cache(
  async function listActiveGameCardsImpl(): Promise<GameCardData[]> {
  const supabase = await createServerSupabaseClient();
  const { data: games, error: gamesErr } = await supabase
    .from("experience_games")
    .select("*")
    .eq("is_active", true)
    .order("sort_weight", { ascending: false })
    .order("created_at", { ascending: false });
  if (gamesErr) throw new Error(gamesErr.message);
  const rows = (games ?? []) as ExperienceGame[];
  if (rows.length === 0) return [];

  const ids = rows.map((g) => g.id);
  const [cats, tags] = await Promise.all([
    supabase
      .from("experience_games_x_categories")
      .select("game_id, category_id")
      .in("game_id", ids),
    supabase
      .from("experience_games_x_tags")
      .select("game_id, tag_id")
      .in("game_id", ids),
  ]);

  const byGameCat = new Map<string, string[]>();
  for (const r of cats.data ?? []) {
    const arr = byGameCat.get(r.game_id as string) ?? [];
    arr.push(r.category_id as string);
    byGameCat.set(r.game_id as string, arr);
  }
  const byGameTag = new Map<string, string[]>();
  for (const r of tags.data ?? []) {
    const arr = byGameTag.get(r.game_id as string) ?? [];
    arr.push(r.tag_id as string);
    byGameTag.set(r.game_id as string, arr);
  }

  return rows.map((game) => ({
    game,
    category_ids: byGameCat.get(game.id) ?? [],
    tag_ids: byGameTag.get(game.id) ?? [],
  }));
  },
);

// ------------------------------------------------------------
// Categories
// ------------------------------------------------------------
export const listCategories = cache(
  async function listCategoriesImpl(
  onlyActive = false,
): Promise<ExperienceGameCategory[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("experience_game_categories")
    .select("*")
    .order("sort_weight", { ascending: true })
    .order("name_he", { ascending: true });
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ExperienceGameCategory[];
  },
);

// ------------------------------------------------------------
// Tags
// ------------------------------------------------------------
export const listTags = cache(
  async function listTagsImpl(onlyActive = false): Promise<ExperienceGameTag[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("experience_game_tags")
    .select("*")
    .order("name_he", { ascending: true });
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ExperienceGameTag[];
  },
);

// ------------------------------------------------------------
// Content (per-game)
// ------------------------------------------------------------
export async function listGameContent(gameId: string): Promise<ExperienceGameContent[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("experience_game_content")
    .select("*")
    .eq("game_id", gameId)
    .order("level", { ascending: true })
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ExperienceGameContent[];
}

// ------------------------------------------------------------
// Promotions
// ------------------------------------------------------------
export async function listPromotions(
  onlyActive = false,
): Promise<Promotion[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("promotions")
    .select("*")
    .order("created_at", { ascending: false });
  if (onlyActive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Promotion[];
}

// ------------------------------------------------------------
// Counts (for admin overview)
// ------------------------------------------------------------
export async function getOverviewCounts() {
  const supabase = await createServerSupabaseClient();
  const [games, categories, tags, activeGames, promotions, activePromotions] =
    await Promise.all([
      supabase
        .from("experience_games")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("experience_game_categories")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("experience_game_tags")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("experience_games")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("promotions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("promotions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);
  return {
    games: games.count ?? 0,
    activeGames: activeGames.count ?? 0,
    categories: categories.count ?? 0,
    tags: tags.count ?? 0,
    promotions: promotions.count ?? 0,
    activePromotions: activePromotions.count ?? 0,
  };
}
