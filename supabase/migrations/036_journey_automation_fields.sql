-- ============================================================
-- 036_journey_automation_fields.sql
-- Automation plumbing for the Journey Content System.
--
-- Phase 6 of the three-pillar restructure adds two capabilities that the
-- base schema (035) didn't need yet:
--
--   1. Post-purchase auto-assignment - when a Cardcom webhook activates a
--      subscription for a product pillar, we need to pick which program
--      to assign. Rather than hardcoding program UUIDs in application
--      code, we tag programs with a `product_slug` so admins can switch
--      the "default journey program" without a deploy. Exactly ONE active
--      program per product may be the automation target (partial unique
--      index, active-only).
--
--   2. Unlock notifications - a lightweight "has this row already been
--      announced to the owner" flag on scheduled items. We do not create
--      a dedicated notifications table; we just mark the scheduled row
--      as notified so the next notifier pass skips it. This keeps the
--      hot path cheap and lets us swap delivery mechanisms (Brevo email
--      now, web push later) without schema changes.
--
-- Pre-launch migration - no historical data to backfill.
-- ============================================================


-- ============================================================
-- SECTION 1 - product_slug on journey_programs
-- ============================================================

ALTER TABLE public.journey_programs
  ADD COLUMN IF NOT EXISTS product_slug text;

-- product_slug, when set, must match the same pillar set used by
-- subscriptions.product (migration 032) so the mapping stays consistent.
ALTER TABLE public.journey_programs
  DROP CONSTRAINT IF EXISTS journey_programs_product_slug_check;
ALTER TABLE public.journey_programs
  ADD CONSTRAINT journey_programs_product_slug_check
  CHECK (product_slug IS NULL OR product_slug IN ('games','journey','adults'));

-- Only ONE active program per product may be the auto-assign target.
-- NULL product_slug means "not automation-eligible" - any number of those
-- can exist. The partial predicate excludes inactive programs so admins
-- can stage a replacement by flipping is_active without hitting a unique
-- violation.
CREATE UNIQUE INDEX IF NOT EXISTS journey_programs_product_active_key
  ON public.journey_programs (product_slug)
  WHERE product_slug IS NOT NULL AND is_active;

-- Lookup index used by the purchase hook: "give me the active program
-- for this pillar".
CREATE INDEX IF NOT EXISTS journey_programs_product_lookup_idx
  ON public.journey_programs (product_slug)
  WHERE product_slug IS NOT NULL;


-- ============================================================
-- SECTION 2 - notified_at on journey_scheduled_items
-- ============================================================

ALTER TABLE public.journey_scheduled_items
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- "Rows that should fire a notification now" = items that are unlocked
-- (unlock_at <= now) AND have not been announced yet. A partial index
-- keeps the notifier's per-pass work proportional to the backlog size,
-- not the timeline table size.
CREATE INDEX IF NOT EXISTS journey_scheduled_items_notify_pending_idx
  ON public.journey_scheduled_items (unlock_at)
  WHERE notified_at IS NULL;


-- ============================================================
-- SECTION 3 - product on checkout_sessions
-- The Cardcom indicator needs to know which product pillar was purchased
-- so it can (a) upsert the correct per-product subscription row (see
-- migration 032) and (b) fire the appropriate auto-assign hook.
-- Prior to this migration the webhook treated everything as 'journey',
-- which is why migration 032 defaulted existing subscriptions to that
-- value. We adopt the same default here for any pre-existing rows.
-- ============================================================

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS product text;

UPDATE public.checkout_sessions
SET product = COALESCE(product, 'journey')
WHERE product IS NULL;

ALTER TABLE public.checkout_sessions
  ALTER COLUMN product SET DEFAULT 'journey',
  ALTER COLUMN product SET NOT NULL;

ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_product_check;
ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_product_check
  CHECK (product IN ('games','journey','adults'));
