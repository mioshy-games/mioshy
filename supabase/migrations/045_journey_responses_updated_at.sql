-- ===========================================================================
-- 045_journey_responses_updated_at.sql
-- ===========================================================================
-- Adds an updated_at column to journey_responses + a BEFORE UPDATE trigger
-- that bumps it on every change.
--
-- Why we need this:
--   The answer-save path on /api/journey/answer does an upsert keyed on
--   (journey_id, question_id). Supabase's upsert excludes columns we
--   didn't pass from the conflict-update SET clause, so created_at stays
--   pinned to the FIRST submission — re-ranking (or any re-answer) was
--   silently invisible. The expert dashboard wants to surface "ranked
--   3 days ago", which needs the latest write timestamp.
--
-- Scope is intentionally narrow:
--   - One new column with a sensible default.
--   - One trigger that auto-maintains it (the answer route doesn't need
--     to change — the DB does it transparently on every UPDATE).
--   - Backfill: existing rows get updated_at = created_at so consumers
--     can treat the field as always-present without null-handling.
--
-- Idempotent: every statement uses IF NOT EXISTS / DROP-then-CREATE so
-- re-running this migration is a no-op.
-- ===========================================================================

-- 1. Column ------------------------------------------------------------------
ALTER TABLE public.journey_responses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();


-- 2. Trigger function --------------------------------------------------------
-- Generic function — keeps NEW.updated_at = now() on every UPDATE. We don't
-- name this `set_updated_at` because there's a chance other tables already
-- have a function by that name; suffixing with the table makes it harmless
-- to coexist.
CREATE OR REPLACE FUNCTION public.journey_responses_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- 3. Trigger ------------------------------------------------------------------
DROP TRIGGER IF EXISTS journey_responses_set_updated_at ON public.journey_responses;

CREATE TRIGGER journey_responses_set_updated_at
  BEFORE UPDATE ON public.journey_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.journey_responses_set_updated_at();


-- 4. Backfill -----------------------------------------------------------------
-- Existing rows have updated_at = now() from the column default (the value
-- at migration apply-time). That's strictly wrong — a row created in 2024
-- shouldn't suddenly look like it was updated today. Reset the field to
-- match created_at so downstream "ranked X ago" math is correct.
--
-- Bypass the trigger for this one-time bulk update so we don't fight it.
ALTER TABLE public.journey_responses DISABLE TRIGGER journey_responses_set_updated_at;

UPDATE public.journey_responses
SET updated_at = created_at
WHERE updated_at <> created_at;

ALTER TABLE public.journey_responses ENABLE TRIGGER journey_responses_set_updated_at;


-- 5. Documentation ------------------------------------------------------------
COMMENT ON COLUMN public.journey_responses.updated_at IS
  'Latest write timestamp. Maintained by trigger journey_responses_set_updated_at — never write to this column from app code; let the trigger handle it.';
