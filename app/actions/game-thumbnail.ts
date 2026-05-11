"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";

/**
 * Update a game's per-locale thumbnails.
 *
 * Pass either or both of `thumbnailUrlHe` / `thumbnailUrlEn`. Undefined
 * keys are left untouched on the row; pass an empty string to explicitly
 * clear a slot (it becomes NULL in Postgres and the UI falls back to the
 * other locale's image).
 *
 * Admin-only - requireAdmin() throws a redirect if the caller isn't admin.
 *
 * Per Itzik 2026-05-06: catalogue thumbnails carry baked-in copy in their
 * own language, so each game has TWO images. The legacy `thumbnail_url`
 * column was dropped in migration 061; this action targets the new
 * `thumbnail_url_he` / `thumbnail_url_en` columns.
 */
export async function updateGameThumbnailAction(
  gameId: string,
  urls: { he?: string | null; en?: string | null },
): Promise<void> {
  const { supabase } = await requireAdmin();

  // Build the update payload only with keys the caller explicitly provided
  // - passing `undefined` leaves the existing value intact.
  const payload: Record<string, string | null> = {};
  if (urls.he !== undefined) {
    const trimmed = (urls.he ?? "").trim();
    payload.thumbnail_url_he = trimmed.length > 0 ? trimmed : null;
  }
  if (urls.en !== undefined) {
    const trimmed = (urls.en ?? "").trim();
    payload.thumbnail_url_en = trimmed.length > 0 ? trimmed : null;
  }
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase
    .from("games")
    .update(payload)
    .eq("id", gameId);

  if (error) throw new Error(error.message);

  // Revalidate every public surface that renders the catalogue thumbnail.
  revalidatePath("/games");
  revalidatePath("/he/games");
  revalidatePath("/en/games");
  revalidatePath("/he");
  revalidatePath("/en");
  revalidatePath("/he/my/games");
  revalidatePath("/en/my/games");
}
