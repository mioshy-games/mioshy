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

  const gamePayload = {
    name_he: v.name_he,
    name_en: v.name_en,
    description_he: v.description_he,
    description_en: v.description_en,
    slug: v.slug,
    thumbnail_url: v.thumbnail_url || null,
    is_active: v.is_active,
  };

  const wheelPayload = {
    slices: v.wheel.slices,
    pointer_color: v.wheel.pointer_color,
    inner_circle: v.wheel.inner_circle,
    inner_circle_color: v.wheel.inner_circle_color,
    inner_circle_border_color: v.wheel.inner_circle_border_color,
    border_color: v.wheel.border_color,
  };

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
