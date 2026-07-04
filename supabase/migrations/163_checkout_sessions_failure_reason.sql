-- ============================================================
-- 163_checkout_sessions_failure_reason.sql  (Task 33 — Itzik 2026-07-03)
--
-- A machine-readable reason on a failed checkout session, so the post-payment
-- error screen can tell the "you already used your one-time trial" case apart
-- from a real card decline (today it wrongly shows "the card may have been
-- declined" + a retry that loops back into the same block). The trial processor
-- stamps this when it marks a session failed; the client reads it via RLS (same
-- as it already reads status). Values: 'trial_already_used' | 'validation_failed'.
-- ============================================================

BEGIN;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS failure_reason text;

COMMENT ON COLUMN public.checkout_sessions.failure_reason IS
  'Why a checkout failed, for the error UI. trial_already_used = one-time trial '
  'already redeemed (offer regular subscription); validation_failed = J2/card '
  'validation failed. NULL for non-failed or generic failures.';

COMMIT;
