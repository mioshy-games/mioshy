-- =====================================================================
-- MIGRATION: Replace QUESTIONS only (wheels)
-- =====================================================================
-- Scope: Only the questions table, only for wheel-type games.
-- Games (public.games)             — UNCHANGED
-- Wheel configs (wheel_configs)    — UNCHANGED (colors, slices, categories)
-- Questions (public.questions)     — REPLACED with new content
--
-- This means the wheel layout, colors, slug, and metadata stay the same;
-- only the pool of questions that come out when the wheel lands changes.
--
-- SAFETY:
--   - Single transaction. If anything fails — full rollback automatically.
--   - Run on staging first.
--   - Take a Supabase snapshot before running on prod.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Step 1: Identify wheel games (those that have a wheel_config)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE wheel_game_ids ON COMMIT DROP AS
SELECT DISTINCT game_id FROM public.wheel_configs;

DO $$
DECLARE
  game_cnt int;
  q_before int;
BEGIN
  SELECT COUNT(*) INTO game_cnt FROM wheel_game_ids;
  SELECT COUNT(*) INTO q_before
    FROM public.questions
    WHERE game_id IN (SELECT game_id FROM wheel_game_ids);
  RAISE NOTICE 'Found % wheel games. Will delete % existing questions.',
               game_cnt, q_before;
END $$;

-- ---------------------------------------------------------------------
-- Step 2: Delete existing questions FOR WHEEL GAMES ONLY
-- ---------------------------------------------------------------------
DELETE FROM public.questions
 WHERE game_id IN (SELECT game_id FROM wheel_game_ids);

-- ---------------------------------------------------------------------
-- Step 3: Insert new questions
-- ---------------------------------------------------------------------
-- IMPORTANT: each row needs a valid game_id from the existing wheels.
-- Look up the game_id by slug to keep the script readable & re-runnable.
--
-- Pattern per game:
--   INSERT INTO public.questions (game_id, type, level, text_he, text_en, is_active)
--   SELECT g.id, 'category_key', 'level', 'שאלה', 'Question', true
--     FROM public.games g WHERE g.slug = 'first-date-spin'
--   UNION ALL
--   SELECT g.id, 'category_key', 'level', 'עוד שאלה', 'Another', true
--     FROM public.games g WHERE g.slug = 'first-date-spin';
--
-- Or — bulk pattern using a CTE per game:
--   WITH g AS (SELECT id FROM public.games WHERE slug = 'first-date-spin')
--   INSERT INTO public.questions (game_id, type, level, text_he, text_en, is_active)
--   SELECT g.id, t.type, t.level, t.text_he, t.text_en, true
--   FROM g, (VALUES
--     ('icebreaker','light','שאלה 1','Question 1'),
--     ('icebreaker','light','שאלה 2','Question 2'),
--     ('curiosity','flirty','שאלה 3','Question 3')
--   ) AS t(type, level, text_he, text_en);

-- ====== PASTE NEW QUESTION INSERTS BELOW THIS LINE ======

-- Example: first-date-spin
WITH g AS (SELECT id FROM public.games WHERE slug = 'first-date-spin' LIMIT 1)
INSERT INTO public.questions (game_id, type, level, text_he, text_en, is_active)
SELECT g.id, t.type, t.level, t.text_he, t.text_en, true
FROM g, (VALUES
  -- ('icebreaker','light','שאלה חדשה בעברית','New question in English'),
  -- add your new rows here ...
  (NULL::text, NULL::text, NULL::text, NULL::text)  -- placeholder, remove when adding real rows
) AS t(type, level, text_he, text_en)
WHERE t.type IS NOT NULL;

-- Repeat the WITH ... INSERT block for every wheel slug:
--   first-date-spin
--   couple-heart-spin
--   friends-party-spin
--   intimate-sparks-spin
--   couple-renewal-spin
--   better-date-spin
--   ... (and any other wheel slugs you have)

-- ====== PASTE NEW QUESTION INSERTS ABOVE THIS LINE ======

-- ---------------------------------------------------------------------
-- Step 4: Verify before commit
-- ---------------------------------------------------------------------
DO $$
DECLARE
  q_after int;
  game_cnt int;
BEGIN
  SELECT COUNT(*) INTO q_after
    FROM public.questions
    WHERE game_id IN (SELECT game_id FROM public.wheel_configs);
  SELECT COUNT(DISTINCT game_id) INTO game_cnt
    FROM public.questions
    WHERE game_id IN (SELECT game_id FROM public.wheel_configs);
  RAISE NOTICE '== After migration ==';
  RAISE NOTICE 'Total questions across wheels: %', q_after;
  RAISE NOTICE 'Wheel games that have at least 1 question: %', game_cnt;
END $$;

-- If the numbers above look wrong — replace COMMIT with ROLLBACK.
COMMIT;
