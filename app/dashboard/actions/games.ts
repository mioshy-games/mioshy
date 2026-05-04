"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// IMPORTANT — Supabase SSR RLS-flaky writes pattern:
// The session client returned by requireAdmin() can silently no-op writes
// because of the JWT→PostgREST handshake flakiness under @supabase/ssr.
// Pattern: AUTHENTICATE via the session client (requireAdmin), MUTATE via
// the service-role admin client. Same fix applied across saveGame, the
// import route, etc. — see project memory.

export async function toggleGameActive(gameId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
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
  await requireAdmin();
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/games");
  return { ok: true as const };
}
