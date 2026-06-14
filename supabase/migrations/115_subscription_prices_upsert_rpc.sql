-- ============================================================
-- 115_subscription_prices_upsert_rpc.sql
--
-- C2.3: upgrade save_subscription_prices from UPDATE-by-id to UPSERT
-- by (product, cadence), so the admin pricing editor can CREATE the
-- quarterly / yearly rows that don't exist yet (not just edit existing
-- ones). Additive: CREATE OR REPLACE of the existing function — same
-- name, same signature (jsonb, uuid), so the server action is unchanged.
--
-- Payload rows now key on (product, cadence) — the `id` field is no
-- longer required (and is ignored if present). Each row:
--   { product, cadence, price_ils, price_usd, enabled, is_default }
--
-- Assumption: the editor submits the FULL set of rows for each product
-- it touches (all enabled+candidate cadences), so Pass 1 can safely
-- clear that product's default knowing Pass 2 re-establishes exactly one.
--
-- Two passes (same rationale as 112): clear defaults for the referenced
-- products first so the partial unique index `…_one_default_per_product`
-- never sees two TRUE rows at once; then upsert each row's full state.
-- The DEFERRABLE INITIALLY DEFERRED invariants trigger validates
-- (exactly-one-default + ≥1-enabled per product) at COMMIT. The
-- per-row CHECKs (quarterly→journey, default-must-be-enabled) still fire
-- immediately, so a bad row is rejected at once.
-- ============================================================
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
      (product, cadence, price_ils, price_usd, enabled, is_default, updated_at, updated_by)
    values (
      r->>'product',
      r->>'cadence',
      (r->>'price_ils')::numeric,
      (r->>'price_usd')::numeric,
      (r->>'enabled')::boolean,
      (r->>'is_default')::boolean,
      now(),
      p_actor
    )
    on conflict (product, cadence) do update set
      price_ils  = excluded.price_ils,
      price_usd  = excluded.price_usd,
      enabled    = excluded.enabled,
      is_default = excluded.is_default,
      updated_at = now(),
      updated_by = p_actor;
  end loop;
end;
$$;

-- grants are unchanged from 112, re-asserted for idempotency.
revoke all on function public.save_subscription_prices(jsonb, uuid) from public, anon;
grant execute on function public.save_subscription_prices(jsonb, uuid) to authenticated;
