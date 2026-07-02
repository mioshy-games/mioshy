-- ============================================================
-- 157_seven_day_trial.sql
-- A3 — 7-day free trial (money/Cardcom heavy). Itzik runs manually.
--
-- Principle: at signup the card is tokenized + validated via Cardcom J2
-- (no charge, no hold) and the customer gets 7 days of full access. On
-- day 7 the existing renewals cron charges the token using the price/promo
-- SNAPSHOT taken at signup (reuses plan_amount / intro_amount /
-- intro_charges_remaining / promo_id / coaching — no new snapshot columns).
--
-- This migration is ADDITIVE:
--   * subscriptions.trial_ends_at  — NEW. When status='trialing', the
--                                    first real charge is due at this time.
--   * subscriptions.status enum    — adds 'trialing'.
--   * checkout_sessions.is_trial   — NEW. Marks a trial (token+J2) session
--                                    so the trial webhook path is used.
--   * trial_settings               — NEW. Admin per-(product,coaching)
--                                    on/off toggle for who offers a trial.
--   * trial_redemptions            — NEW. One trial per account AND per
--                                    card fingerprint (abuse prevention).
--
-- Existing immediate-charge purchases (games/journey/adults) are unaffected:
-- they never set is_trial / trial_ends_at and never reach status='trialing'.
-- ============================================================

begin;

-- ── 1. subscriptions: trial deadline + 'trialing' status ────────────────────
alter table public.subscriptions
  add column if not exists trial_ends_at timestamptz;

comment on column public.subscriptions.trial_ends_at is
  '7-day free-trial deadline. While status=''trialing'' the token is not charged; '
  'the renewals cron makes the FIRST real charge when now >= trial_ends_at, then '
  'transitions the subscription to ''active''. NULL for non-trial subscriptions.';

-- Extend the status enum to add 'trialing' (drop + re-add, mirroring 057).
-- Keep the prior authoritative set (migration 057) intact.
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in (
    'active',
    'cancelled',
    'canceled',     -- legacy spelling
    'paused',       -- legacy
    'expired',
    'past_due',
    'blocked',
    'frozen',
    'grace',        -- 14-day journey natural-expiry window (057)
    'trialing'      -- NEW: 7-day free trial, first charge deferred to trial_ends_at
  ));

comment on column public.subscriptions.status is
  'active | cancelled | canceled | paused | expired | past_due | blocked | frozen | grace | trialing';

-- Cron query helper: trialing subs whose trial has ended and are due for
-- their first charge.
create index if not exists subscriptions_trial_due_idx
  on public.subscriptions (trial_ends_at)
  where status = 'trialing';

-- ── 2. checkout_sessions: mark trial (token+J2) sessions ────────────────────
alter table public.checkout_sessions
  add column if not exists is_trial boolean not null default false;

comment on column public.checkout_sessions.is_trial is
  'true = 7-day trial checkout (Cardcom v11 CreateTokenOnly + J2, no charge). '
  'Processed by /api/billing/cardcom/trial-indicator, NOT the standard indicator.';

-- ── 3. trial_settings: admin per-(product,coaching) toggle ──────────────────
-- Eligibility is per (product, coaching): games (no coaching),
-- journey-with-coaching, journey-without-coaching. subscription_prices is
-- keyed (product,cadence) with no coaching axis, so this is a dedicated table.
create table if not exists public.trial_settings (
  id         uuid        primary key default gen_random_uuid(),
  product    text        not null check (product in ('games', 'journey')),
  coaching   boolean     not null,
  enabled    boolean     not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id) on delete set null,
  -- one row per eligible package
  unique (product, coaching),
  -- games has no coaching add-on: only (games,false) is valid.
  constraint trial_settings_games_no_coaching
    check (product <> 'games' or coaching = false)
);

comment on table public.trial_settings is
  'Admin toggle for which subscription packages offer a 7-day free trial. '
  'Keyed by (product, coaching): games(false), journey(true), journey(false).';

-- RLS: public read (the CTA on marketing/paywall surfaces needs to know
-- whether to offer a trial), admin write. Mirrors subscription_prices (112).
alter table public.trial_settings enable row level security;

drop policy if exists trial_settings_read on public.trial_settings;
create policy trial_settings_read
  on public.trial_settings
  for select
  using (true);

drop policy if exists trial_settings_admin_write on public.trial_settings;
create policy trial_settings_admin_write
  on public.trial_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed the three eligible packages, all OFF by default (admin opts in).
insert into public.trial_settings (product, coaching, enabled)
values
  ('games',   false, false),
  ('journey', true,  false),
  ('journey', false, false)
on conflict (product, coaching) do nothing;

-- ── 4. trial_redemptions: one trial per account AND per card ────────────────
-- Abuse prevention (spec decision 4). card_fingerprint =
-- sha256(first6 + last4 + expiry_mmyy) — the raw Cardcom token is NOT stable
-- across tokenizations, so we fingerprint the card itself. A second trial is
-- blocked if EITHER the user_id OR the fingerprint already redeemed one.
create table if not exists public.trial_redemptions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  card_fingerprint text        not null,
  product          text        not null,
  coaching         boolean     not null default false,
  subscription_id  uuid        references public.subscriptions(id) on delete set null,
  created_at       timestamptz not null default now()
);

comment on table public.trial_redemptions is
  'One 7-day trial per account AND per card. A new trial is refused if user_id '
  'OR card_fingerprint already appears here. card_fingerprint = '
  'sha256(first6 + last4 + expiry_mmyy).';

-- Fast abuse lookups. NOT unique: a legitimate re-check queries both; the
-- checkout route enforces the "one trial" rule in code before inserting.
create index if not exists trial_redemptions_user_idx
  on public.trial_redemptions (user_id);
create index if not exists trial_redemptions_fingerprint_idx
  on public.trial_redemptions (card_fingerprint);

alter table public.trial_redemptions enable row level security;

drop policy if exists "trial_redemptions: service_role full access" on public.trial_redemptions;
create policy "trial_redemptions: service_role full access"
  on public.trial_redemptions for all
  to service_role using (true) with check (true);

drop policy if exists "trial_redemptions: user reads own" on public.trial_redemptions;
create policy "trial_redemptions: user reads own"
  on public.trial_redemptions for select
  to authenticated using (user_id = auth.uid());

-- ── 5. journey_notifications: new kinds for the trial ───────────────────────
-- 'trial_ending_soon'        — user reminder ~2 days before the first charge.
-- 'trial_first_charge_failed'— admin alert when the day-7 charge fails.
-- Re-declare the full CHECK (mirrors migration 060) with the two new kinds.
alter table public.journey_notifications
  drop constraint if exists journey_notifications_kind_check;
alter table public.journey_notifications
  add constraint journey_notifications_kind_check
  check (kind in (
    'item_message_user_posted',
    'item_message_expert_replied',
    'channel_message_user_posted',
    'channel_message_expert_replied',
    'item_unlocked',
    'expert_push_landed',
    'subscription_grace_started',
    'subscription_blocked',
    'reminder_inactivity',
    'reminder_unfollowed_reply',
    'cron_failure',
    'stuck_users_digest',
    'trial_ending_soon',          -- NEW (A3)
    'trial_first_charge_failed'   -- NEW (A3)
  ));

commit;

select pg_notify('pgrst', 'reload schema');
