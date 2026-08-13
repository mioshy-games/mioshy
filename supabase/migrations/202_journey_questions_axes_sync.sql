-- ───────────────────────────────────────────────────────────────────────────
-- 202_journey_questions_axes_sync.sql
--
-- Make journey_questions.axes agree with the CURRENTLY LIVE scoring config.
--
-- WHY THIS IS NOT COSMETIC
-- ------------------------
-- Migration 197 corrected the axes of the seven rewritten questions inside
-- journey_question_versions, deliberately leaving journey_questions untouched
-- so that the live questionnaire render was not disturbed mid-flight. Scoring
-- has been correct ever since, because the resolver reads the version rows.
--
-- But journey_questions.axes was left holding the OLD, WRONG values, and two
-- things still read it:
--
--   1. THE FALLBACK. buildVersionedQuestionResolver overlays the version's axes
--      onto the question row. If loadJourneyQuestionVersions returns nothing —
--      a failed read, an empty table — every answer silently falls back to
--      journey_questions.axes and is scored the ORIGINAL BROKEN WAY. The read
--      failure logs loudly; the mis-scoring that follows does not. A loud log
--      beside a silent wrong answer is not a safeguard.
--
--   2. THE ADMIN EDITOR. /dashboard/journey-questions renders `axes` read-only
--      beside the Hebrew. Today it shows q11_contempt scoring onto
--      four_horsemen_contempt while the live engine scores it onto fondness.
--      The next person to edit a question does so against bad information —
--      and under the new confirm-on-edit gate they would be asked to CONFIRM
--      an axis that is not the one in use.
--
-- Both are the failure mode this whole exercise removed. Closing it.
--
-- WHAT THIS CHANGES
-- -----------------
-- journey_questions.axes and .options are set to the OPEN version row
-- (valid_to IS NULL) — which is by definition what a person answering today is
-- scored on. Nothing else moves: no Hebrew, no phase, no version row, no
-- response. Scoring output is UNCHANGED for every existing answer, because the
-- resolver was already using these values; this only makes the fallback and the
-- UI tell the same story.
--
-- Idempotent: re-running is a no-op once the two agree.
-- ───────────────────────────────────────────────────────────────────────────

BEGIN;

-- Exact rollback material. Captures only what this migration overwrites.
CREATE TABLE IF NOT EXISTS public.journey_questions_axes_backup_202 AS
SELECT slug, axes, options, updated_at FROM public.journey_questions;

UPDATE public.journey_questions q
SET axes       = v.axes,
    options    = COALESCE(v.options, q.options),
    -- updated_at is intentionally NOT bumped. It is the evidence trail for when
    -- a question's TEXT changed — migrations 196/203 and the version backfill
    -- all key off it. Moving it here to record a scoring-config sync would
    -- corrupt the very timestamps the date-resolved scoring depends on.
    updated_at = q.updated_at
FROM public.journey_question_versions v
WHERE v.slug = q.slug
  AND v.valid_to IS NULL
  AND (q.axes IS DISTINCT FROM v.axes
       OR q.options IS DISTINCT FROM COALESCE(v.options, q.options));

COMMIT;

-- ── VERIFY ─────────────────────────────────────────────────────────────────
-- Zero rows means the question row and its open version now agree everywhere:
--   SELECT q.slug, q.axes::text AS question_axes, v.axes::text AS open_version_axes
--   FROM journey_questions q
--   JOIN journey_question_versions v ON v.slug = q.slug AND v.valid_to IS NULL
--   WHERE q.axes IS DISTINCT FROM v.axes;
--
-- And confirm the seven corrected questions now read correctly:
--   SELECT slug, axes::text FROM journey_questions
--   WHERE slug IN ('q11_contempt','q17_context_logistics','q01_knowledge_world',
--                  'q19_rituals','q02_admiration_see_good','q24_physical_closeness');

-- ── ROLLBACK ───────────────────────────────────────────────────────────────
-- UPDATE public.journey_questions q
--   SET axes = b.axes, options = b.options, updated_at = b.updated_at
--   FROM public.journey_questions_axes_backup_202 b WHERE q.slug = b.slug;
-- DROP TABLE public.journey_questions_axes_backup_202;
