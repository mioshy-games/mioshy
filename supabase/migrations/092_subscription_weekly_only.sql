-- ============================================================
-- 092_subscription_weekly_only.sql
--
-- Itzik 2026-05-22: pricing simplification.
-- ─────────────────────────────────────────
-- • All subscriptions are weekly only — monthly/annual plans are removed.
-- • Games subscription: 9 ₪/week (and $3 USD).
-- • Journey subscription: 57 ₪/week (and $17 USD).
-- • Adults: one-time per game purchase (unchanged).
--
-- Effects on schema:
--   1. checkout_sessions.plan CHECK constraint narrowed to ('weekly','one_time').
--   2. subscriptions.plan CHECK constraint added (didn't exist before)
--      narrowing to 'weekly' only.
--   3. The plan_tier column from migration 033 stays in place but becomes
--      vestigial — we keep it to preserve schema history, but no code
--      writes or reads it any more.
--
-- Pre-launch context:
--   No production data with monthly/annual plans exists yet (Itzik
--   confirmed). The migration therefore does NOT attempt to backfill
--   existing rows — it asserts the new shape, period.
-- ============================================================

-- ---------------------------------------------------------------
-- 1) checkout_sessions.plan: drop old CHECK, add the narrower one.
-- ---------------------------------------------------------------
-- The original CHECK is unnamed (created inline in 016), so we discover
-- and drop it by scanning the constraint list. PostgreSQL names inline
-- CHECKs as `<table>_<column>_check`, so the canonical name is reliable.
alter table public.checkout_sessions
  drop constraint if exists checkout_sessions_plan_check;

alter table public.checkout_sessions
  add constraint checkout_sessions_plan_check
  check (plan in ('weekly', 'one_time'));

-- ---------------------------------------------------------------
-- 2) subscriptions.plan: add CHECK (previously had none).
-- ---------------------------------------------------------------
-- subscriptions is created in migration 012 with `plan text` and no
-- CHECK. We add one now so the database refuses to insert any plan
-- other than 'weekly'. (One_time purchases never create subscriptions
-- rows — they only create couple_entitlements — so 'weekly' is the
-- single legal value here.)
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_check;

alter table public.subscriptions
  add constraint subscriptions_plan_check
  check (plan is null or plan = 'weekly');

-- ---------------------------------------------------------------
-- 3) subscriptions: add cancelled_at + cancellation_reason for the
--    games→journey upgrade flow.
-- ---------------------------------------------------------------
-- When the Cardcom indicator confirms a journey purchase and the buyer
-- already had an active games subscription, we mark the games sub as
-- cancelled (no refund — per the 2026-05-22 policy decision) and record
-- the reason. The renewals cron only selects status IN ('active',
-- 'past_due'), so a 'cancelled' row will simply stop renewing.
--
-- Both columns are nullable: an active subscription has cancelled_at IS
-- NULL. A subscription that was cancelled by the user from /my/account
-- would carry cancellation_reason = 'user_request' (future feature).
alter table public.subscriptions
  add column if not exists cancelled_at         timestamptz,
  add column if not exists cancellation_reason  text;

-- ---------------------------------------------------------------
-- 4) Diagnostic: log how many existing rows would violate the new
--    constraint. In a pre-launch environment this should be 0.
-- ---------------------------------------------------------------
do $$
declare
  bad_sessions int;
  bad_subs     int;
begin
  select count(*) into bad_sessions
    from public.checkout_sessions
    where plan not in ('weekly', 'one_time');

  select count(*) into bad_subs
    from public.subscriptions
    where plan is not null and plan <> 'weekly';

  if bad_sessions > 0 or bad_subs > 0 then
    raise warning
      'migration 092: % checkout_sessions and % subscriptions rows have non-weekly plans. The new CHECK constraints will refuse new inserts but existing rows remain. Consider data fix-up.',
      bad_sessions, bad_subs;
  end if;
end $$;
