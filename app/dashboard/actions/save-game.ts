"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { gameFormSchema, type GameFormValues } from "@/lib/validations";

export async function saveGame(gameId: string | null, raw: unknown) {
  const parsed = gameFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data as GameFormValues;
  const { supabase } = await requireAdmin();

  function buildBalancedSlices() {
    const categories = v.wheel.player_config.categories
      .map((c) => ({
        ...c,
        key: c.key.trim(),
      }))
      .filter((c) => c.key.length > 0);
    const countCats = categories.length;
    if (countCats === 0) {
      return {
        slices: v.wheel.slices,
        category_colors: v.wheel.category_colors,
      };
    }

    const desired = v.wheel.player_config.desired_total_slices;
    const rounded = Math.min(
      16,
      Math.ceil(desired / countCats) * countCats,
    );
    const total =
      rounded > 16 ? Math.floor(16 / countCats) * countCats : rounded;
    const per = Math.max(1, Math.floor(total / countCats));

    // Canonical category colors: first defined color wins for a given key.
    const category_colors: Record<string, string> = {};
    for (const c of categories) {
      if (!category_colors[c.key]) {
        category_colors[c.key] = c.color;
      }
    }

    // Interleave categories around the wheel (round-robin) so slices alternate evenly.
    const slices: Array<{
      id: string;
      label_he: string;
      label_en: string;
      color: string;
      question_type: string;
    }> = [];
    const stamp = Date.now();
    for (let i = 0; i < per; i += 1) {
      for (const cat of categories) {
        slices.push({
          id: `${cat.id}-${i}-${stamp}`,
          label_he: cat.label_he,
          label_en: cat.label_en,
          color: category_colors[cat.key] ?? cat.color,
          question_type: cat.key,
        });
      }
    }
    return { slices, category_colors };
  }

  const balanced =
    v.player_mode ? null : buildBalancedSlices();

  // Parse the comma-separated keyword string into a clean text[] for Postgres.
  const keywords =
    (v.keywords_csv ?? "")
      .split(/[,\n]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && k.length < 60) // sanity: drop unreasonably long tags
      .slice(0, 25); // cap so the row stays small

  const gamePayload = {
    name_he: v.name_he,
    name_en: v.name_en,
    description_he: v.description_he,
    description_en: v.description_en,
    slug: v.slug,
    thumbnail_url: v.thumbnail_url || null,
    is_active: v.is_active ?? true,
    bg_type: v.bg_type,
    bg_value: v.bg_value,
    player_mode: v.player_mode,
    // SEO overrides — null-out empty strings so Postgres stores NULL (→ fallback)
    meta_title_he: (v.meta_title_he ?? "").trim() || null,
    meta_title_en: (v.meta_title_en ?? "").trim() || null,
    meta_description_he: (v.meta_description_he ?? "").trim() || null,
    meta_description_en: (v.meta_description_en ?? "").trim() || null,
    og_image_url: (v.og_image_url ?? "").trim() || null,
    keywords,
    sort_order: Number.isFinite(v.sort_order) ? Number(v.sort_order) : 0,
  };

  const wheelPayload = {
    slices: balanced ? balanced.slices : v.wheel.slices,
    pointer_color: v.wheel.pointer_color,
    inner_circle: v.wheel.inner_circle,
    inner_circle_color: v.wheel.inner_circle_color,
    inner_circle_border_color: v.wheel.inner_circle_border_color,
    border_color: v.wheel.border_color,
    divider_color: v.wheel.divider_color,
    divider_enabled: v.wheel.divider_enabled,
    divider_width: v.wheel.divider_width,
    marker_config: v.wheel.marker_config,
    category_colors: balanced ? balanced.category_colors : v.wheel.category_colors,
    player_config: v.wheel.player_config,
  };

  console.log("[saveGame] gameId:", gameId, "categoryCount:", v.wheel.player_config.categories?.length ?? 0);
  console.log(
    "[saveGame] saving wheel slices:",
    (wheelPayload.slices as Array<{ question_type: string }>).length,
    "unique types:",
    Array.from(new Set((wheelPayload.slices as Array<{ question_type: string }>).map((s) => s.question_type))),
  );

  if (gameId) {
    const { error: ge } = await supabase
      .from("games")
      .update(gamePayload)
      .eq("id", gameId);
    if (ge) {
      return { ok: false as const, error: ge.message };
    }
    const { error: we } = await supabase.from("wheel_configs").upsert(
      {
        game_id: gameId,
        ...wheelPayload,
      },
      { onConflict: "game_id" },
    );
    if (we) {
      return { ok: false as const, error: we.message };
    }
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/games/${gameId}/edit`);
    return { ok: true as const, id: gameId };
  }

  const { data: inserted, error: ie } = await supabase
    .from("games")
    .insert(gamePayload)
    .select("id")
    .single();
  if (ie || !inserted) {
    return { ok: false as const, error: ie?.message ?? "Insert failed" };
  }

  const { error: we } = await supabase.from("wheel_configs").insert({
    game_id: inserted.id,
    ...wheelPayload,
  });
  if (we) {
    return { ok: false as const, error: we.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/games");
  return { ok: true as const, id: inserted.id };
}
