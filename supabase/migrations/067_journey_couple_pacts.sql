-- 067_journey_couple_pacts.sql
--
-- Layer-1 commitment artefact: before the assessment starts, the
-- user (or couple) agrees to a small pact — "10 minutes a week for
-- 4 weeks." That commitment is the single highest-leverage lever on
-- assessment completion + week-1 retention (pre-commitment from the
-- behavioural-design literature).
--
-- The row is anchored to either user_id (solo entrant) OR couple_id
-- (paired). When a user later pairs, a separate UPDATE in the pair
-- handler can shift their solo pact to the couple.
--
-- One pact per owner. Subsequent attempts UPSERT (extending weeks
-- isn't supported in Layer 1; that's V2 territory).
--
-- Fully idempotent — safe to re-run if a previous attempt partially
-- created the table.
--
-- See docs/journey-execution-architecture-2026-05-08.md MVP-03.

BEGIN;

CREATE TABLE IF NOT EXISTS public.journey_couple_pacts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Exactly one of these two is set at insert time.
  couple_id                   UUID REFERENCES public.couples(id)   ON DELETE CASCADE,
  user_id                     UUID REFERENCES auth.users(id)       ON DELETE CASCADE,
  committed_minutes_per_week  SMALLINT NOT NULL DEFAULT 10,
  committed_weeks             SMALLINT NOT NULL DEFAULT 4,
  agreed_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The actor who tapped "I'm in" (could be either partner in a couple).
  agreed_by_user_id           UUID NOT NULL REFERENCES auth.users(id),
  -- Updated by a nightly cron + on every completion. Layer 1 reads
  -- this read-only; the cron lands in Layer 2.
  honoured_through_week       SMALLINT,
  CONSTRAINT pact_owner_present CHECK (couple_id IS NOT NULL OR user_id IS NOT NULL),
  -- Reasonable caps so a typo'd UI can't store nonsense.
  CONSTRAINT pact_minutes_sane  CHECK (committed_minutes_per_week BETWEEN 1 AND 240),
  CONSTRAINT pact_weeks_sane    CHECK (committed_weeks BETWEEN 1 AND 52)
);

-- One active pact per user (solo) or couple. Partial unique indexes
-- so we don't collide on the column the row didn't use.
CREATE UNIQUE INDEX IF NOT EXISTS journey_couple_pacts_user_uniq
  ON public.journey_couple_pacts (user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS journey_couple_pacts_couple_uniq
  ON public.journey_couple_pacts (couple_id)
  WHERE couple_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS journey_couple_pacts_agreed_at_idx
  ON public.journey_couple_pacts (agreed_at DESC);

COMMENT ON TABLE public.journey_couple_pacts IS
  'Pre-assessment commitment row. One per owner (user or couple). '
  'Drives the "weeks remaining in pact" surface in /my/journey + '
  'coach view (Layer 2). honoured_through_week populated by a cron '
  'that reads completions; null until first cron run.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.journey_couple_pacts ENABLE ROW LEVEL SECURITY;

-- DROP + CREATE pattern so re-running this migration is safe even if
-- a previous partial run left some policies behind.

-- Users see their own pact (solo or via couple membership).
DROP POLICY IF EXISTS journey_couple_pacts_user_read ON public.journey_couple_pacts;
CREATE POLICY journey_couple_pacts_user_read
  ON public.journey_couple_pacts FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = journey_couple_pacts.couple_id
          AND cm.user_id   = auth.uid()
      )
    )
  );

-- Users insert their own pact (the action writes solo first; pair
-- handler upgrades to couple later).
DROP POLICY IF EXISTS journey_couple_pacts_user_insert ON public.journey_couple_pacts;
CREATE POLICY journey_couple_pacts_user_insert
  ON public.journey_couple_pacts FOR INSERT
  WITH CHECK (
    agreed_by_user_id = auth.uid()
    AND (
      user_id = auth.uid()
      OR (
        couple_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.couple_members cm
          WHERE cm.couple_id = journey_couple_pacts.couple_id
            AND cm.user_id   = auth.uid()
        )
      )
    )
  );

-- Users update their own pact (currently used only by the pair
-- handler shifting solo → couple ownership).
DROP POLICY IF EXISTS journey_couple_pacts_user_update ON public.journey_couple_pacts;
CREATE POLICY journey_couple_pacts_user_update
  ON public.journey_couple_pacts FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      couple_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.couple_members cm
        WHERE cm.couple_id = journey_couple_pacts.couple_id
          AND cm.user_id   = auth.uid()
      )
    )
  );

-- Experts see pacts of their assigned couples.
DROP POLICY IF EXISTS journey_couple_pacts_expert_read ON public.journey_couple_pacts;
CREATE POLICY journey_couple_pacts_expert_read
  ON public.journey_couple_pacts FOR SELECT
  USING (
    couple_id IS NOT NULL
    AND public.is_expert_for_couple(couple_id)
  );

-- Admins see everything.
DROP POLICY IF EXISTS journey_couple_pacts_admin_all ON public.journey_couple_pacts;
CREATE POLICY journey_couple_pacts_admin_all
  ON public.journey_couple_pacts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;

NOTIFY pgrst, 'reload schema';
