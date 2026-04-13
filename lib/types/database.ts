export type QuestionType = "truth" | "dare" | "custom";
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
