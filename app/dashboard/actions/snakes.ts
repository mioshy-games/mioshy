"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";

export async function createSnakesConfig(name: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("snakes_ladders_config")
    .insert({ name: name.trim() || "New config", is_active: false, is_default: false })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/snakes");
  return { ok: true as const, id: String(data?.id) };
}

export async function setActiveSnakesConfig(configId: string) {
  const { supabase } = await requireAdmin();
  const { error: e1 } = await supabase
    .from("snakes_ladders_config")
    .update({ is_active: false })
    .eq("is_active", true);
  if (e1) return { ok: false as const, error: e1.message };

  const { error: e2 } = await supabase
    .from("snakes_ladders_config")
    .update({ is_active: true })
    .eq("id", configId);
  if (e2) return { ok: false as const, error: e2.message };

  revalidatePath("/dashboard/snakes");
  return { ok: true as const };
}

export async function deleteSnakesConfig(configId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("snakes_ladders_config")
    .delete()
    .eq("id", configId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/snakes");
  return { ok: true as const };
}

export async function updateSnakesConfig(
  configId: string,
  patch: Partial<{
    name: string;
    board_size: number;
    coin_heads_steps: number;
    coin_tails_steps: number;
    penalty_type: "back5" | "start";
    penalty_steps: number;
    snakes: unknown[];
    ladders: unknown[];
    questions: unknown[];
    is_default: boolean;
  }>,
) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("snakes_ladders_config")
    .update(patch)
    .eq("id", configId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/snakes");
  return { ok: true as const };
}

