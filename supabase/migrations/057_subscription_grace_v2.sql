-- ============================================================
-- 057_subscription_grace_v2.sql
-- Slice 1 of the v3 per-partner content delivery system.
--
-- Adds a 14-day natural-expiry grace window on top of the existing
-- 7-day payment-failure grace (which is unchanged - `grace_until`
-- column from migration 016 still belongs to the renewal cron's
-- failure path).
--
-- This migration is ADDITIVE and does NOT change any existing logic:
--   * grace_until      - untouched. Set by /api/billing/renewals/run
--                        when a charge fails. Window = 7 days.
--   * journey_grace_until - NEW. Set by the journey grace-watcher cron
--                        (slice 5) when current_period_end passes for
--                        an active subscription that didn't renew.
--                        Window = 14 days. After it elapses,
--                        journey_blocked_at is stamped and entitlement
--                        flips to "blocked".
--   * journey_blocked_at  - NEW. Set when the 14-day window has
--                        passed without renewal. Cleared on renewal.
--   * status enum         - adds 'grace'. Slice 5 transitions
--                        active -> grace (when current_period_end
--                        passes) and grace -> expired (when
--                        journey_grace_until passes without renewal).
--
-- The cadence engine (slice 3) reads journey_grace_until / blocked_at
-- to decide whether to materialize the next item: in grace, no new
-- materialization but past content stays accessible; blocked, nothing.
-- ============================================================

begin;

alter table public.subscriptions
  add column if not exists journey_grace_until timestamptz,
  add column if not exists journey_blocked_at  timestamptz;

-- Extend the status enum to add 'grace'. Keep the prior set intact
-- (mirrors migration 025's pattern - drop + add).
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in (
    'active',
    'cancelled',
    'canceled',     -- legacy spelling, present in 012_leads_and_subscriptions.sql
    'paused',       -- legacy, present in 012
    'expired',
    'past_due',
    'blocked',
    'frozen',
    'grace'         -- NEW: 14-day journey grace window after natural expiry
  ));

comment on column public.subscriptions.status is
  'active | cancelled | canceled | paused | expired | past_due | blocked | frozen | grace';
comment on column public.subscriptions.journey_grace_until is
  '14-day natural-expiry grace deadline. Set by the journey grace-watcher cron when current_period_end passes without renewal. Distinct from grace_until (7-day payment-failure window).';
comment on column public.subscriptions.journey_blocked_at is
  'Stamped when journey_grace_until elapses without renewal. Entitlement flips to blocked. Cleared on renewal.';

-- Useful for the grace-watcher cron query.
create index if not exists subscriptions_journey_grace_due_idx
  on public.subscriptions (journey_grace_until)
  where journey_grace_until is not null and journey_blocked_at is null;

create index if not exists subscriptions_status_grace_idx
  on public.subscriptions (status, current_period_end)
  where status in ('active','grace');

commit;

select pg_notify('pgrst', 'reload schema');
