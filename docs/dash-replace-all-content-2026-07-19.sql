-- ===========================================================================
-- dash-replace-all-content-2026-07-19.sql   (run in the Supabase SQL editor)
--
-- Brand voice forbids the long dash. Across ALL user-facing content columns,
-- replace em-dash (U+2014), horizontal bar (U+2015) and en-dash (U+2013) with a
-- plain hyphen '-'. translate() is CHARACTER-based: it swaps only these three
-- chars in place; surrounding spaces, real hyphens and every other char are
-- untouched (' — ' -> ' - '). NULLs pass through.
--
-- SAFE + REVERSIBLE: every changed row's before-image is copied into
-- public.dash_replace_backup first. IDEMPOTENT: the WHERE gate matches only
-- rows still containing a dash, so a 2nd run changes 0 rows. One transaction.
--
-- SCOPE (live content only): 9 tables. EXCLUDES cms_text_history
-- (audit), couple_entitlements.notes (internal), and jsonb/array columns.
-- Number ranges like '15–20%' become '15-20%' — per the explicit request.
-- ===========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.dash_replace_backup (
  id          bigserial   PRIMARY KEY,
  tbl         text        NOT NULL,
  col         text        NOT NULL,
  row_id      text        NOT NULL,
  old_value   text,
  new_value   text,
  replaced_at timestamptz NOT NULL DEFAULT now()
);

-- ---- cms_texts ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'cms_texts', 'he_text', id::text, he_text, translate(he_text, '—–―', '---')
FROM public.cms_texts WHERE he_text ~ '[—–―]';
UPDATE public.cms_texts SET he_text = translate(he_text, '—–―', '---') WHERE he_text ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'cms_texts', 'en_text', id::text, en_text, translate(en_text, '—–―', '---')
FROM public.cms_texts WHERE en_text ~ '[—–―]';
UPDATE public.cms_texts SET en_text = translate(en_text, '—–―', '---') WHERE en_text ~ '[—–―]';

-- ---- articles ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'title_he', id::text, title_he, translate(title_he, '—–―', '---')
FROM public.articles WHERE title_he ~ '[—–―]';
UPDATE public.articles SET title_he = translate(title_he, '—–―', '---') WHERE title_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'title_en', id::text, title_en, translate(title_en, '—–―', '---')
FROM public.articles WHERE title_en ~ '[—–―]';
UPDATE public.articles SET title_en = translate(title_en, '—–―', '---') WHERE title_en ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'excerpt_he', id::text, excerpt_he, translate(excerpt_he, '—–―', '---')
FROM public.articles WHERE excerpt_he ~ '[—–―]';
UPDATE public.articles SET excerpt_he = translate(excerpt_he, '—–―', '---') WHERE excerpt_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'excerpt_en', id::text, excerpt_en, translate(excerpt_en, '—–―', '---')
FROM public.articles WHERE excerpt_en ~ '[—–―]';
UPDATE public.articles SET excerpt_en = translate(excerpt_en, '—–―', '---') WHERE excerpt_en ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'content_he', id::text, content_he, translate(content_he, '—–―', '---')
FROM public.articles WHERE content_he ~ '[—–―]';
UPDATE public.articles SET content_he = translate(content_he, '—–―', '---') WHERE content_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'content_en', id::text, content_en, translate(content_en, '—–―', '---')
FROM public.articles WHERE content_en ~ '[—–―]';
UPDATE public.articles SET content_en = translate(content_en, '—–―', '---') WHERE content_en ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'meta_title_he', id::text, meta_title_he, translate(meta_title_he, '—–―', '---')
FROM public.articles WHERE meta_title_he ~ '[—–―]';
UPDATE public.articles SET meta_title_he = translate(meta_title_he, '—–―', '---') WHERE meta_title_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'meta_title_en', id::text, meta_title_en, translate(meta_title_en, '—–―', '---')
FROM public.articles WHERE meta_title_en ~ '[—–―]';
UPDATE public.articles SET meta_title_en = translate(meta_title_en, '—–―', '---') WHERE meta_title_en ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'meta_description_he', id::text, meta_description_he, translate(meta_description_he, '—–―', '---')
FROM public.articles WHERE meta_description_he ~ '[—–―]';
UPDATE public.articles SET meta_description_he = translate(meta_description_he, '—–―', '---') WHERE meta_description_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'articles', 'meta_description_en', id::text, meta_description_en, translate(meta_description_en, '—–―', '---')
FROM public.articles WHERE meta_description_en ~ '[—–―]';
UPDATE public.articles SET meta_description_en = translate(meta_description_en, '—–―', '---') WHERE meta_description_en ~ '[—–―]';

-- ---- questions ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'questions', 'text_he', id::text, text_he, translate(text_he, '—–―', '---')
FROM public.questions WHERE text_he ~ '[—–―]';
UPDATE public.questions SET text_he = translate(text_he, '—–―', '---') WHERE text_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'questions', 'text_en', id::text, text_en, translate(text_en, '—–―', '---')
FROM public.questions WHERE text_en ~ '[—–―]';
UPDATE public.questions SET text_en = translate(text_en, '—–―', '---') WHERE text_en ~ '[—–―]';

-- ---- message_templates ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'message_templates', 'body_he', id::text, body_he, translate(body_he, '—–―', '---')
FROM public.message_templates WHERE body_he ~ '[—–―]';
UPDATE public.message_templates SET body_he = translate(body_he, '—–―', '---') WHERE body_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'message_templates', 'body_en', id::text, body_en, translate(body_en, '—–―', '---')
FROM public.message_templates WHERE body_en ~ '[—–―]';
UPDATE public.message_templates SET body_en = translate(body_en, '—–―', '---') WHERE body_en ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'message_templates', 'subject_he', id::text, subject_he, translate(subject_he, '—–―', '---')
FROM public.message_templates WHERE subject_he ~ '[—–―]';
UPDATE public.message_templates SET subject_he = translate(subject_he, '—–―', '---') WHERE subject_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'message_templates', 'subject_en', id::text, subject_en, translate(subject_en, '—–―', '---')
FROM public.message_templates WHERE subject_en ~ '[—–―]';
UPDATE public.message_templates SET subject_en = translate(subject_en, '—–―', '---') WHERE subject_en ~ '[—–―]';

-- ---- journey_starter_templates ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'journey_starter_templates', 'body_he', id::text, body_he, translate(body_he, '—–―', '---')
FROM public.journey_starter_templates WHERE body_he ~ '[—–―]';
UPDATE public.journey_starter_templates SET body_he = translate(body_he, '—–―', '---') WHERE body_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'journey_starter_templates', 'body_en', id::text, body_en, translate(body_en, '—–―', '---')
FROM public.journey_starter_templates WHERE body_en ~ '[—–―]';
UPDATE public.journey_starter_templates SET body_en = translate(body_en, '—–―', '---') WHERE body_en ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'journey_starter_templates', 'label_he', id::text, label_he, translate(label_he, '—–―', '---')
FROM public.journey_starter_templates WHERE label_he ~ '[—–―]';
UPDATE public.journey_starter_templates SET label_he = translate(label_he, '—–―', '---') WHERE label_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'journey_starter_templates', 'label_en', id::text, label_en, translate(label_en, '—–―', '---')
FROM public.journey_starter_templates WHERE label_en ~ '[—–―]';
UPDATE public.journey_starter_templates SET label_en = translate(label_en, '—–―', '---') WHERE label_en ~ '[—–―]';

-- ---- journey_programs ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'journey_programs', 'description_he', id::text, description_he, translate(description_he, '—–―', '---')
FROM public.journey_programs WHERE description_he ~ '[—–―]';
UPDATE public.journey_programs SET description_he = translate(description_he, '—–―', '---') WHERE description_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'journey_programs', 'description_en', id::text, description_en, translate(description_en, '—–―', '---')
FROM public.journey_programs WHERE description_en ~ '[—–―]';
UPDATE public.journey_programs SET description_en = translate(description_en, '—–―', '---') WHERE description_en ~ '[—–―]';

-- ---- experience_games ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'experience_games', 'full_desc_he', id::text, full_desc_he, translate(full_desc_he, '—–―', '---')
FROM public.experience_games WHERE full_desc_he ~ '[—–―]';
UPDATE public.experience_games SET full_desc_he = translate(full_desc_he, '—–―', '---') WHERE full_desc_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'experience_games', 'full_desc_en', id::text, full_desc_en, translate(full_desc_en, '—–―', '---')
FROM public.experience_games WHERE full_desc_en ~ '[—–―]';
UPDATE public.experience_games SET full_desc_en = translate(full_desc_en, '—–―', '---') WHERE full_desc_en ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'experience_games', 'meta_description_he', id::text, meta_description_he, translate(meta_description_he, '—–―', '---')
FROM public.experience_games WHERE meta_description_he ~ '[—–―]';
UPDATE public.experience_games SET meta_description_he = translate(meta_description_he, '—–―', '---') WHERE meta_description_he ~ '[—–―]';

-- ---- experience_game_categories ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'experience_game_categories', 'description_he', id::text, description_he, translate(description_he, '—–―', '---')
FROM public.experience_game_categories WHERE description_he ~ '[—–―]';
UPDATE public.experience_game_categories SET description_he = translate(description_he, '—–―', '---') WHERE description_he ~ '[—–―]';

INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'experience_game_categories', 'description_en', id::text, description_en, translate(description_en, '—–―', '---')
FROM public.experience_game_categories WHERE description_en ~ '[—–―]';
UPDATE public.experience_game_categories SET description_en = translate(description_en, '—–―', '---') WHERE description_en ~ '[—–―]';

-- ---- games ----
INSERT INTO public.dash_replace_backup (tbl, col, row_id, old_value, new_value)
SELECT 'games', 'description_en', id::text, description_en, translate(description_en, '—–―', '---')
FROM public.games WHERE description_en ~ '[—–―]';
UPDATE public.games SET description_en = translate(description_en, '—–―', '---') WHERE description_en ~ '[—–―]';

COMMIT;

-- Rows changed:  SELECT count(*) FROM public.dash_replace_backup;
--
-- REVERSE (restore before-images) -- run only if you need to roll back:
--   BEGIN;
--   UPDATE public.cms_texts t SET he_text = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='cms_texts' AND b.col='he_text' AND b.row_id = t.id::text;
--   UPDATE public.cms_texts t SET en_text = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='cms_texts' AND b.col='en_text' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET title_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='title_he' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET title_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='title_en' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET excerpt_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='excerpt_he' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET excerpt_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='excerpt_en' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET content_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='content_he' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET content_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='content_en' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET meta_title_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='meta_title_he' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET meta_title_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='meta_title_en' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET meta_description_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='meta_description_he' AND b.row_id = t.id::text;
--   UPDATE public.articles t SET meta_description_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='articles' AND b.col='meta_description_en' AND b.row_id = t.id::text;
--   UPDATE public.questions t SET text_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='questions' AND b.col='text_he' AND b.row_id = t.id::text;
--   UPDATE public.questions t SET text_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='questions' AND b.col='text_en' AND b.row_id = t.id::text;
--   UPDATE public.message_templates t SET body_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='message_templates' AND b.col='body_he' AND b.row_id = t.id::text;
--   UPDATE public.message_templates t SET body_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='message_templates' AND b.col='body_en' AND b.row_id = t.id::text;
--   UPDATE public.message_templates t SET subject_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='message_templates' AND b.col='subject_he' AND b.row_id = t.id::text;
--   UPDATE public.message_templates t SET subject_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='message_templates' AND b.col='subject_en' AND b.row_id = t.id::text;
--   UPDATE public.journey_starter_templates t SET body_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='journey_starter_templates' AND b.col='body_he' AND b.row_id = t.id::text;
--   UPDATE public.journey_starter_templates t SET body_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='journey_starter_templates' AND b.col='body_en' AND b.row_id = t.id::text;
--   UPDATE public.journey_starter_templates t SET label_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='journey_starter_templates' AND b.col='label_he' AND b.row_id = t.id::text;
--   UPDATE public.journey_starter_templates t SET label_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='journey_starter_templates' AND b.col='label_en' AND b.row_id = t.id::text;
--   UPDATE public.journey_programs t SET description_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='journey_programs' AND b.col='description_he' AND b.row_id = t.id::text;
--   UPDATE public.journey_programs t SET description_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='journey_programs' AND b.col='description_en' AND b.row_id = t.id::text;
--   UPDATE public.experience_games t SET full_desc_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='experience_games' AND b.col='full_desc_he' AND b.row_id = t.id::text;
--   UPDATE public.experience_games t SET full_desc_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='experience_games' AND b.col='full_desc_en' AND b.row_id = t.id::text;
--   UPDATE public.experience_games t SET meta_description_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='experience_games' AND b.col='meta_description_he' AND b.row_id = t.id::text;
--   UPDATE public.experience_game_categories t SET description_he = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='experience_game_categories' AND b.col='description_he' AND b.row_id = t.id::text;
--   UPDATE public.experience_game_categories t SET description_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='experience_game_categories' AND b.col='description_en' AND b.row_id = t.id::text;
--   UPDATE public.games t SET description_en = b.old_value FROM public.dash_replace_backup b WHERE b.tbl='games' AND b.col='description_en' AND b.row_id = t.id::text;
--   COMMIT;
