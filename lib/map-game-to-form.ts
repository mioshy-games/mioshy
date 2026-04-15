import { gameFormSchema, type GameFormValues } from "@/lib/validations";
import type { GameRow, WheelConfigRow } from "@/lib/types/database";
import { getDefaultGameFormValues } from "@/lib/game-form-defaults";

export function mapToGameFormValues(
  game: GameRow,
  wheel: WheelConfigRow | null,
): GameFormValues {
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
    thumbnail_url: game.thumbnail_url ?? "",
    is_active: game.is_active,
    bg_type: game.bg_type ?? "color",
    bg_value: game.bg_value ?? base.bg_value,
    player_mode: game.player_mode ?? false,
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
  return parsed.success ? parsed.data : merged;
}
