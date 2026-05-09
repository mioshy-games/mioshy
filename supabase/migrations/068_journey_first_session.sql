-- 068_journey_first_session.sql
--
-- Layer-1 first-session timestamp: a brand-new paying user who lands
-- on /my/journey for the first time should see ONE screen with ONE
-- goal — open the day-1 item. Today's /my/journey shows 6 stacked
-- widgets; for fresh users that's overwhelming.
--
-- This column is set the moment the user *opens* (not just lands on)
-- the day-1 item. Subsequent /my/journey visits then render the full
-- dashboard.
--
-- Idempotent on re-run.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS journey_first_session_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.journey_first_session_completed_at IS
  'Layer 1 (#5): set when the user first opens their day-1 journey item. '
  'NULL means /my/journey should render the simplified single-purpose first-session screen.';

COMMIT;

NOTIFY pgrst, 'reload schema';
