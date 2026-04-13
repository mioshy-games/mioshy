import { gameFormSchema, type GameFormValues } from "@/lib/validations";
import type { GameRow, WheelConfigRow } from "@/lib/types/database";
import { getDefaultGameFormValues } from "@/lib/game-form-defaults";

export function mapToGameFormValues(
  game: GameRow,
  wheel: WheelConfigRow | null,
): GameFormValues {
  const base = getDefaultGameFormValues();
  const merged: GameFormValues = {
    ...base,
    name_he: game.name_he,
    name_en: game.name_en,
    description_he: game.description_he,
    description_en: game.description_en,
    slug: game.slug,
    thumbnail_url: game.thumbnail_url ?? "",
    is_active: game.is_active,
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
          }
        : {}),
    },
  };
  const parsed = gameFormSchema.safeParse(merged);
  return parsed.success ? parsed.data : merged;
}
