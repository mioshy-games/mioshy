-- Player mode + unlimited categories + category colors mapping

-- ---------------------------------------------------------------------------
-- games: player mode flag
-- ---------------------------------------------------------------------------
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS player_mode boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- questions: allow unlimited category names (drop strict type check)
-- ---------------------------------------------------------------------------
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_type_check;

-- ---------------------------------------------------------------------------
-- wheel_configs: category colors + player config
-- ---------------------------------------------------------------------------
ALTER TABLE public.wheel_configs
  ADD COLUMN IF NOT EXISTS category_colors jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.wheel_configs
  ADD COLUMN IF NOT EXISTS player_config jsonb NOT NULL DEFAULT '{}'::jsonb;

