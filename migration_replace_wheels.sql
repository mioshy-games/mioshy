-- =====================================================================
-- MIGRATION: Replace wheels content (wheels only)
-- =====================================================================
-- Scope: ONLY games that have a wheel_configs entry.
-- Other product types (journey, adults, etc.) are untouched.
--
-- Strategy:
--   1. Snapshot existing wheel-game IDs into a temp list
--   2. Delete questions for those games
--   3. Delete wheel_configs for those games
--   4. Delete the games rows themselves
--   5. Re-insert from the new seed (paste below, or run new seed file after)
--
-- SAFETY:
--   - Wrapped in a single transaction - if anything fails, nothing is committed
--   - Run on staging first
--   - Take a Supabase snapshot before running on prod
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Step 1: Identify wheel games (those that currently have a wheel_config)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE wheel_game_ids ON COMMIT DROP AS
SELECT DISTINCT game_id
FROM public.wheel_configs;

-- Sanity check - log how many wheels we're about to wipe
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt FROM wheel_game_ids;
  RAISE NOTICE 'About to replace % wheel games', cnt;
END $$;

-- ---------------------------------------------------------------------
-- Step 2: Delete dependent rows first (FK order)
-- ---------------------------------------------------------------------
DELETE FROM public.questions
 WHERE game_id IN (SELECT game_id FROM wheel_game_ids);

DELETE FROM public.wheel_configs
 WHERE game_id IN (SELECT game_id FROM wheel_game_ids);

-- ---------------------------------------------------------------------
-- Step 3: Delete the parent games rows
-- ---------------------------------------------------------------------
DELETE FROM public.games
 WHERE id IN (SELECT game_id FROM wheel_game_ids);

-- ---------------------------------------------------------------------
-- Step 4: Insert new wheel content
-- ---------------------------------------------------------------------
-- Option A: paste the new seed blocks below (DO $$ ... END $$; per game)
-- Option B: leave this file as a "wipe", then run your new seed file after.
--
-- Example for ONE game (copy-paste this DO block per new wheel):
--
-- DO $$
-- DECLARE
--   g_id uuid;
-- BEGIN
--   INSERT INTO public.games
--     (name_he, name_en, description_he, description_en, slug,
--      is_active, bg_type, bg_value, player_mode)
--   VALUES (
--     'שם המשחק',
--     'Game Name EN',
--     'תיאור',
--     'Description EN',
--     'slug-unique',
--     true, 'color', '#1a0a2e', false
--   )
--   RETURNING id INTO g_id;
--
--   INSERT INTO public.wheel_configs
--     (game_id, slices, pointer_color, inner_circle, inner_circle_color,
--      inner_circle_border_color, border_color, divider_color,
--      divider_enabled, divider_width, marker_config,
--      category_colors, player_config)
--   VALUES (
--     g_id,
--     '[ ... slices JSON ... ]'::jsonb,
--     '#ffffff', true, '#1a1a2e', '#ffffff', '#ffffff', '#ffffff', true, 2,
--     '{ ... marker_config JSON ... }'::jsonb,
--     '{ ... category_colors JSON ... }'::jsonb,
--     '{ ... player_config JSON ... }'::jsonb
--   );
--
--   INSERT INTO public.questions (game_id, type, level, text_he, text_en, is_active) VALUES
--     (g_id, 'category_key', 'level', 'שאלה בעברית', 'Question EN', true),
--     (g_id, 'category_key', 'level', 'שאלה נוספת',   'Another EN',  true);
-- END $$;

-- ---------------------------------------------------------------------
-- Step 5: Verify before commit
-- ---------------------------------------------------------------------
DO $$
DECLARE
  game_cnt int;
  wheel_cnt int;
  q_cnt int;
BEGIN
  SELECT COUNT(*) INTO wheel_cnt FROM public.wheel_configs;
  SELECT COUNT(DISTINCT g.id) INTO game_cnt
    FROM public.games g
    JOIN public.wheel_configs wc ON wc.game_id = g.id;
  SELECT COUNT(*) INTO q_cnt
    FROM public.questions q
    WHERE q.game_id IN (SELECT game_id FROM public.wheel_configs);

  RAISE NOTICE '== After migration ==';
  RAISE NOTICE 'Wheel games: %, wheel_configs: %, questions: %',
               game_cnt, wheel_cnt, q_cnt;
END $$;

-- If the numbers above look wrong: run ROLLBACK; instead of COMMIT;
COMMIT;

-- =====================================================================
-- Rollback (run only if something went wrong AFTER commit):
-- Restore from your Supabase snapshot. There is no automatic rollback
-- once the transaction is committed.
-- =====================================================================
