-- ============================================================
-- 033_adults_three_tier_pricing.sql
-- Adults pillar pricing model: three tiers per game.
--   1. Single  - one-time purchase (default ₪127 / $39)
--   2. Monthly - recurring membership (default ₪87/mo / $24)
--   3. Annual  - recurring membership + cross-pillar game slot (default ₪570/yr / $149)
--
-- Pre-launch migration. We are intentionally renaming the legacy
-- `subscription_*` columns to `monthly_*` and dropping the now-obsolete
-- `subscription_interval` column (since monthly/annual are separate
-- tiers, not toggles). Per product decision: no backwards-compat shims.
-- ============================================================

-- ----------------------------------------------------------------
-- 1) between_us_settings: split subscription into monthly + annual
-- ----------------------------------------------------------------

-- Drop the old interval check constraint first so renames/drops below are safe.
alter table public.between_us_settings
  drop constraint if exists between_us_settings_interval_check;

-- Rename subscription_* → monthly_*
alter table public.between_us_settings
  rename column subscription_enabled to monthly_enabled;

alter table public.between_us_settings
  rename column subscription_price_ils to monthly_price_ils;

alter table public.between_us_settings
  rename column subscription_price_usd to monthly_price_usd;

-- Drop the obsolete interval column.
alter table public.between_us_settings
  drop column if exists subscription_interval;

-- Update defaults to reflect the new tier pricing (existing singleton row stays as-is).
alter table public.between_us_settings
  alter column single_price_ils set default 127.00,
  alter column single_price_usd set default 39.00,
  alter column monthly_price_ils set default 87.00,
  alter column monthly_price_usd set default 24.00;

-- Add annual tier columns.
alter table public.between_us_settings
  add column if not exists annual_enabled   boolean        not null default false,
  add column if not exists annual_price_ils numeric(10,2)  not null default 570.00,
  add column if not exists annual_price_usd numeric(10,2)  not null default 149.00;

-- Bump the singleton row to the new defaults so the admin UI
-- reflects the real launch pricing out of the gate. Only touch fields
-- that still hold the legacy seed values - avoid clobbering anything
-- the admin has already tuned.
update public.between_us_settings
set
  single_price_ils   = case when single_price_ils  in (87.00)  then 127.00 else single_price_ils end,
  single_price_usd   = case when single_price_usd  in (29.00)  then 39.00  else single_price_usd end,
  monthly_price_ils  = case when monthly_price_ils in (39.00)  then 87.00  else monthly_price_ils end,
  monthly_price_usd  = case when monthly_price_usd in (12.00)  then 24.00  else monthly_price_usd end
where id = 1;

-- ----------------------------------------------------------------
-- 2) experience_games: optional per-game single-purchase override
-- ----------------------------------------------------------------
-- The adults catalogue already has `price_ils` / `price_usd` columns on
-- `experience_games` - those are the authoritative per-game single-purchase
-- prices (with settings.single_price_* acting as the default at seed time).
-- No schema change needed here; documenting intent only.

-- ----------------------------------------------------------------
-- 3) subscriptions: add plan_tier to distinguish monthly vs annual
-- ----------------------------------------------------------------
-- `product` (from 032) tells us which pillar the subscription belongs to
-- (games / journey / adults). For adults we also need to know whether the
-- user is on the monthly or annual plan - the annual plan grants the
-- cross-pillar rotating game slot, monthly does not.

alter table public.subscriptions
  add column if not exists plan_tier text;

-- Backfill any existing adults subs (none expected pre-launch) to monthly.
update public.subscriptions
set plan_tier = 'monthly'
where product = 'adults' and plan_tier is null;

alter table public.subscriptions
  drop constraint if exists subscriptions_plan_tier_check;
alter table public.subscriptions
  add constraint subscriptions_plan_tier_check
  check (
    -- plan_tier is required for the adults product; other pillars may leave it null.
    (product <> 'adults')
    or (plan_tier in ('monthly', 'annual'))
  );

create index if not exists subscriptions_plan_tier_idx
  on public.subscriptions (plan_tier);
