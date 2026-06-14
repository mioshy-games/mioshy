-- ============================================================
-- 113_subscription_cadence_enum.sql
--
-- C2.0 (billing rework): widen the plan/cadence enums that migration
-- 092 had narrowed to weekly-only, so monthly / quarterly / yearly
-- subscriptions become legal. Display to the customer stays weekly
-- ("₪9/שבוע"); the ACTUAL charge interval becomes the cadence (default
-- will move to monthly in a later step).
--
-- This migration is ENUM-WIDENING ONLY. It does NOT:
--   • insert monthly/quarterly/yearly price rows (subscription_prices
--     already allows all four cadences since migration 112 — rows are
--     added later via the admin editor / a seed step),
--   • flip the default cadence weekly→monthly,
--   • disable weekly for purchase.
-- Those are separate, reviewed steps (C2.3). On its own this migration
-- is inert: with no monthly rows yet, checkout still only offers weekly.
--
-- Mirrors 092's approach: drop the inline CHECK by its canonical name,
-- add the wider one. Idempotent (DROP ... IF EXISTS → ADD).
-- ============================================================

-- ---------------------------------------------------------------
-- 1) checkout_sessions.plan: widen to all cadences + one_time.
-- ---------------------------------------------------------------
alter table public.checkout_sessions
  drop constraint if exists checkout_sessions_plan_check;

alter table public.checkout_sessions
  add constraint checkout_sessions_plan_check
  check (plan in ('weekly', 'monthly', 'quarterly', 'yearly', 'one_time'));

-- ---------------------------------------------------------------
-- 2) subscriptions.plan: widen to all recurring cadences.
--    (one_time never creates a subscriptions row — it only creates a
--    couple_entitlement — so it's intentionally NOT in this list.)
-- ---------------------------------------------------------------
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan is null or plan in ('weekly', 'monthly', 'quarterly', 'yearly'));

-- ---------------------------------------------------------------
-- 3) Quarterly is Journey-only — guard at the subscription level too.
--    (subscription_prices already enforces this for the price catalog;
--    this mirrors the rule on the actual subscription rows so a
--    games+quarterly subscription can never be written.)
--    NOTE: this goes slightly beyond pure enum-widening — included
--    because it's the same already-agreed rule. Remove if you want 113
--    to be strictly widening.
-- ---------------------------------------------------------------
alter table public.subscriptions
  drop constraint if exists subscriptions_quarterly_journey_only;

alter table public.subscriptions
  add constraint subscriptions_quarterly_journey_only
  check (plan is distinct from 'quarterly' or product = 'journey');

-- ---------------------------------------------------------------
-- 4) Diagnostic: count rows that would violate the (unchanged-shape)
--    constraints. Pre-launch this should be 0.
-- ---------------------------------------------------------------
do $$
declare
  bad_sessions int;
  bad_subs     int;
begin
  select count(*) into bad_sessions
    from public.checkout_sessions
    where plan not in ('weekly', 'monthly', 'quarterly', 'yearly', 'one_time');

  select count(*) into bad_subs
    from public.subscriptions
    where plan is not null
      and plan not in ('weekly', 'monthly', 'quarterly', 'yearly');

  if bad_sessions > 0 or bad_subs > 0 then
    raise warning
      'migration 113: % checkout_sessions and % subscriptions rows have out-of-range plans.',
      bad_sessions, bad_subs;
  end if;
end $$;
