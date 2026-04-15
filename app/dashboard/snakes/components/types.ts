export type SnakeOrLadder = {
  from: number;
  to: number;
  emoji: string;
  label: string;
};

export type Question = {
  id: string;
  type: "question" | "challenge";
  text_he: string;
  text_en: string;
  category: string;
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
};

