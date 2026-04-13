import type { GameFormValues } from "@/lib/validations";
import { defaultSlices } from "@/lib/wheel-defaults";

export function getDefaultGameFormValues(): GameFormValues {
  return {
    name_he: "",
    name_en: "",
    description_he: "",
    description_en: "",
    slug: "",
    thumbnail_url: "",
    is_active: true,
    wheel: {
      slices: defaultSlices(6),
      pointer_color: "#ffffff",
      inner_circle: true,
      inner_circle_color: "#fafafa",
      inner_circle_border_color: "#e5e5e5",
      border_color: "#ffffff",
    },
  };
}
