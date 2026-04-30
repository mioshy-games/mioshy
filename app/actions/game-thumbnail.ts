"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";

/**
 * Update a game's thumbnail_url.
 * Admin-only - requireAdmin() throws a redirect if the caller is not admin.
 */
export async function updateGameThumbnailAction(
  gameId: string,
  thumbnailUrl: string,
): Promise<void> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("games")
    .update({ thumbnail_url: thumbnailUrl.trim() || null })
    .eq("id", gameId);

  if (error) throw new Error(error.message);

  // Revalidate the public games catalogue for all locales.
  revalidatePath("/games");
  revalidatePath("/he/games");
  revalidatePath("/en/games");
}
