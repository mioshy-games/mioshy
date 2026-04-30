export type SnakeOrLadder = {
  from: number;
  to: number;
  emoji: string;
  label: string;
};

/** Difficulty level - 1 = קליל, 2 = בינוני, 3 = מאתגר */
export type QuestionLevel = 1 | 2 | 3;

export type Question = {
  id: string;
  type: "question" | "challenge";
  text_he: string;
  text_en: string;
  category: string;
  /** Difficulty level 1–3. Optional; absent in legacy data is treated as 1. */
  level?: QuestionLevel;
};

export type SnakesConfig = {
  id: string;
  name: string;
  board_size: number;
  coin_heads_steps: number;
  coin_tails_steps: number;
  penalty_type: "back5" | "start";
  penalty_steps: number;
  snakes: SnakeOrLadder[];
  ladders: SnakeOrLadder[];
  questions: Question[];
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
  // ── SEO / identity ──────────────────────────────────────────────────────────
  slug?: string | null;
  game_name_he?: string | null;
  game_name_en?: string | null;
  meta_title_he?: string | null;
  meta_title_en?: string | null;
  meta_description_he?: string | null;
  meta_description_en?: string | null;
};

