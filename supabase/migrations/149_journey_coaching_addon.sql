-- 149_journey_coaching_addon.sql
-- Stage 1: coaching (expert chat) as a PAID ADD-ON on top of the journey
-- subscription. Additive + defaults-only — safe to run on the live DB
-- (preview == prod): with coaching_cost defaulting to 0 the charged amount
-- is unchanged (content + 0 = content) and existing subscribers keep the chat.
--
-- There is no migration runner; run this manually (DDL is not exposed via
-- PostgREST). Run as ONE transaction. See docs/journey-coaching-addon-spec.md.

begin;

-- 1) subscriptions.coaching --------------------------------------------------
alter table public.subscriptions
  add column if not exists coaching boolean not null default true;

-- Backfill existing journey subscriptions explicitly (default is already true;
-- kept for clarity and in case the column default ever changes).
update public.subscriptions
   set coaching = true
 where product = 'journey'
   and coaching is distinct from true;

-- 2) subscription_prices coaching cost (journey-only meaningful; default 0) ---
alter table public.subscription_prices
  add column if not exists coaching_cost_ils numeric(10,2) not null default 0
    check (coaching_cost_ils >= 0),
  add column if not exists coaching_cost_usd numeric(10,2) not null default 0
    check (coaching_cost_usd >= 0);
-- NOT touched: unique (product, cadence) / the invariants constraint trigger /
-- the "default-must-be-enabled" constraint. They stay exactly as-is.

-- 3) subscription_promos coaching targeting dimension ------------------------
alter table public.subscription_promos
  add column if not exists coaching_scope text not null default 'all'
    check (coaching_scope in ('with', 'without', 'all'));
-- 'all'     = applies regardless of the coaching choice (back-compat default)
-- 'with'    = only the "with coaching" option
-- 'without' = only the "without coaching" option

-- 4) checkout_sessions.coaching ----------------------------------------------
-- Carries the buyer's coaching choice from checkout/create to the Cardcom
-- indicator webhook, which stamps subscriptions.coaching and the bundle
-- plan_amount. Default true keeps in-flight sessions consistent; the webhook
-- reads `coaching ?? true`.
alter table public.checkout_sessions
  add column if not exists coaching boolean not null default true;

-- 5) save_subscription_prices RPC — persist the coaching cost too ------------
-- IDENTICAL to migration 115 (UPSERT by (product,cadence) + two-pass
-- clear-defaults; DEFERRABLE invariants trigger validates at COMMIT). The
-- ONLY change here is adding coaching_cost_ils/usd to the INSERT column list
-- and the ON CONFLICT … DO UPDATE SET. The shape is NOT being reverted to
-- UPDATE-by-id — 115 deliberately moved to UPSERT so the editor can CREATE
-- not-yet-seeded cadence rows. The admin form always submits the FULL
-- per-product set incl. exactly one default row (zod-enforced), so Pass 1's
-- clear-defaults is safe. coalesce(...,0) keeps older payloads safe.
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

  -- Pass 1: clear defaults for every product referenced in the payload.
  update public.subscription_prices
     set is_default = false
   where product in (
     select distinct (elem->>'product')
     from jsonb_array_elements(p_rows) elem
   );

  -- Pass 2: upsert each row by its natural key (product, cadence).
  for r in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.subscription_prices
      (product, cadence, price_ils, price_usd,
       coaching_cost_ils, coaching_cost_usd,
       enabled, is_default, updated_at, updated_by)
    values (
      r->>'product',
      r->>'cadence',
      (r->>'price_ils')::numeric,
      (r->>'price_usd')::numeric,
      coalesce((r->>'coaching_cost_ils')::numeric, 0),
      coalesce((r->>'coaching_cost_usd')::numeric, 0),
      (r->>'enabled')::boolean,
      (r->>'is_default')::boolean,
      now(),
      p_actor
    )
    on conflict (product, cadence) do update set
      price_ils         = excluded.price_ils,
      price_usd         = excluded.price_usd,
      coaching_cost_ils = excluded.coaching_cost_ils,
      coaching_cost_usd = excluded.coaching_cost_usd,
      enabled           = excluded.enabled,
      is_default        = excluded.is_default,
      updated_at        = now(),
      updated_by        = p_actor;
  end loop;
end;
$$;

-- Grants unchanged from 112/115; re-asserted for idempotency (parity with 115).
revoke all on function public.save_subscription_prices(jsonb, uuid) from public, anon;
grant execute on function public.save_subscription_prices(jsonb, uuid) to authenticated;

commit;
