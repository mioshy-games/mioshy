-- 077_journey_lesson_blocks.sql
--
-- Phase 1 — turn `journey_items` from a "post" into a structured
-- "lesson". Adds 9 pedagogical block columns + a stage marker so
-- the 250-row CSV (תובנת מומחים / טעויות שכיחות / מטאפורה / שאלה /
-- מדידה / תוכן מלא / לעשות / לא לעשות / סימן להתקדמות + מקור) maps
-- 1:1 onto the schema and the user surface can render each block
-- as its own micro-section.
--
-- Why structured columns and not a single JSONB:
--   - Each block has independent admin editing.
--   - Per-block analytics (which mistakes resonate? which exercises
--     get done?) need first-class columns.
--   - Bilingual (HE today, EN later) is cleaner with paired columns.
--
-- All columns are NULLable so existing rows survive untouched.
-- Idempotent on re-run.

BEGIN;

-- 1. Stage marker (1..4 — יסודות / העמקה / אינטגרציה / הבשלה).
-- We don't enforce a CHECK on the value range so future curricula
-- can add stage 5+ without a migration.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS stage SMALLINT;

CREATE INDEX IF NOT EXISTS journey_items_stage_idx
  ON public.journey_items (stage)
  WHERE stage IS NOT NULL;

-- 2. Source attribution (HE/EN). Always shown to the user at the
-- foot of the lesson, with a "Mioshy interpretation of …" framing
-- when the source is a third-party researcher/book.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS source_attribution_he TEXT,
  ADD COLUMN IF NOT EXISTS source_attribution_en TEXT;

-- 3. Expert insight — the opening framing block. ~60-150 words.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS expert_insight_he TEXT,
  ADD COLUMN IF NOT EXISTS expert_insight_en TEXT;

-- 4. Common mistakes — what most couples get wrong.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS common_mistakes_he TEXT,
  ADD COLUMN IF NOT EXISTS common_mistakes_en TEXT;

-- 5. Metaphor — short visual anchor. One paragraph max.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS metaphor_he TEXT,
  ADD COLUMN IF NOT EXISTS metaphor_en TEXT;

-- 6. Exercise — the call to action. The pedagogical climax.
-- Note: NOT named `exercise_he` because the existing `task_he`
-- column already serves that role for legacy rows. New rows use
-- `task_he` AND populate it from the CSV's "שאלה / תרגיל" column.
-- (Kept under task_* for migration economy — no col rename.)

-- 7. Measurement / observation — what to watch for during the week.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS measurement_he TEXT,
  ADD COLUMN IF NOT EXISTS measurement_en TEXT;

-- 8. "Do this week" — explicit positive prompt.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS do_this_week_he TEXT,
  ADD COLUMN IF NOT EXISTS do_this_week_en TEXT;

-- 9. "Don't this week" — explicit anti-pattern.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS dont_this_week_he TEXT,
  ADD COLUMN IF NOT EXISTS dont_this_week_en TEXT;

-- 10. Progress marker — how the user knows it's working. Powers
-- the post-completion feedback bar's "did this land?" question.
ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS progress_marker_he TEXT,
  ADD COLUMN IF NOT EXISTS progress_marker_en TEXT;

-- Comments for the schema introspection tools.
COMMENT ON COLUMN public.journey_items.stage IS
  'Curriculum stage 1-4 (יסודות / העמקה / אינטגרציה / הבשלה). NULL for legacy rows.';
COMMENT ON COLUMN public.journey_items.source_attribution_he IS
  'Lesson block — Hebrew. Researcher/book name shown at foot of lesson with "מבוסס על / ניתוח של מיאושי" framing. NULL = original Mioshy content.';
COMMENT ON COLUMN public.journey_items.expert_insight_he IS
  'Lesson block — Hebrew. Opening insight, ~60-150 words. The "ההיגיון מאחורי הדבר" frame.';
COMMENT ON COLUMN public.journey_items.common_mistakes_he IS
  'Lesson block — Hebrew. What most couples get wrong here.';
COMMENT ON COLUMN public.journey_items.metaphor_he IS
  'Lesson block — Hebrew. Short visual anchor, one paragraph max.';
COMMENT ON COLUMN public.journey_items.measurement_he IS
  'Lesson block — Hebrew. What the couple should observe / measure during the week to know it''s working.';
COMMENT ON COLUMN public.journey_items.do_this_week_he IS
  'Lesson block — Hebrew. Explicit "do this" prompt. Renders as a green-toned action card.';
COMMENT ON COLUMN public.journey_items.dont_this_week_he IS
  'Lesson block — Hebrew. Explicit "don''t do this" prompt. Renders as a rose-toned warning card.';
COMMENT ON COLUMN public.journey_items.progress_marker_he IS
  'Lesson block — Hebrew. The single observable sign that progress is happening. Drives the post-completion feedback prompt.';

COMMIT;

NOTIFY pgrst, 'reload schema';
