export type QuestionType = string;
export type QuestionLevel = "light" | "flirty" | "deep";

export type WheelSlice = {
  id: string;
  label_he: string;
  label_en: string;
  color: string;
  question_type: QuestionType;
};

export type GameRow = {
  id: string;
  name_he: string;
  name_en: string;
  description_he: string;
  description_en: string;
  slug: string;
  thumbnail_url: string | null;
  is_active: boolean;
  bg_type: "color" | "image";
  bg_value: string;
  player_mode?: boolean;
  created_at: string;
};

export type WheelConfigRow = {
  id: string;
  game_id: string;
  slices: WheelSlice[];
  pointer_color: string;
  inner_circle: boolean;
  inner_circle_color: string;
  inner_circle_border_color: string;
  border_color: string;
  divider_color: string;
  /** Legacy column from older migration (kept for compatibility). */
  show_divider?: boolean;
  divider_enabled?: boolean;
  divider_width?: number;
  marker_config?: Record<string, unknown>;
  category_colors?: Record<string, string>;
  player_config?: Record<string, unknown>;
  created_at: string;
};

export type QuestionRow = {
  id: string;
  game_id: string;
  type: QuestionType;
  level: QuestionLevel;
  text_he: string;
  text_en: string;
  is_active: boolean;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  role: string;
};

export type SiteSettingsRow = {
  id: number;
  updated_at: string;
  home_hero_bg_type: "gradient" | "image";
  home_hero_bg_value: string;
  expert_photo_url: string | null;
  social_proof_couples_count: number;
  rating_value: number;
  rating_count: number;
};

export type ArticleRow = {
  id: string;
  slug: string;
  title_he: string | null;
  title_en: string | null;
  excerpt_he: string | null;
  excerpt_en: string | null;
  content_he: string | null;
  content_en: string | null;
  cover_image_url: string | null;
  emoji?: string | null;
  author: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  meta_title_he: string | null;
  meta_title_en: string | null;
  meta_description_he: string | null;
  meta_description_en: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
  tags: string[];
  reading_time_minutes: number | null;
};

export type GameRoomRow = {
  id: string;
  code: string;
  game_type: "wheel" | "snakes";
  status: "lobby" | "playing" | "ended";
  host_id: string | null;
  game_state: Record<string, unknown>;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GamePlayerRow = {
  id: string;
  room_id: string;
  user_id: string | null;
  user_name: string;
  avatar: string;
  color: string;
  position: number;
  order_index: number;
  is_host: boolean;
  created_at: string;
};

export type SnakesLaddersConfigRow = {
  id: string;
  name: string;
  board_size: number;
  coin_heads_steps: number;
  coin_tails_steps: number;
  penalty_type: "back5" | "start";
  penalty_steps: number;
  snakes: unknown[];
  ladders: unknown[];
  questions: unknown[];
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};
