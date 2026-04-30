-- ============================================================
-- 032_subscription_product_pillar.sql
-- Distinguish subscriptions by product pillar (games / journey / adults).
-- Pre-launch migration - no live user backfill needed beyond defaulting
-- existing rows to 'journey' (which is what the old flow was built for).
-- ============================================================

-- 1) Add `product` column -------------------------------------------------
alter table public.subscriptions
  add column if not exists product text;

-- Backfill any existing rows: treat legacy subs as journey subscriptions
update public.subscriptions
set product = coalesce(product, 'journey')
where product is null;

alter table public.subscriptions
  alter column product set default 'journey',
  alter column product set not null;

alter table public.subscriptions
  drop constraint if exists subscriptions_product_check;
alter table public.subscriptions
  add constraint subscriptions_product_check
  check (product in ('games', 'journey', 'adults'));

create index if not exists subscriptions_product_idx
  on public.subscriptions (product);

-- 2) Relax the "one active subscription per user" unique constraint --------
-- Users can now hold one active subscription per product pillar.
drop index if exists public.subscriptions_user_active_key;
create unique index if not exists subscriptions_user_product_active_key
  on public.subscriptions (user_id, product)
  where status = 'active';
