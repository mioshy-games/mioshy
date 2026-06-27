-- ───────────────────────────────────────────────────────────────────────────
-- 149_rename_livuy_to_yeutz_zugi_he.sql
--
-- Copy-only rename of the Hebrew product phrase "ליווי עם מיאושי" →
-- "ייעוץ זוגי עם מיאושי" across LIVE Hebrew content. Hebrew columns ONLY —
-- never text_en / *_en. The REPLACE matches the FULL phrase only, so prefixed
-- forms fold correctly ("לליווי עם מיאושי" → "לייעוץ זוגי עם מיאושי",
-- "הליווי עם מיאושי" → "הייעוץ זוגי עם מיאושי") while a standalone "ליווי" is
-- never touched.
--
-- Pure data UPDATE — no schema change, no logic. Each statement is guarded by
-- LIKE so it only rewrites rows that contain the phrase and is idempotent
-- (re-running is a no-op once converted). Itzik runs this migration manually.
-- ───────────────────────────────────────────────────────────────────────────

-- 1. CMS strings (admin-editable copy).
UPDATE public.cms_texts
SET    text_he = REPLACE(text_he, 'ליווי עם מיאושי', 'ייעוץ זוגי עם מיאושי')
WHERE  text_he LIKE '%ליווי עם מיאושי%';

-- 2. Article bodies (seed 063 — public/articles markdown).
UPDATE public.articles
SET    content_he = REPLACE(content_he, 'ליווי עם מיאושי', 'ייעוץ זוגי עם מיאושי')
WHERE  content_he LIKE '%ליווי עם מיאושי%';

-- 3. Journey program name + body content (seed 065). The live phrase sits in
--    journey_programs.name_he; journey_items.body_he is covered too for
--    completeness (LIKE-guarded → no-op if absent).
UPDATE public.journey_programs
SET    name_he = REPLACE(name_he, 'ליווי עם מיאושי', 'ייעוץ זוגי עם מיאושי')
WHERE  name_he LIKE '%ליווי עם מיאושי%';

UPDATE public.journey_items
SET    body_he = REPLACE(body_he, 'ליווי עם מיאושי', 'ייעוץ זוגי עם מיאושי')
WHERE  body_he LIKE '%ליווי עם מיאושי%';
