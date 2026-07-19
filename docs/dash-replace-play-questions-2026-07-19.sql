-- ===========================================================================
-- dash-replace-play-questions-2026-07-19.sql   (run in the Supabase SQL editor)
--
-- Follow-up to dash-replace-all-content-2026-07-19.sql. Covers the two text[]
-- (array) columns that the main pass skipped: experience_games.play_questions_he
-- and .play_questions_en. Same rule: em-dash (U+2014), horizontal bar (U+2015),
-- en-dash (U+2013) -> plain hyphen '-', element-wise, order preserved.
--
-- SAFE + REVERSIBLE: before-image of each changed array is stored as its ::text
-- literal in public.dash_replace_backup (the SAME table the main pass created;
-- restore with old_value::text[]). IDEMPOTENT: the WHERE gate matches only rows
-- whose array still contains a dash, so a 2nd run changes 0 rows. One transaction.
--
-- Discovery: 1 row (slug '52-ways-to-drive-you-wild'), 3 en-dash question strings.
-- ===========================================================================

BEGIN;

-- ---- experience_games.play_questions_he (text[]) ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'experience_games', 'play_questions_he', id::text,
       play_questions_he::text,
       ( SELECT array_agg(translate(e, '—–―', '---') ORDER BY ord)
           FROM unnest(play_questions_he) WITH ORDINALITY AS u(e, ord) )::text
FROM public.experience_games
WHERE array_to_string(play_questions_he, E'\x01') ~ '[—–―]';

UPDATE public.experience_games
SET play_questions_he = ( SELECT array_agg(translate(e, '—–―', '---') ORDER BY ord)
                            FROM unnest(play_questions_he) WITH ORDINALITY AS u(e, ord) )
WHERE array_to_string(play_questions_he, E'\x01') ~ '[—–―]';

-- ---- experience_games.play_questions_en (text[]) ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'experience_games', 'play_questions_en', id::text,
       play_questions_en::text,
       ( SELECT array_agg(translate(e, '—–―', '---') ORDER BY ord)
           FROM unnest(play_questions_en) WITH ORDINALITY AS u(e, ord) )::text
FROM public.experience_games
WHERE array_to_string(play_questions_en, E'\x01') ~ '[—–―]';

UPDATE public.experience_games
SET play_questions_en = ( SELECT array_agg(translate(e, '—–―', '---') ORDER BY ord)
                            FROM unnest(play_questions_en) WITH ORDINALITY AS u(e, ord) )
WHERE array_to_string(play_questions_en, E'\x01') ~ '[—–―]';

COMMIT;

-- Rows changed by THIS pass:
--   SELECT count(*) FROM public.dash_replace_backup
--   WHERE tbl='experience_games' AND col IN ('play_questions_he','play_questions_en');
--
-- REVERSE (restore before-images) -- run only if you need to roll back:
--   BEGIN;
--   UPDATE public.experience_games t SET play_questions_he = b.old_value::text[] FROM public.dash_replace_backup b WHERE b.tbl='experience_games' AND b.col='play_questions_he' AND b.row_id = t.id::text;
--   UPDATE public.experience_games t SET play_questions_en = b.old_value::text[] FROM public.dash_replace_backup b WHERE b.tbl='experience_games' AND b.col='play_questions_en' AND b.row_id = t.id::text;
--   COMMIT;
