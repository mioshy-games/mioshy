-- ============================================================
-- 162b_journey_items_dash_scan.sql  (Task 28 — one-time em-dash scan)
--
-- Brand voice forbids the long dash "—". The display layer now normalises it
-- for chapters (app/[locale]/(shell)/journey/timeline/[scheduledId]/page.tsx,
-- via lib/text/sanitize-dashes stripEmDashDeep), but this cleans the STORED
-- journey_items content once so exports / the admin editor / any un-wrapped
-- surface are correct at the source too.
--
-- Mirrors stripEmDash exactly: em-dash (U+2014) + horizontal bar (U+2015) with
-- any surrounding whitespace -> ' - '. Leaves en-dash (U+2013) alone so numeric
-- ranges survive. Idempotent (re-running is a no-op). Run manually in the
-- Supabase SQL editor. Does NOT touch AI "phrasing" — that stays authoring work.
-- ============================================================

BEGIN;

UPDATE public.journey_items SET
  title_he = regexp_replace(title_he, '\s*[—―]\s*', ' - ', 'g'),
  title_en = regexp_replace(title_en, '\s*[—―]\s*', ' - ', 'g'),
  body_he = regexp_replace(body_he, '\s*[—―]\s*', ' - ', 'g'),
  body_en = regexp_replace(body_en, '\s*[—―]\s*', ' - ', 'g'),
  task_he = regexp_replace(task_he, '\s*[—―]\s*', ' - ', 'g'),
  task_en = regexp_replace(task_en, '\s*[—―]\s*', ' - ', 'g'),
  source_attribution_he = regexp_replace(source_attribution_he, '\s*[—―]\s*', ' - ', 'g'),
  source_attribution_en = regexp_replace(source_attribution_en, '\s*[—―]\s*', ' - ', 'g'),
  expert_insight_he = regexp_replace(expert_insight_he, '\s*[—―]\s*', ' - ', 'g'),
  expert_insight_en = regexp_replace(expert_insight_en, '\s*[—―]\s*', ' - ', 'g'),
  common_mistakes_he = regexp_replace(common_mistakes_he, '\s*[—―]\s*', ' - ', 'g'),
  common_mistakes_en = regexp_replace(common_mistakes_en, '\s*[—―]\s*', ' - ', 'g'),
  metaphor_he = regexp_replace(metaphor_he, '\s*[—―]\s*', ' - ', 'g'),
  metaphor_en = regexp_replace(metaphor_en, '\s*[—―]\s*', ' - ', 'g'),
  measurement_he = regexp_replace(measurement_he, '\s*[—―]\s*', ' - ', 'g'),
  measurement_en = regexp_replace(measurement_en, '\s*[—―]\s*', ' - ', 'g'),
  do_this_week_he = regexp_replace(do_this_week_he, '\s*[—―]\s*', ' - ', 'g'),
  do_this_week_en = regexp_replace(do_this_week_en, '\s*[—―]\s*', ' - ', 'g'),
  dont_this_week_he = regexp_replace(dont_this_week_he, '\s*[—―]\s*', ' - ', 'g'),
  dont_this_week_en = regexp_replace(dont_this_week_en, '\s*[—―]\s*', ' - ', 'g'),
  progress_marker_he = regexp_replace(progress_marker_he, '\s*[—―]\s*', ' - ', 'g'),
  progress_marker_en = regexp_replace(progress_marker_en, '\s*[—―]\s*', ' - ', 'g')
WHERE title_he ~ '[—―]'
     OR title_en ~ '[—―]'
     OR body_he ~ '[—―]'
     OR body_en ~ '[—―]'
     OR task_he ~ '[—―]'
     OR task_en ~ '[—―]'
     OR source_attribution_he ~ '[—―]'
     OR source_attribution_en ~ '[—―]'
     OR expert_insight_he ~ '[—―]'
     OR expert_insight_en ~ '[—―]'
     OR common_mistakes_he ~ '[—―]'
     OR common_mistakes_en ~ '[—―]'
     OR metaphor_he ~ '[—―]'
     OR metaphor_en ~ '[—―]'
     OR measurement_he ~ '[—―]'
     OR measurement_en ~ '[—―]'
     OR do_this_week_he ~ '[—―]'
     OR do_this_week_en ~ '[—―]'
     OR dont_this_week_he ~ '[—―]'
     OR dont_this_week_en ~ '[—―]'
     OR progress_marker_he ~ '[—―]'
     OR progress_marker_en ~ '[—―]';

COMMIT;
