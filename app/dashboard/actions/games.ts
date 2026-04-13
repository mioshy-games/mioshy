"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";

export async function toggleGameActive(gameId: string, isActive: boolean) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("games")
    .update({ is_active: isActive })
    .eq("id", gameId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/games");
  return { ok: true as const };
}

export async function deleteGame(gameId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/games");
  return { ok: true as const };
}
