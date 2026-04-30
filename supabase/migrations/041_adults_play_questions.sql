-- ──────────────────────────────────────────────────────────────────────────
-- 041_adults_play_questions.sql
--
-- Adds an OPTIONAL "play questions" payload to each experience_games row.
--
-- Use case: physical/hybrid games where, when something happens at the
-- table (e.g. a player draws a heart card), the rules say "answer one of
-- these questions". The post-purchase /adults/[slug]/play page renders
-- this list as a numbered reference - display-only, no interaction.
--
-- Optional per game: most games WON'T set these fields. The play page
-- conditionally renders the section only when the locale's questions
-- array has at least one item - empty arrays = section hidden.
--
-- Schema mirrors the existing benefits_*/target_audience_* string-array
-- pattern so the admin form (StringListColumn) and Zod (.array(string))
-- can be extended in one step instead of inventing a new shape.
--
-- ┌────────────────────────────────┬──────────┬───────────────────────────┐
-- │ Column                         │ Type     │ Use                       │
-- ├────────────────────────────────┼──────────┼───────────────────────────┤
-- │ play_questions_intro_he/en     │ text     │ Section heading / "rules" │
-- │ play_questions_he/en           │ text[]   │ The numbered question list│
-- └────────────────────────────────┴──────────┴───────────────────────────┘
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.experience_games
  ADD COLUMN IF NOT EXISTS play_questions_intro_he text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS play_questions_intro_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS play_questions_he       text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS play_questions_en       text[] NOT NULL DEFAULT ARRAY[]::text[];
