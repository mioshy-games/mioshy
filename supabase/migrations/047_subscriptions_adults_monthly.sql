-- ============================================================
-- 047_subscriptions_adults_monthly.sql
-- Track the "Adults game-of-the-month" entitlement for Journey
-- subscribers.
--
-- WHY THIS COLUMN EXISTS - read this before changing anything.
-- ────────────────────────────────────────────────────────────
-- Per the post-purchase spec (docs/post-purchase-experience-spec.md
-- §8.4), an active Journey subscription bundles ONE Adults-pillar
-- game per calendar month, free of additional charge. Until that
-- monthly slot is consumed, the user can pick any single Adults game
-- from the catalogue and unlock it without paying.
--
-- We model the slot as a single timestamp on the subscription row
-- rather than a separate ledger table - it's a per-subscription, at-
-- most-once-per-period flag, not a transactional history. Querying it
-- looks like:
--
--   SELECT
--     CASE
--       WHEN adults_monthly_used_at IS NULL
--         OR adults_monthly_used_at < date_trunc('month', now())
--       THEN true
--     END AS adults_monthly_available
--   FROM subscriptions
--   WHERE user_id = $1 AND product = 'journey' AND status = 'active';
--
-- When the user redeems the slot, we stamp the column with `now()`.
-- A future cron/UI never has to reset it - the comparison
-- `adults_monthly_used_at < date_trunc('month', now())` resolves to
-- "true, available again" automatically on the 1st of every month.
--
-- Idempotent: every statement uses IF NOT EXISTS / DROP-then-CREATE
-- so re-running this migration is a no-op.
-- ============================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS adults_monthly_used_at timestamptz;

COMMENT ON COLUMN public.subscriptions.adults_monthly_used_at IS
  'When the subscriber last redeemed the bundled Adults game-of-the-month. NULL or before the start of the current month means a slot is available now.';

-- Partial index for the read pattern: "find me all subscriptions whose
-- monthly slot is ALREADY consumed for the current month". Used by the
-- /my/adults page entitlement check; the partial WHERE keeps it tiny
-- (most rows have NULL for most of the month).
CREATE INDEX IF NOT EXISTS subscriptions_adults_monthly_used_idx
  ON public.subscriptions (adults_monthly_used_at DESC)
  WHERE adults_monthly_used_at IS NOT NULL;
