-- 124_honesty_challenge_instructions_v2.sql
-- =============================================================================
-- A.8 (work-order 2026-06-15) — revise the "ככה זה עובד" modal copy for the free
-- game "כנות ואתגר" (slug 'honesty-or-challenge'). Migration 123 still said
-- "קבלו כרטיס" — but there is no card. The new wording frames it as a MANDATORY
-- task to perform based on what the wheel lands on. Supersedes 123 for this game
-- only (same per-game `instructions` JSONB mechanism; the shared generic CMS keys
-- gamesSlug.tutorial.* are untouched, so other games are unaffected).
-- Admin-editable from the dashboard GameForm. he + en.
-- =============================================================================

UPDATE public.games
SET instructions = jsonb_build_object(
  'he', jsonb_build_object(
    'steps', jsonb_build_array(
      'סובבו את הגלגל',
      'לפי מה שייצא — כנות או אתגר — תקבלו משימה',
      'עליכם לענות בכנות או לבצע את האתגר, ואז להמשיך לסיבוב הבא'
    )
  ),
  'en', jsonb_build_object(
    'steps', jsonb_build_array(
      'Spin the wheel',
      'Whatever comes up — honesty or challenge — you get a task',
      'Answer honestly or take on the challenge, then move to the next round'
    )
  )
)
WHERE slug = 'honesty-or-challenge'
   OR name_he = 'כנות ואתגר';
