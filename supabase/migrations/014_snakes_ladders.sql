-- Snakes & Ladders multiplayer (rooms + players + admin config)

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- game_rooms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  game_type text NOT NULL DEFAULT 'wheel',
  status text NOT NULL DEFAULT 'lobby',
  host_id uuid REFERENCES auth.users (id),
  game_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_rooms
  DROP CONSTRAINT IF EXISTS game_rooms_game_type_check;
ALTER TABLE public.game_rooms
  ADD CONSTRAINT game_rooms_game_type_check
  CHECK (game_type IN ('wheel', 'snakes'));

ALTER TABLE public.game_rooms
  DROP CONSTRAINT IF EXISTS game_rooms_status_check;
ALTER TABLE public.game_rooms
  ADD CONSTRAINT game_rooms_status_check
  CHECK (status IN ('lobby', 'playing', 'ended'));

ALTER TABLE public.game_rooms
  DROP CONSTRAINT IF EXISTS game_rooms_code_check;
ALTER TABLE public.game_rooms
  ADD CONSTRAINT game_rooms_code_check
  CHECK (code ~ '^[A-Z0-9]{4}$');

CREATE INDEX IF NOT EXISTS game_rooms_code_idx ON public.game_rooms (code);
CREATE INDEX IF NOT EXISTS game_rooms_created_at_idx ON public.game_rooms (created_at DESC);

DROP TRIGGER IF EXISTS set_updated_at_game_rooms ON public.game_rooms;
CREATE TRIGGER set_updated_at_game_rooms
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rooms_read" ON public.game_rooms;
CREATE POLICY "rooms_read"
  ON public.game_rooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "rooms_insert" ON public.game_rooms;
CREATE POLICY "rooms_insert"
  ON public.game_rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rooms_update" ON public.game_rooms;
CREATE POLICY "rooms_update"
  ON public.game_rooms FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.game_players gp
      WHERE gp.room_id = game_rooms.id
        AND gp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- game_players
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES public.game_rooms (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id),
  user_name text NOT NULL,
  avatar text NOT NULL DEFAULT '💜',
  color text NOT NULL DEFAULT '#c084fc',
  position int NOT NULL DEFAULT 0,
  order_index int NOT NULL DEFAULT 0,
  is_host boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_players
  DROP CONSTRAINT IF EXISTS game_players_position_check;
ALTER TABLE public.game_players
  ADD CONSTRAINT game_players_position_check
  CHECK (position >= 0);

ALTER TABLE public.game_players
  DROP CONSTRAINT IF EXISTS game_players_order_index_check;
ALTER TABLE public.game_players
  ADD CONSTRAINT game_players_order_index_check
  CHECK (order_index >= 0);

CREATE INDEX IF NOT EXISTS game_players_room_id_idx ON public.game_players (room_id);
CREATE INDEX IF NOT EXISTS game_players_user_id_idx ON public.game_players (user_id);

ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "players_read" ON public.game_players;
CREATE POLICY "players_read"
  ON public.game_players FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "players_insert" ON public.game_players;
CREATE POLICY "players_insert"
  ON public.game_players FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "players_update" ON public.game_players;
CREATE POLICY "players_update"
  ON public.game_players FOR UPDATE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- snakes_ladders_config (admin-controlled)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.snakes_ladders_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  board_size int NOT NULL DEFAULT 100,
  coin_heads_steps int NOT NULL DEFAULT 3,
  coin_tails_steps int NOT NULL DEFAULT 1,
  penalty_type text NOT NULL DEFAULT 'back5',
  penalty_steps int NOT NULL DEFAULT 5,
  snakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ladders jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.snakes_ladders_config
  DROP CONSTRAINT IF EXISTS snakes_ladders_config_board_size_check;
ALTER TABLE public.snakes_ladders_config
  ADD CONSTRAINT snakes_ladders_config_board_size_check
  CHECK (board_size > 1);

ALTER TABLE public.snakes_ladders_config
  DROP CONSTRAINT IF EXISTS snakes_ladders_config_penalty_type_check;
ALTER TABLE public.snakes_ladders_config
  ADD CONSTRAINT snakes_ladders_config_penalty_type_check
  CHECK (penalty_type IN ('back5', 'start'));

ALTER TABLE public.snakes_ladders_config
  DROP CONSTRAINT IF EXISTS snakes_ladders_config_coin_heads_steps_check;
ALTER TABLE public.snakes_ladders_config
  ADD CONSTRAINT snakes_ladders_config_coin_heads_steps_check
  CHECK (coin_heads_steps >= 0);

ALTER TABLE public.snakes_ladders_config
  DROP CONSTRAINT IF EXISTS snakes_ladders_config_coin_tails_steps_check;
ALTER TABLE public.snakes_ladders_config
  ADD CONSTRAINT snakes_ladders_config_coin_tails_steps_check
  CHECK (coin_tails_steps >= 0);

ALTER TABLE public.snakes_ladders_config
  DROP CONSTRAINT IF EXISTS snakes_ladders_config_penalty_steps_check;
ALTER TABLE public.snakes_ladders_config
  ADD CONSTRAINT snakes_ladders_config_penalty_steps_check
  CHECK (penalty_steps >= 0);

CREATE INDEX IF NOT EXISTS snakes_ladders_config_active_idx ON public.snakes_ladders_config (is_active);
CREATE UNIQUE INDEX IF NOT EXISTS snakes_ladders_config_one_active
  ON public.snakes_ladders_config ((is_active))
  WHERE is_active;

DROP TRIGGER IF EXISTS set_updated_at_snakes_ladders_config ON public.snakes_ladders_config;
CREATE TRIGGER set_updated_at_snakes_ladders_config
  BEFORE UPDATE ON public.snakes_ladders_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.snakes_ladders_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_read" ON public.snakes_ladders_config;
CREATE POLICY "config_read"
  ON public.snakes_ladders_config FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "config_admin_all" ON public.snakes_ladders_config;
CREATE POLICY "config_admin_all"
  ON public.snakes_ladders_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- Enable Realtime
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;

-- ---------------------------------------------------------------------------
-- Seed default config (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.snakes_ladders_config (name, is_active, is_default, snakes, ladders, questions)
SELECT
  'Default Couples',
  true,
  true,
  '[
    {"from":97,"to":78,"emoji":"🐍","label":"נחש גדול"},
    {"from":95,"to":56,"emoji":"🐍","label":""},
    {"from":88,"to":24,"emoji":"🐍","label":""},
    {"from":62,"to":18,"emoji":"🐍","label":""},
    {"from":48,"to":26,"emoji":"🐍","label":""},
    {"from":36,"to":6,"emoji":"🐍","label":""},
    {"from":32,"to":10,"emoji":"🐍","label":""}
  ]'::jsonb,
  '[
    {"from":4,"to":38,"emoji":"🌈","label":"סולם אהבה"},
    {"from":8,"to":30,"emoji":"🌈","label":""},
    {"from":28,"to":84,"emoji":"🌈","label":""},
    {"from":40,"to":59,"emoji":"🌈","label":""},
    {"from":51,"to":67,"emoji":"🌈","label":""},
    {"from":63,"to":81,"emoji":"🌈","label":""},
    {"from":71,"to":91,"emoji":"🌈","label":""}
  ]'::jsonb,
  '[
    {"id":"q1","type":"question","text_he":"מה הדבר הכי אהוב עליך בבן/בת הזוג שלך?","text_en":"What do you love most about your partner?","category":"love"},
    {"id":"q2","type":"question","text_he":"אם יכולתם לנסוע לכל מקום, לאן?","text_en":"If you could travel anywhere, where?","category":"dreams"},
    {"id":"q3","type":"challenge","text_he":"תן/י לבן/בת הזוג חיבוק של 10 שניות","text_en":"Give your partner a 10-second hug","category":"physical"},
    {"id":"q4","type":"question","text_he":"מה הזיכרון הטוב ביותר שלכם כזוג?","text_en":"What is your best memory as a couple?","category":"memories"},
    {"id":"q5","type":"challenge","text_he":"אמור/י משהו שאולי לא אמרת לאחרונה","text_en":"Say something you have not said recently","category":"emotional"},
    {"id":"q6","type":"question","text_he":"תאר/י את בן/בת הזוג שלך ב-3 מילים","text_en":"Describe your partner in 3 words","category":"love"},
    {"id":"q7","type":"challenge","text_he":"ריקוד זוגי של 15 שניות","text_en":"Dance together for 15 seconds","category":"physical"},
    {"id":"q8","type":"question","text_he":"מה הייתה הדייט הטובה ביותר?","text_en":"What was your best date?","category":"memories"}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.snakes_ladders_config WHERE is_default = true
);

