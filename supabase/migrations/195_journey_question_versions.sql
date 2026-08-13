-- ───────────────────────────────────────────────────────────────────────────
-- 195_journey_question_versions.sql
--
-- Effective-dated history for journey_questions.
--
-- WHY THIS EXISTS
-- ---------------
-- journey_questions holds ONE row per question, and the admin editor was built
-- with a "SCORING LOCK": he_text/en_text freely editable, `axes` frozen. That
-- guarantees drift in exactly one direction — the question can be rewritten
-- while the axis it scores onto silently keeps pointing at the old meaning.
-- It happened. Seven questions were rewritten in three clusters (2026-07-01,
-- 07-12, 07-20) and their axes did not follow, so e.g. q11_contempt asked in
-- Hebrew how often you EXPRESS APPRECIATION while scoring onto
-- four_horsemen_contempt: the warmer someone reported being, the worse their
-- result. Full findings in the audit that preceded this migration.
--
-- The fix is not to rewrite the Hebrew — people answered what was on screen and
-- that text is authoritative. The fix is to score each answer against the axis
-- that was correct WHEN THE ANSWER WAS GIVEN. That needs history, which this
-- table is.
--
-- SHAPE
-- -----
-- One row per (slug, version) with a half-open validity range
-- [valid_from, valid_to). Scoring resolves a response by its created_at:
--   … WHERE slug = $1 AND valid_from <= $2 AND (valid_to IS NULL OR $2 < valid_to)
-- valid_to IS NULL means "still current". valid_from '-infinity' means "since
-- before we had records" — necessary because journey_responses start
-- 2026-04-19 while journey_questions rows were only created 2026-06-14, so v1
-- must extend backwards to cover answers given before the table existed.
--
-- journey_questions stays the row the QUESTIONNAIRE RENDERS FROM. Nothing about
-- the live assessment changes. This table is read by scoring only.
--
-- Safe to re-run. Creates nothing outside this table.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.journey_question_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        NOT NULL,
  version      integer     NOT NULL,

  -- Half-open range: [valid_from, valid_to). NULL valid_to = current.
  valid_from   timestamptz NOT NULL,
  valid_to     timestamptz,

  -- What was on screen for this window. Kept for audit and for the human
  -- verification step ("read the Hebrew this person saw, hand-score it").
  he_text      text        NOT NULL,
  en_text      text,

  -- How an answer given in this window must be scored. THIS is the field the
  -- correction migration touches — never the text.
  axes         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  reverse      boolean     NOT NULL DEFAULT false,
  options      jsonb,
  type         text        NOT NULL,

  -- Provenance. `note` records WHY a version exists; created_by is the admin
  -- who saved the edit (null for the two backfilled historical versions, which
  -- predate updated_by ever being written — see migration 197).
  created_by   uuid,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT journey_question_versions_slug_version_uniq UNIQUE (slug, version),
  CONSTRAINT journey_question_versions_range_ck CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- The scoring lookup: slug + a point in time. This index is on the hot path of
-- every analyze() call, which resolves once per response.
CREATE INDEX IF NOT EXISTS journey_question_versions_lookup_idx
  ON public.journey_question_versions (slug, valid_from DESC);

-- At most one OPEN version per slug. Without this, two rows with valid_to NULL
-- would make "which axis is current" ambiguous and the resolver would pick
-- arbitrarily — the precise class of silent wrongness this table exists to end.
CREATE UNIQUE INDEX IF NOT EXISTS journey_question_versions_one_open_idx
  ON public.journey_question_versions (slug)
  WHERE valid_to IS NULL;

ALTER TABLE public.journey_question_versions ENABLE ROW LEVEL SECURITY;

-- Service-role only, matching journey_questions. Scoring runs server-side with
-- the admin client; nothing client-side reads this.
DROP POLICY IF EXISTS journey_question_versions_service_all
  ON public.journey_question_versions;
CREATE POLICY journey_question_versions_service_all
  ON public.journey_question_versions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.journey_question_versions IS
  'Effective-dated history of journey_questions. Scoring resolves the axis by the answer''s created_at so an answer is never scored against text the respondent never saw.';

COMMIT;

-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS public.journey_question_versions;
-- (Drops the indexes and policy with it. journey_questions is untouched by this
--  migration, so nothing else needs reverting.)
