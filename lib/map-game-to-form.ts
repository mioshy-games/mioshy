import { gameFormSchema, type GameFormValues } from "@/lib/validations";
import type { GameRow, WheelConfigRow } from "@/lib/types/database";
import { getDefaultGameFormValues } from "@/lib/game-form-defaults";

export function mapToGameFormValues(
  game: GameRow,
  wheel: WheelConfigRow | null,
): GameFormValues {
  // Server-side log so we can correlate "user reported save didn't persist"
  // with what the page actually fetched on reload. If this prints the old
  // name right after a save, the DB write didn't land. If it prints the new
  // name but the client still shows the old one, the issue is on the client.
  console.log(
    "[mapToGameFormValues]",
    JSON.stringify({
      id: game.id,
      name_he: game.name_he,
      name_en: game.name_en,
      slug: game.slug,
      hasWheel: Boolean(wheel),
      wheelSlices: wheel?.slices ? (wheel.slices as unknown[]).length : 0,
    }),
  );
  const base = getDefaultGameFormValues();
  const mergedMarkerConfig = {
    ...base.wheel.marker_config,
    ...(wheel?.marker_config ?? {}),
  };
  const mergedCategoryColors = {
    ...base.wheel.category_colors,
    ...(wheel?.category_colors ?? {}),
  };
  const mergedPlayerConfig = {
    ...base.wheel.player_config,
    ...(wheel?.player_config ?? {}),
  };
  const merged: GameFormValues = {
    ...base,
    name_he: game.name_he,
    name_en: game.name_en,
    description_he: game.description_he,
    description_en: game.description_en,
    slug: game.slug,
    thumbnail_url_he: game.thumbnail_url_he ?? "",
    thumbnail_url_en: game.thumbnail_url_en ?? "",
    is_active: game.is_active,
    bg_type: game.bg_type ?? "color",
    bg_value: game.bg_value ?? base.bg_value,
    player_mode: game.player_mode ?? false,
    meta_title_he: game.meta_title_he ?? "",
    meta_title_en: game.meta_title_en ?? "",
    meta_description_he: game.meta_description_he ?? "",
    meta_description_en: game.meta_description_en ?? "",
    og_image_url: game.og_image_url ?? "",
    keywords_csv: Array.isArray(game.keywords) ? game.keywords.join(", ") : "",
    sort_order: game.sort_order ?? 0,
    opens_at: game.opens_at ?? null,
    alt_text: game.alt_text ?? null,
    instructions: {
      title: game.instructions?.he?.title ?? "",
      intro: game.instructions?.he?.intro ?? "",
      // Steps are stored as an array; the editor edits them as one-per-line text.
      steps_text: Array.isArray(game.instructions?.he?.steps)
        ? game.instructions!.he!.steps!.join("\n")
        : "",
      footer: game.instructions?.he?.footer ?? "",
    },
    wheel: {
      ...base.wheel,
      ...(wheel
        ? {
            slices: wheel.slices,
            pointer_color: wheel.pointer_color,
            inner_circle: wheel.inner_circle,
            inner_circle_color: wheel.inner_circle_color,
            inner_circle_border_color: wheel.inner_circle_border_color,
            border_color: wheel.border_color,
            divider_color: wheel.divider_color,
            divider_enabled: wheel.divider_enabled ?? wheel.show_divider ?? true,
            divider_width: wheel.divider_width ?? 2,
            marker_config: mergedMarkerConfig,
            category_colors: mergedCategoryColors,
            player_config: mergedPlayerConfig,
          }
        : {}),
    },
  };
  const parsed = gameFormSchema.safeParse(merged);
  if (parsed.success) return parsed.data;

  // Zod rejected the merged object (most common cause: slug contains characters
  // the regex doesn't allow, e.g. imported Hebrew slugs before the regex was
  // widened, or a completely missing slug). Clear the slug so the form loads in
  // an editable state rather than silently locked with an invalid value.
  console.warn(
    "[mapToGameFormValues] Zod parse failed - clearing slug. Errors:",
    parsed.error.flatten().fieldErrors,
  );
  const sanitized = { ...merged, slug: "" };
  const reparsed = gameFormSchema.safeParse(sanitized);
  return reparsed.success ? reparsed.data : sanitized;
}
