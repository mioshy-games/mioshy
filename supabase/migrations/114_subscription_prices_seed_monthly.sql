-- ============================================================
-- 114_subscription_prices_seed_monthly.sql
--
-- C2.2b: additive seed of the MONTHLY cadence rows for games + journey.
--
-- Purely additive — this migration does NOT flip the default or disable
-- weekly. weekly stays enabled + default; monthly is added as enabled
-- but NOT default. The default weekly→monthly flip and disabling weekly
-- for purchase happen LIVE from the admin pricing editor (C2.3), so they
-- stay reversible without a migration.
--
-- Prices (no monthly discount — effective-weekly matches the displayed
-- weekly figure at 4.345 weeks/month):
--   games   monthly  ₪39 / $13   (39/4.345 ≈ ₪9 ;  13/4.345 ≈ $3)
--   journey monthly ₪249 / $74   (249/4.345 ≈ ₪57; 74/4.345 ≈ $17)
--
-- Quarterly/yearly rows are NOT seeded here — those will be added with
-- their (discounted) prices via the admin editor in C2.3.
--
-- Invariants after this runs (validated by the deferred trigger at
-- COMMIT): each product has default_count = 1 (weekly) and
-- enabled_count = 2 (weekly + monthly). No ALTER follows the INSERT, so
-- there's no "pending trigger events" hazard.
-- ============================================================

insert into public.subscription_prices
  (product, cadence, price_ils, price_usd, enabled, is_default)
values
  ('games',   'monthly',  39.00, 13.00, true, false),
  ('journey', 'monthly', 249.00, 74.00, true, false)
on conflict (product, cadence) do nothing;
