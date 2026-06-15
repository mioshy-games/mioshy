-- ============================================================
-- 112_subscription_prices.sql
--
-- C1 (billing rework): move games/journey subscription prices out of
-- the hardcoded PLAN_AMOUNTS_* matrices in lib/billing.ts into a
-- DB table the admin can edit live (no deploy), mirroring the
-- between_us_settings model used for the Adults pillar.
--
-- Designed with a cadence dimension from day one (weekly / monthly /
-- quarterly / yearly) even though only `weekly` is populated now, so
-- C2 (weekly display unit + monthly/quarterly/yearly charge interval)
-- only INSERTs rows — it never needs another migration.
--
-- Product scope: 'games' and 'journey' only. Adults stays one-time
-- (priced per game in experience_games / between_us_settings).
-- Quarterly is Journey-only (enforced below).
--
-- Conventions follow 029/082/108: uuid PK, _ils/_usd numeric(10,2),
-- public.is_admin() for admin RLS, DROP POLICY IF EXISTS → CREATE.
-- ============================================================

create table if not exists public.subscription_prices (
  id          uuid          primary key default gen_random_uuid(),
  product     text          not null check (product in ('games', 'journey')),
  cadence     text          not null check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  price_ils   numeric(10,2) not null check (price_ils > 0),
  price_usd   numeric(10,2) not null check (price_usd > 0),
  enabled     boolean       not null default false,
  is_default  boolean       not null default false,
  updated_at  timestamptz   not null default now(),
  updated_by  uuid          references auth.users(id) on delete set null,

  -- one row per (product, cadence)
  unique (product, cadence),

  -- Quarterly is Journey-only (Itzik: רבעוני רק לליווי).
  constraint subscription_prices_quarterly_journey_only
    check (cadence <> 'quarterly' or product = 'journey'),

  -- The default cadence must itself be enabled (you can't default to a
  -- cadence customers can't buy). Combined with the invariants trigger
  -- below this guarantees every product always has ≥1 enabled cadence.
  constraint subscription_prices_default_must_be_enabled
    check (not is_default or enabled)
);

-- At most one default cadence per product.
create unique index if not exists subscription_prices_one_default_per_product
  on public.subscription_prices (product)
  where is_default;

create index if not exists subscription_prices_product_cadence_idx
  on public.subscription_prices (product, cadence);

-- ------------------------------------------------------------
-- Invariants: every product must have EXACTLY ONE default cadence
-- (the partial unique index above caps it at ≤1; this enforces ≥1)
-- and AT LEAST ONE enabled cadence. Deferrable so a multi-statement
-- admin save (e.g. flip default from monthly→weekly in two UPDATEs)
-- only has to be consistent at COMMIT, not between statements.
-- ------------------------------------------------------------
create or replace function public.assert_subscription_prices_invariants()
returns trigger
language plpgsql
as $$
declare
  rec record;
begin
  for rec in
    select product,
           count(*) filter (where is_default) as default_count,
           count(*) filter (where enabled)    as enabled_count
    from public.subscription_prices
    group by product
  loop
    if rec.default_count <> 1 then
      raise exception
        'subscription_prices: product % must have exactly one default cadence (found %)',
        rec.product, rec.default_count;
    end if;
    if rec.enabled_count < 1 then
      raise exception
        'subscription_prices: product % must have at least one enabled cadence',
        rec.product;
    end if;
  end loop;
  return null;
end;
$$;

drop trigger if exists subscription_prices_invariants on public.subscription_prices;
create constraint trigger subscription_prices_invariants
  after insert or update or delete on public.subscription_prices
  deferrable initially deferred
  for each row execute function public.assert_subscription_prices_invariants();

-- ------------------------------------------------------------
-- RLS: public read (pricing is shown on marketing pages), admin write.
-- ------------------------------------------------------------
alter table public.subscription_prices enable row level security;

drop policy if exists subscription_prices_read on public.subscription_prices;
create policy subscription_prices_read
  on public.subscription_prices
  for select
  using (true);

drop policy if exists subscription_prices_admin_write on public.subscription_prices;
create policy subscription_prices_admin_write
  on public.subscription_prices
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- Atomic save RPC for the admin editor.
--
-- Why an RPC and not row-by-row .update() from the client: PostgREST
-- runs each request in its own transaction, but switching the default
-- cadence (clear old default, set new default) must be atomic — both to
-- satisfy the partial unique index `…_one_default_per_product` (which is
-- checked immediately, NOT deferrable) and the deferred invariants
-- trigger (checked at COMMIT). Doing it in one function = one
-- transaction solves both. Two passes: clear all referenced defaults
-- first (so the unique index never sees two TRUE rows at once), then
-- apply each row's full desired state.
--
-- SECURITY DEFINER bypasses RLS, so we re-check public.is_admin()
-- explicitly. p_actor is stamped into updated_by.
-- ------------------------------------------------------------
create or replace function public.save_subscription_prices(p_rows jsonb, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'save_subscription_prices: not authorized';
  end if;

  -- Pass 1: clear defaults on every referenced row.
  update public.subscription_prices
     set is_default = false
   where id in (
     select (elem->>'id')::uuid
     from jsonb_array_elements(p_rows) elem
   );

  -- Pass 2: apply each row's full desired state.
  for r in select * from jsonb_array_elements(p_rows)
  loop
    update public.subscription_prices set
      price_ils  = (r->>'price_ils')::numeric,
      price_usd  = (r->>'price_usd')::numeric,
      enabled    = (r->>'enabled')::boolean,
      is_default = (r->>'is_default')::boolean,
      updated_at = now(),
      updated_by = p_actor
    where id = (r->>'id')::uuid;
  end loop;
  -- The deferred invariants trigger validates (exactly-one-default +
  -- ≥1-enabled per product) when this function's transaction commits.
end;
$$;

revoke all on function public.save_subscription_prices(jsonb, uuid) from public, anon;
grant execute on function public.save_subscription_prices(jsonb, uuid) to authenticated;

-- ------------------------------------------------------------
-- Seed: weekly only (current production prices, ex-PLAN_AMOUNTS).
--   games   →  9 ₪ / $3 / week
--   journey → 57 ₪ / $17 / week
-- C2 will INSERT monthly/quarterly/yearly rows here.
--
-- MUST be the LAST statement in this migration: the INSERT fires the
-- DEFERRABLE INITIALLY DEFERRED invariants trigger, which leaves a
-- pending trigger event until COMMIT. Any ALTER TABLE after it (e.g.
-- ENABLE ROW LEVEL SECURITY) would fail with "cannot ALTER TABLE ...
-- because it has pending trigger events". With the seed last, no ALTER
-- follows and the deferred trigger fires cleanly at COMMIT.
-- ------------------------------------------------------------
insert into public.subscription_prices
  (product, cadence, price_ils, price_usd, enabled, is_default)
values
  ('games',   'weekly',  9.00,  3.00, true, true),
  ('journey', 'weekly', 57.00, 17.00, true, true)
on conflict (product, cadence) do nothing;
