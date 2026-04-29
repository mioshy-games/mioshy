-- ============================================================
-- 025_subscription_frozen_status.sql
-- Allow "frozen" as a valid subscription status so users can pause
-- without cancelling their plan. Resumable from the account page.
-- ============================================================

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active','cancelled','expired','past_due','blocked','frozen'));

COMMENT ON COLUMN subscriptions.status IS
  'active | cancelled | expired | past_due | blocked | frozen';

-- Reload PostgREST schema so the API sees the new constraint immediately
NOTIFY pgrst, 'reload schema';
