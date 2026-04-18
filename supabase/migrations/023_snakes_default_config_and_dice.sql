-- 023_snakes_default_config_and_dice.sql
--
-- One-shot idempotent migration. Running this on a clean Supabase project
-- brings the Snakes & Ladders multiplayer to working state. Running it again
-- on a project that already has some pieces installed is safe — every
-- statement is guarded with IF NOT EXISTS / CREATE OR REPLACE.
--
-- What this file installs:
--   1. Character-locking columns + unique indexes on game_players.
--   2. claim_player_character() / unlock_player_character() RPCs.
--   3. update_snakes_room_state() RPC (turn enforcement for game moves).
--   4. Default active row in snakes_ladders_config so rooms have a config.
--
-- No schema change is needed for the coin→dice move; `lastDiceResult` lives
-- inside the existing JSONB `game_state` column.

-- ── 1) Character / colour locking columns ────────────────────────────────
ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS is_ready boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS game_players_room_avatar_locked
  ON public.game_players (room_id, avatar)
  WHERE is_locked = true;

CREATE UNIQUE INDEX IF NOT EXISTS game_players_room_color_locked
  ON public.game_players (room_id, color)
  WHERE is_locked = true;

-- ── 2) RPC: claim_player_character ───────────────────────────────────────
-- Atomic check-and-lock. Returns one of:
--   'ok' | 'avatar_taken' | 'color_taken' | 'not_found'
CREATE OR REPLACE FUNCTION public.claim_player_character(
  p_player_id uuid,
  p_room_id   uuid,
  p_avatar    text,
  p_color     text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_caller  uuid;
BEGIN
  v_caller := auth.uid();

  SELECT user_id INTO v_user_id
    FROM public.game_players
   WHERE id = p_player_id AND room_id = p_room_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_user_id IS NOT NULL AND v_user_id IS DISTINCT FROM v_caller THEN
    RETURN 'not_found';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.game_players
     WHERE room_id   = p_room_id
       AND avatar    = p_avatar
       AND is_locked = true
       AND id        <> p_player_id
  ) THEN
    RETURN 'avatar_taken';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.game_players
     WHERE room_id   = p_room_id
       AND color     = p_color
       AND is_locked = true
       AND id        <> p_player_id
  ) THEN
    RETURN 'color_taken';
  END IF;

  UPDATE public.game_players
     SET avatar    = p_avatar,
         color     = p_color,
         is_locked = true
   WHERE id      = p_player_id
     AND room_id = p_room_id;

  RETURN 'ok';
END;
$$;

-- ── unlock_player_character ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unlock_player_character(
  p_player_id uuid,
  p_room_id   uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
    FROM public.game_players
   WHERE id = p_player_id AND room_id = p_room_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_user_id IS NOT NULL AND v_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  UPDATE public.game_players
     SET is_locked = false
   WHERE id = p_player_id AND room_id = p_room_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_player_character  TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_player_character TO authenticated;

-- ── 3) RPC: update_snakes_room_state (turn enforcement) ──────────────────
CREATE OR REPLACE FUNCTION public.update_snakes_room_state(
  room_id uuid,
  actor_player_id uuid,
  new_game_state jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  actor public.game_players%ROWTYPE;
  room public.game_rooms%ROWTYPE;
  idx int;
  current_pid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO room FROM public.game_rooms WHERE id = room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room not found';
  END IF;

  SELECT * INTO actor FROM public.game_players WHERE id = actor_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'player not found';
  END IF;
  IF actor.room_id <> room_id THEN
    RAISE EXCEPTION 'player not in room';
  END IF;
  IF actor.user_id IS NULL OR actor.user_id <> uid THEN
    RAISE EXCEPTION 'not your player';
  END IF;

  idx := COALESCE(NULLIF((room.game_state->>'currentPlayerIndex')::int, NULL), 0);

  SELECT gp.id INTO current_pid
  FROM public.game_players gp
  WHERE gp.room_id = room_id
  ORDER BY gp.order_index ASC, gp.created_at ASC
  OFFSET idx
  LIMIT 1;

  IF current_pid IS NULL THEN
    RAISE EXCEPTION 'no current player';
  END IF;
  IF current_pid <> actor_player_id THEN
    RAISE EXCEPTION 'not your turn';
  END IF;

  UPDATE public.game_rooms
     SET game_state = new_game_state
   WHERE id = room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_snakes_room_state TO authenticated;

-- ── 4) Default active config row ─────────────────────────────────────────
-- A unique partial index (from migration 014) ensures at most one active row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.snakes_ladders_config WHERE is_active = true
  ) THEN
    INSERT INTO public.snakes_ladders_config (
      name,
      board_size,
      coin_heads_steps,
      coin_tails_steps,
      penalty_type,
      penalty_steps,
      snakes,
      ladders,
      questions,
      is_active
    ) VALUES (
      'Mioshy Classic',
      100,
      3,
      1,
      'back5',
      5,
      '[
        {"from": 17, "to": 7,  "emoji": "🐍", "label": "נסיגה רגשית"},
        {"from": 27, "to": 11, "emoji": "🐍", "label": "הגנה אוטומטית"},
        {"from": 36, "to": 19, "emoji": "🐍", "label": "עייפות של הרגע"},
        {"from": 49, "to": 32, "emoji": "🐍", "label": "ביקורת זעירה"},
        {"from": 62, "to": 45, "emoji": "🐍", "label": "חוסר נוכחות"},
        {"from": 75, "to": 58, "emoji": "🐍", "label": "הסחת דעת"},
        {"from": 87, "to": 70, "emoji": "🐍", "label": "פחד מחשיפה"},
        {"from": 95, "to": 79, "emoji": "🐍", "label": "רגע של ריחוק"}
      ]'::jsonb,
      '[
        {"from": 4,  "to": 14, "emoji": "🪜", "label": "גילוי קטן"},
        {"from": 9,  "to": 31, "emoji": "🪜", "label": "קפיצת אמונה"},
        {"from": 20, "to": 38, "emoji": "🪜", "label": "רגע מחבר"},
        {"from": 28, "to": 47, "emoji": "🪜", "label": "מבט חדש"},
        {"from": 40, "to": 59, "emoji": "🪜", "label": "אומץ לדבר"},
        {"from": 51, "to": 67, "emoji": "🪜", "label": "צחוק משותף"},
        {"from": 63, "to": 81, "emoji": "🪜", "label": "נשימה ביחד"},
        {"from": 71, "to": 91, "emoji": "🪜", "label": "שיתוף עמוק"}
      ]'::jsonb,
      '[
        {"id": "q1",  "type": "question",  "text_he": "מה החלום הכי גדול שלך שעדיין לא סיפרת עליו?",              "text_en": "What''s your biggest dream you haven''t shared yet?",        "category": "love"},
        {"id": "q2",  "type": "question",  "text_he": "מה הדבר הראשון שמשך אותך אליי?",                              "text_en": "What first drew you to me?",                                      "category": "love"},
        {"id": "q3",  "type": "question",  "text_he": "איזה רגע ביחד הכי מצחיק שאתה זוכר?",                         "text_en": "What''s the funniest moment we''ve had together?",               "category": "fun"},
        {"id": "q4",  "type": "question",  "text_he": "מה משהו קטן שאני עושה שממלא אותך שמחה?",                   "text_en": "What''s a small thing I do that makes you happy?",               "category": "love"},
        {"id": "q5",  "type": "question",  "text_he": "איזה חופשה היית רוצה שנצא אליה בשנה הקרובה?",             "text_en": "What''s a trip you''d love us to take this year?",               "category": "future"},
        {"id": "q6",  "type": "question",  "text_he": "מה שיר שמזכיר לך אותי?",                                        "text_en": "What song reminds you of me?",                                    "category": "love"},
        {"id": "q7",  "type": "challenge", "text_he": "תנו חיבוק של 20 שניות בלי לדבר.",                              "text_en": "Give each other a 20-second hug, no talking.",                    "category": "intimacy"},
        {"id": "q8",  "type": "challenge", "text_he": "אמר/י שלושה מחמאות עכשיו, עין בעין.",                         "text_en": "Say three compliments now, eyes locked.",                         "category": "intimacy"},
        {"id": "q9",  "type": "challenge", "text_he": "ספרו על פעם ששני אחד הציל את השני ברגע טעון.",           "text_en": "Tell about a time one of you saved the other in a charged moment.", "category": "memories"},
        {"id": "q10", "type": "challenge", "text_he": "צרו רגע של קשר עין ללא מילים למשך דקה.",                       "text_en": "Make a full minute of wordless eye contact.",                     "category": "intimacy"},
        {"id": "q11", "type": "question",  "text_he": "מה החוזקה הכי גדולה שלך שלא תמיד רואים?",                     "text_en": "What''s your greatest strength people don''t always see?",       "category": "self"},
        {"id": "q12", "type": "question",  "text_he": "מה הדבר הכי אמיץ שעשית בשנה האחרונה?",                       "text_en": "What''s the bravest thing you did this past year?",              "category": "self"},
        {"id": "q13", "type": "challenge", "text_he": "רקדו דקה לשיר שהדליק אתכם פעם.",                              "text_en": "Dance for a minute to a song that used to light you up.",         "category": "fun"},
        {"id": "q14", "type": "question",  "text_he": "איזה רגע קטן היום גרם לך לחייך?",                             "text_en": "What small moment today made you smile?",                         "category": "gratitude"},
        {"id": "q15", "type": "challenge", "text_he": "שלחו הודעת תודה קצרה למישהו שחשוב לכם.",                      "text_en": "Send a short thank-you note to someone who matters.",             "category": "gratitude"},
        {"id": "q16", "type": "question",  "text_he": "מה הדבר הכי רומנטי שאפשר לעשות השבוע?",                       "text_en": "What''s the most romantic thing we could do this week?",         "category": "love"}
      ]'::jsonb,
      true
    );
  END IF;
END
$$;

-- ── 5) Refresh PostgREST schema cache ────────────────────────────────────
-- Supabase caches function signatures; after (re)creating RPCs, tell
-- PostgREST to reload so the API layer finds them immediately without a
-- project restart.
NOTIFY pgrst, 'reload schema';
