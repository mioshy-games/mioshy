-- ============================================================
-- 046_journey_feedback.sql
-- Clinical-feedback intelligence layer for the journey product.
--
-- WHY THIS TABLE EXISTS — read this before changing anything.
-- ────────────────────────────────────────────────────────────
-- The journey product has TWO distinct conceptual surfaces that
-- *look* similar but must never be conflated:
--
--   1. journey_item_responses  ← USER-AUTHORED reflections on a
--                                 prescribed item / task. The user
--                                 IS the author. Used by the user
--                                 themselves and visible to coach.
--
--   2. journey_feedback        ← ADMIN/COACH clinical interpretation
--                                 of a user's behaviour, answers, or
--                                 progress. The user is the SUBJECT,
--                                 not the author. The admin/coach
--                                 is the author. Never visible to
--                                 the user (PRD §4 — clinical layer).
--
-- Mixing these would let a user see a coach's clinical notes about
-- them — a privacy and legal disaster. They are kept apart at the
-- schema level so RLS policies cannot accidentally leak.
--
-- This table is the substrate for the "Feedback Intelligence Layer"
-- described in the upgrade brief §1. It is also what powers:
--   * /dashboard/journey/feedback (filtering & timeline)
--   * Per-question annotation overlay in the assessment view
--   * Couple-level "what we noticed" notes in the comparison view
--
-- Idempotent: every statement uses IF NOT EXISTS / DROP-then-CREATE
-- so re-running this migration is a no-op.
-- ============================================================


-- ============================================================
-- SECTION 1 — TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journey_feedback (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Subject of the feedback. EXACTLY ONE of (user_id, couple_id) is
  -- required; both can also be set when a piece of feedback is for a
  -- specific user inside a known couple (typical case for coaching).
  -- We allow user_id alone (e.g. an unattached lead) and couple_id
  -- alone (e.g. a couple-level pattern observation).
  user_id           uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_id         uuid        REFERENCES public.couples(id) ON DELETE CASCADE,

  -- Optional taxonomy anchors. NULL means "not bound to a category /
  -- item" — e.g. an open clinical observation. When bound, filters
  -- on /dashboard/journey/feedback can group by these.
  category_id       uuid        REFERENCES public.journey_categories(id) ON DELETE SET NULL,
  item_id           uuid        REFERENCES public.journey_items(id) ON DELETE SET NULL,

  -- Optional question anchor — for per-question annotations on the
  -- assessment view. References lib/journey/questions.ts q.id (string
  -- like "q01_*") so kept as text rather than FK.
  question_id       text,

  -- The two-field structure mandated by the PRD (§1).
  -- short_summary  : ≤ 2 lines, used in list view & timeline
  -- extended_text  : full clinical reasoning, expand-on-click
  short_summary     text        NOT NULL,
  extended_text     text,

  -- Severity / categorisation tag. Loose enum — admin defines its own
  -- taxonomy via the items table for full content categorisation; this
  -- column is for the clinical note's own urgency/tone.
  severity          text        NOT NULL DEFAULT 'observation',

  -- Authorship. Always populated; we never accept anonymous feedback.
  -- ON DELETE SET NULL because deleting an admin user shouldn't erase
  -- the clinical history of the couple — only orphan it.
  admin_author_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Bookkeeping
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Severity must be one of the canonical values. Add new values via
-- a future migration that drops & re-adds the constraint.
ALTER TABLE public.journey_feedback
  DROP CONSTRAINT IF EXISTS journey_feedback_severity_check;
ALTER TABLE public.journey_feedback
  ADD CONSTRAINT journey_feedback_severity_check
  CHECK (severity IN ('observation', 'insight', 'concern', 'urgent'));

-- A note must be addressed to *someone* — at least one of the two
-- subject FKs must be non-null. Belt-and-suspenders against bad
-- inserts that bypass the server-action layer.
ALTER TABLE public.journey_feedback
  DROP CONSTRAINT IF EXISTS journey_feedback_subject_required;
ALTER TABLE public.journey_feedback
  ADD CONSTRAINT journey_feedback_subject_required
  CHECK (user_id IS NOT NULL OR couple_id IS NOT NULL);

-- short_summary must not be blank — protects list views from empty
-- rows that look like rendering bugs.
ALTER TABLE public.journey_feedback
  DROP CONSTRAINT IF EXISTS journey_feedback_short_not_blank;
ALTER TABLE public.journey_feedback
  ADD CONSTRAINT journey_feedback_short_not_blank
  CHECK (length(btrim(short_summary)) > 0);


-- ============================================================
-- SECTION 2 — INDEXES
-- ============================================================
-- Filter-by-couple in timeline view: most common access pattern.
CREATE INDEX IF NOT EXISTS journey_feedback_couple_created_idx
  ON public.journey_feedback (couple_id, created_at DESC)
  WHERE couple_id IS NOT NULL;

-- Filter-by-user (e.g. opening one user's clinical history)
CREATE INDEX IF NOT EXISTS journey_feedback_user_created_idx
  ON public.journey_feedback (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- Group/filter by category — admin "all observations on Communication"
CREATE INDEX IF NOT EXISTS journey_feedback_category_idx
  ON public.journey_feedback (category_id)
  WHERE category_id IS NOT NULL;

-- Filter by item — admin "all notes on item X"
CREATE INDEX IF NOT EXISTS journey_feedback_item_idx
  ON public.journey_feedback (item_id)
  WHERE item_id IS NOT NULL;

-- Per-question annotations — assessment overlay loads by question_id
CREATE INDEX IF NOT EXISTS journey_feedback_user_question_idx
  ON public.journey_feedback (user_id, question_id)
  WHERE question_id IS NOT NULL;

-- Recent-first list across the entire admin panel
CREATE INDEX IF NOT EXISTS journey_feedback_created_idx
  ON public.journey_feedback (created_at DESC);

-- Authorship audit — "all feedback this admin wrote in last 30 days"
CREATE INDEX IF NOT EXISTS journey_feedback_author_created_idx
  ON public.journey_feedback (admin_author_id, created_at DESC)
  WHERE admin_author_id IS NOT NULL;


-- ============================================================
-- SECTION 3 — TRIGGERS
-- ============================================================
-- Maintain updated_at on every UPDATE so the timeline can show
-- "edited 2h ago" without the API needing to remember to bump it.
CREATE OR REPLACE FUNCTION public.tg_journey_feedback_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey_feedback_set_updated_at ON public.journey_feedback;
CREATE TRIGGER journey_feedback_set_updated_at
  BEFORE UPDATE ON public.journey_feedback
  FOR EACH ROW EXECUTE FUNCTION public.tg_journey_feedback_set_updated_at();


-- ============================================================
-- SECTION 4 — RLS
-- ============================================================
-- Clinical feedback is ADMIN-ONLY. Users must NEVER see notes about
-- themselves — these are clinical interpretations, not user-facing
-- content. We follow the same is_admin() pattern used by the rest of
-- the journey schema (see 026, 030, 035).
ALTER TABLE public.journey_feedback ENABLE ROW LEVEL SECURITY;

-- SELECT: admin only.
DROP POLICY IF EXISTS "journey_feedback_select_admin" ON public.journey_feedback;
CREATE POLICY "journey_feedback_select_admin"
  ON public.journey_feedback
  FOR SELECT
  USING (public.is_admin());

-- INSERT: admin only. Author must be the calling admin (we don't let
-- one admin attribute notes to another, and the server-action layer
-- enforces this anyway via auth.uid()).
DROP POLICY IF EXISTS "journey_feedback_insert_admin" ON public.journey_feedback;
CREATE POLICY "journey_feedback_insert_admin"
  ON public.journey_feedback
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    AND admin_author_id = auth.uid()
  );

-- UPDATE: admin only. We keep it open across admins (any admin can
-- correct another's note) — the audit trail is in updated_at +
-- admin_author_id (which we do NOT change on edit; that records
-- the original author).
DROP POLICY IF EXISTS "journey_feedback_update_admin" ON public.journey_feedback;
CREATE POLICY "journey_feedback_update_admin"
  ON public.journey_feedback
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: admin only. Deletes are physical; we don't soft-delete
-- because the on-delete cascades from auth.users / couples already
-- clean up orphans.
DROP POLICY IF EXISTS "journey_feedback_delete_admin" ON public.journey_feedback;
CREATE POLICY "journey_feedback_delete_admin"
  ON public.journey_feedback
  FOR DELETE
  USING (public.is_admin());


-- ============================================================
-- SECTION 5 — COMMENT documentation (visible in Supabase UI)
-- ============================================================
COMMENT ON TABLE public.journey_feedback IS
  'Admin/coach clinical interpretation layer. NOT user-authored. Strictly separated from journey_item_responses (which IS user-authored). RLS: admin-only. Source of truth for /dashboard/journey/feedback.';

COMMENT ON COLUMN public.journey_feedback.short_summary IS
  '≤2-line note shown in list views & timelines. Required.';

COMMENT ON COLUMN public.journey_feedback.extended_text IS
  'Full clinical reasoning, shown on expand. Optional.';

COMMENT ON COLUMN public.journey_feedback.severity IS
  'observation | insight | concern | urgent. Drives list-view tone & filters.';

COMMENT ON COLUMN public.journey_feedback.question_id IS
  'Optional anchor to a specific question in lib/journey/questions.ts (text id like q07_*). NULL = not tied to a single question.';
