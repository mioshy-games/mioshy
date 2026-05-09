-- 076_couple_anniversary_backfill.sql
--
-- FU6.S4 — fix the anniversary anchor for couples that purchased
-- Journey AFTER the couple was created.
--
-- Migration 072 set every couple's `started_journey_at` to its
-- `couples.created_at`. That's wrong for couples whose Journey
-- subscription started later: their 30/90/365-day anniversary
-- milestones (Layer 5) end up firing prematurely.
--
-- Correction strategy:
--   For each couple that has a journey_assignments row of
--   `origin = 'purchase'`, pull that assignment's `anchor_date`
--   (which is set to the purchase date by assignJourneyOnPurchase).
--   If `anchor_date > started_journey_at`, push `started_journey_at`
--   forward to match. If multiple purchase rows exist, take the
--   EARLIEST anchor_date — that's the moment they actually became
--   a Journey customer.
--
-- Idempotent: the WHERE clause restricts to rows where the current
-- value is strictly less than the anchor_date, so re-runs are no-ops.
-- Couples without a purchase-origin assignment are left untouched
-- (they keep created_at as the anchor).

BEGIN;

WITH first_purchase AS (
  SELECT
    couple_id,
    MIN(anchor_date) AS first_purchase_at
  FROM public.journey_assignments
  WHERE origin = 'purchase'
    AND couple_id IS NOT NULL
    AND anchor_date IS NOT NULL
  GROUP BY couple_id
)
UPDATE public.couples c
SET started_journey_at = fp.first_purchase_at
FROM first_purchase fp
WHERE c.id = fp.couple_id
  AND c.started_journey_at IS NOT NULL
  AND fp.first_purchase_at > c.started_journey_at;

-- Post-condition check (cheap, advisory):
-- count of rows we expect to have corrected. Cron and dashboards
-- can read from this comment when investigating future drift.
COMMENT ON COLUMN public.couples.started_journey_at IS
  'Layer 5 anchor for couple-anniversary milestones (30/90/365 days). '
  'Defaults to couples.created_at; corrected by migration 076 for couples '
  'that purchased Journey after the couple was created (anchor pushed '
  'forward to MIN(journey_assignments.anchor_date WHERE origin=purchase)).';

COMMIT;

NOTIFY pgrst, 'reload schema';
