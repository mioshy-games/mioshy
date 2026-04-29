"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import {
  experienceGameContentSchema,
  type ExperienceGameContentFormValues,
} from "@/lib/between-us/validations";

type ContentLevel = "מרגש" | "מעורר" | "ללא_גבולות";

type ContentResult<T extends string> =
  | { ok: true; id: T }
  | { ok: false; error: Record<string, string[] | undefined> };

export async function saveContent(
  contentId: string | null,
  raw: unknown,
): Promise<ContentResult<string>> {
  const parsed = experienceGameContentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const v: ExperienceGameContentFormValues = parsed.data;
  const { supabase } = await requireAdmin();

  const row = {
    game_id: v.game_id,
    level: v.level,
    order_index: v.order_index,
    title_he: v.title_he,
    title_en: v.title_en,
    body_he: v.body_he,
    body_en: v.body_en,
    is_preview: v.is_preview,
    is_active: v.is_active,
  };

  let savedId = contentId;
  if (contentId) {
    const { error } = await supabase
      .from("experience_game_content")
      .update(row)
      .eq("id", contentId);
    if (error) return { ok: false, error: { _root: [error.message] } };
  } else {
    const { data, error } = await supabase
      .from("experience_game_content")
      .insert(row)
      .select("id")
      .single();
    if (error || !data)
      return {
        ok: false,
        error: { _root: [error?.message ?? "Insert failed"] },
      };
    savedId = data.id as string;
  }

  revalidatePath(`/dashboard/adults/games/${v.game_id}/content`);
  revalidatePath("/dashboard/adults");
  revalidatePath("/", "layout");
  return { ok: true, id: savedId! };
}

export async function deleteContent(contentId: string, gameId: string) {
  if (!contentId) return { ok: false as const, error: "missing contentId" };
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("experience_game_content")
    .delete()
    .eq("id", contentId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/dashboard/adults/games/${gameId}/content`);
  return { ok: true as const };
}

export async function toggleContentFlag(
  contentId: string,
  field: "is_active" | "is_preview",
  value: boolean,
  gameId: string,
) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("experience_game_content")
    .update({ [field]: value })
    .eq("id", contentId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath(`/dashboard/adults/games/${gameId}/content`);
  return { ok: true as const };
}

export async function reorderContent(
  gameId: string,
  level: ContentLevel,
  orderedIds: string[],
) {
  const { supabase } = await requireAdmin();
  if (orderedIds.length === 0) return { ok: true as const };

  // Assign 10, 20, 30... for nice gaps
  const updates = orderedIds.map((id, idx) => ({ id, order_index: (idx + 1) * 10 }));
  for (const u of updates) {
    const { error } = await supabase
      .from("experience_game_content")
      .update({ order_index: u.order_index })
      .eq("id", u.id)
      .eq("game_id", gameId)
      .eq("level", level);
    if (error) return { ok: false as const, error: error.message };
  }
  revalidatePath(`/dashboard/adults/games/${gameId}/content`);
  return { ok: true as const };
}

export async function createContentForLevel(
  gameId: string,
  level: ContentLevel,
): Promise<ContentResult<string>> {
  const { supabase } = await requireAdmin();

  // Find max order_index in this level, then add 10
  const { data: maxRow } = await supabase
    .from("experience_game_content")
    .select("order_index")
    .eq("game_id", gameId)
    .eq("level", level)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.order_index ?? 0) + 10;

  const { data, error } = await supabase
    .from("experience_game_content")
    .insert({
      game_id: gameId,
      level,
      order_index: nextOrder,
      title_he: "כרטיס חדש",
      title_en: "New card",
      body_he: "",
      body_en: "",
      is_preview: false,
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      ok: false,
      error: { _root: [error?.message ?? "Insert failed"] },
    };

  revalidatePath(`/dashboard/adults/games/${gameId}/content`);
  return { ok: true, id: data.id as string };
}

export async function duplicateContent(
  contentId: string,
): Promise<ContentResult<string>> {
  const { supabase } = await requireAdmin();
  const { data: src, error: getErr } = await supabase
    .from("experience_game_content")
    .select("*")
    .eq("id", contentId)
    .maybeSingle();
  if (getErr || !src) {
    return {
      ok: false,
      error: { _root: [getErr?.message ?? "Original row not found"] },
    };
  }

  const { data, error } = await supabase
    .from("experience_game_content")
    .insert({
      game_id: src.game_id,
      level: src.level,
      order_index: (src.order_index as number) + 5,
      title_he: `${src.title_he ?? ""} (עותק)`,
      title_en: `${src.title_en ?? ""} (copy)`,
      body_he: src.body_he ?? "",
      body_en: src.body_en ?? "",
      is_preview: false,
      is_active: false,
    })
    .select("id")
    .single();
  if (error || !data)
    return {
      ok: false,
      error: { _root: [error?.message ?? "Duplicate failed"] },
    };

  revalidatePath(`/dashboard/adults/games/${src.game_id}/content`);
  return { ok: true, id: data.id as string };
}
