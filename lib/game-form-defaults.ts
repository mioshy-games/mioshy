import type { GameFormValues } from "@/lib/validations";
import { defaultSlices } from "@/lib/wheel-defaults";

export function getDefaultGameFormValues(): GameFormValues {
  return {
    name_he: "",
    name_en: "",
    description_he: "",
    description_en: "",
    slug: "",
    thumbnail_url_he: "",
    thumbnail_url_en: "",
    is_active: true,
    bg_type: "color",
    bg_value: "#0b0b0f",
    player_mode: false,
    meta_title_he: "",
    meta_title_en: "",
    meta_description_he: "",
    meta_description_en: "",
    og_image_url: "",
    keywords_csv: "",
    sort_order: 0,
    opens_at: null,
    instructions: { title: "", intro: "", steps_text: "", footer: "" },
    wheel: {
      slices: defaultSlices(6),
      pointer_color: "#ffffff",
      inner_circle: true,
      inner_circle_color: "#fafafa",
      inner_circle_border_color: "#e5e5e5",
      border_color: "#ffffff",
      divider_color: "#ffffff",
      divider_enabled: true,
      divider_width: 2,
      marker_config: {
        marker_type: "circle",
        marker_color: "#ffffff",
        marker_size: 14,
        marker_count: 0,
        marker_position: 100,
      },
      category_colors: {},
      player_config: {
        desired_total_slices: 6,
        categories: [],
        player_repetitions: 8,
      },
    },
  };
}
