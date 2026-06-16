"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  experienceGameSchema,
  type ExperienceGameFormValues,
} from "@/lib/between-us/validations";

type ActionResult =
  | { ok: true; gameId: string }
  | { ok: false; error: Record<string, string[] | undefined> };

/**
 * Upsert an experience game. If gameId is null, creates a new one.
 * Also reconciles categories and tags (delete-then-insert, simple and correct).
 */
export async function saveExperienceGame(
  gameId: string | null,
  raw: unknown,
): Promise<ActionResult> {
  const parsed = experienceGameSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>,
    };
  }
  const v: ExperienceGameFormValues = parsed.data;
  const { supabase } = await requireAdmin();

  // Build the row without the m2m fields (those are persisted separately)
  const row = {
    slug: v.slug,
    title_he: v.title_he,
    title_en: v.title_en,
    short_desc_he: v.short_desc_he,
    short_desc_en: v.short_desc_en,
    full_desc_he: v.full_desc_he,
    full_desc_en: v.full_desc_en,
    meta_title_he: v.meta_title_he ?? null,
    meta_title_en: v.meta_title_en ?? null,
    meta_description_he: v.meta_description_he ?? null,
    meta_description_en: v.meta_description_en ?? null,
    benefits_he: v.benefits_he,
    benefits_en: v.benefits_en,
    target_audience_he: v.target_audience_he,
    target_audience_en: v.target_audience_en,
    // Optional play-questions payload - empty strings/arrays when the
    // admin didn't fill them in. The play page hides the whole section
    // when the locale's questions array is empty.
    play_questions_intro_he: v.play_questions_intro_he,
    play_questions_intro_en: v.play_questions_intro_en,
    play_questions_he: v.play_questions_he,
    play_questions_en: v.play_questions_en,
    cover_image_url: v.cover_image_url ?? null,
    gallery: v.gallery,
    intimacy_badge_url: v.intimacy_badge_url ?? null,
    communication_badge_url: v.communication_badge_url ?? null,
    heat_badge_url: v.heat_badge_url ?? null,
    intimacy_level: v.intimacy_level,
    communication_level: v.communication_level,
    heat_level: v.heat_level,
    price_ils: v.price_ils ?? null,
    price_usd: v.price_usd ?? null,
    is_new: v.is_new,
    is_popular: v.is_popular,
    is_subscription_eligible: v.is_subscription_eligible,
    is_active: v.is_active,
    sort_weight: v.sort_weight,
    published_at: v.is_active ? new Date().toISOString() : null,
    // D — scheduled open time (null = immediate). Stored verbatim (ISO).
    opens_at: v.opens_at ?? null,
    // a11y M5 — image alt text; null-out empty so the UI falls back to the title.
    alt_text: (v.alt_text ?? "").trim() || null,
  };

  let savedId = gameId;

  if (gameId) {
    const { error } = await supabase
      .from("experience_games")
      .update(row)
      .eq("id", gameId);
    if (error) {
      return { ok: false, error: { _root: [error.message] } };
    }
  } else {
    const { data, error } = await supabase
      .from("experience_games")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      return {
        ok: false,
        error: { _root: [error?.message ?? "Failed to create game"] },
      };
    }
    savedId = data.id as string;
  }

  if (!savedId) {
    return { ok: false, error: { _root: ["No game id returned"] } };
  }

  // Reconcile categories
  await supabase
    .from("experience_games_x_categories")
    .delete()
    .eq("game_id", savedId);
  if (v.category_ids.length > 0) {
    const rows = v.category_ids.map((cid, i) => ({
      game_id: savedId!,
      category_id: cid,
      sort_weight: i * 10,
    }));
    const { error } = await supabase
      .from("experience_games_x_categories")
      .insert(rows);
    if (error) {
      return { ok: false, error: { _root: [error.message] } };
    }
  }

  // Reconcile tags
  await supabase
    .from("experience_games_x_tags")
    .delete()
    .eq("game_id", savedId);
  if (v.tag_ids.length > 0) {
    const rows = v.tag_ids.map((tid) => ({
      game_id: savedId!,
      tag_id: tid,
    }));
    const { error } = await supabase
      .from("experience_games_x_tags")
      .insert(rows);
    if (error) {
      return { ok: false, error: { _root: [error.message] } };
    }
  }

  revalidatePath("/dashboard/adults/games", "layout");
  revalidatePath("/", "layout");
  return { ok: true, gameId: savedId };
}

export async function deleteExperienceGame(gameId: string) {
  if (!gameId) return { ok: false as const, error: "missing gameId" };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("experience_games")
    .delete()
    .eq("id", gameId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard/adults/games");
  return { ok: true as const };
}

export async function toggleExperienceGameActive(
  gameId: string,
  isActive: boolean,
) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("experience_games")
    .update({
      is_active: isActive,
      published_at: isActive ? new Date().toISOString() : null,
    })
    .eq("id", gameId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/adults/games");
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Server-side helper to create a new empty game and redirect to its edit page.
 * Used by the "New game" button in the list view.
 */
export async function createAndRedirectNewGame() {
  const { supabase } = await requireAdmin();
  const slug = `new-game-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("experience_games")
    .insert({
      slug,
      title_he: "משחק חדש",
      title_en: "New Game",
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  redirect(`/dashboard/adults/games/${data.id}/edit`);
}
