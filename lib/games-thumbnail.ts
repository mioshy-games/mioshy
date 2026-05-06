import type { GameRow } from "@/lib/types/database";

/**
 * Pick the catalogue thumbnail to render for a given locale.
 *
 * Per Itzik 2026-05-06 the catalogue thumbnails carry baked-in copy in
 * each language (Hebrew text on the HE asset, English text on the EN
 * asset), so each game owns two images. This helper centralises the
 * lookup so every consumer (catalogue grid, gallery, homepage feature
 * strip, OG image) handles the same fallback chain identically:
 *
 *   1. The exact-locale column (`thumbnail_url_he` for HE, `thumbnail_url_en` for EN)
 *   2. The other locale's image — better to show a wrong-language card
 *      than a coloured-gradient placeholder if only one was uploaded
 *   3. `null` when nothing is set, so the caller can render a fallback
 *
 * Pass either a full GameRow or just `{ thumbnail_url_he, thumbnail_url_en }`
 * — the function reads only those two fields.
 */
export function pickGameThumbnail(
  game: Pick<GameRow, "thumbnail_url_he" | "thumbnail_url_en">,
  locale: string,
): string | null {
  const isHe = locale === "he";
  const primary = isHe ? game.thumbnail_url_he : game.thumbnail_url_en;
  const secondary = isHe ? game.thumbnail_url_en : game.thumbnail_url_he;
  return primary || secondary || null;
}
