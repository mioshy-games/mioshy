"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { questionFormSchema } from "@/lib/validations";

export async function upsertQuestion(
  gameId: string,
  questionId: string | null,
  raw: unknown,
) {
  const parsed = questionFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;
  const { supabase } = await requireAdmin();

  // Enforce category consistency: question.type must match a wheel category for this game.
  const { data: wheel } = await supabase
    .from("wheel_configs")
    .select("slices")
    .eq("game_id", gameId)
    .maybeSingle();

  const categories = Array.from(
    new Set(
      (wheel?.slices as Array<{ question_type?: string }> | null | undefined)
        ?.map((s) => String(s.question_type ?? "").trim())
        .filter(Boolean) ?? [],
    ),
  );

  if (categories.length === 0) {
    return {
      ok: false as const,
      error: "Please define wheel categories first",
    };
  }
  if (!categories.includes(String(v.type))) {
    return {
      ok: false as const,
      error: "Invalid category: please pick one of the wheel categories",
    };
  }

  const payload = {
    game_id: gameId,
    type: v.type,
    level: v.level,
    text_he: v.text_he,
    text_en: v.text_en,
    is_active: v.is_active,
  };

  if (questionId) {
    const { error } = await supabase
      .from("questions")
      .update(payload)
      .eq("id", questionId)
      .eq("game_id", gameId);
    if (error) {
      return { ok: false as const, error: error.message };
    }
  } else {
    const { error } = await supabase.from("questions").insert(payload);
    if (error) {
      return { ok: false as const, error: error.message };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/questions");
  revalidatePath(`/dashboard/games/${gameId}/edit`);
  return { ok: true as const };
}

export async function deleteQuestion(questionId: string, gameId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId)
    .eq("game_id", gameId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/questions");
  revalidatePath(`/dashboard/games/${gameId}/edit`);
  return { ok: true as const };
}

export async function toggleQuestionActive(
  questionId: string,
  gameId: string,
  isActive: boolean,
) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("questions")
    .update({ is_active: isActive })
    .eq("id", questionId)
    .eq("game_id", gameId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/questions");
  revalidatePath(`/dashboard/games/${gameId}/edit`);
  return { ok: true as const };
}
