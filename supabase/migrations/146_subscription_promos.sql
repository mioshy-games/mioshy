-- ───────────────────────────────────────────────────────────────────────────
-- 146_subscription_promos.sql
--
-- Marketing discounts for subscriptions (docs/marketing-discounts-spec.md §5).
-- STEP 1 — infrastructure ONLY: the promos table + the columns that later carry
-- the discount through checkout → subscription. No checkout/webhook/renewal
-- wiring here (that is step 2+). Itzik runs this migration manually.
--
-- Money-path note: these columns are additive and unused until step 2, so
-- applying this migration alone changes no billing behaviour.
-- ───────────────────────────────────────────────────────────────────────────

-- ── New table: subscription_promos ──────────────────────────────────────────
-- Separate from the existing `promotions` table (Adults Buy-X-Get-Y, scoped to
-- wheel/snakes) — see spec §5.1.
CREATE TABLE IF NOT EXISTS public.subscription_promos (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,                 -- admin display ("July 50%")
  code               text,                                 -- optional coupon; null = automatic in window
  discount_type      text        NOT NULL CHECK (discount_type IN ('percent','fixed_amount')),
  percent            numeric(5,2),                         -- percent: 50 → 50% (currency-agnostic)
  amount_ils         numeric(10,2),                        -- fixed_amount: ILS off
  amount_usd         numeric(10,2),                        -- fixed_amount: independent USD off (v1: null)
  product            text        NOT NULL CHECK (product IN ('journey','games','all')),
  discounted_charges int         NOT NULL DEFAULT 4,       -- "first month" = N weekly charges
  starts_at          timestamptz NOT NULL,                 -- eligibility window (by purchase date)
  ends_at            timestamptz NOT NULL,
  is_active          boolean     NOT NULL DEFAULT true,
  max_redemptions    int,                                  -- optional global cap
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- a percent promo needs `percent`; a fixed promo needs at least one amount.
  CONSTRAINT subscription_promos_value_chk CHECK (
    (discount_type = 'percent'      AND percent IS NOT NULL)
    OR (discount_type = 'fixed_amount' AND (amount_ils IS NOT NULL OR amount_usd IS NOT NULL))
  ),
  CONSTRAINT subscription_promos_window_chk  CHECK (ends_at >= starts_at),
  CONSTRAINT subscription_promos_charges_chk CHECK (discounted_charges >= 1)
);

-- Active-window lookups during checkout (spec §6.1).
CREATE INDEX IF NOT EXISTS subscription_promos_active_window_idx
  ON public.subscription_promos (is_active, starts_at, ends_at);

-- RLS: writes (admin) + reads (server-side checkout) go through the service role
-- ONLY; never exposed to anon/authenticated. (service_role bypasses RLS; the
-- explicit policy documents intent and matches the billing tables in mig 016.)
ALTER TABLE public.subscription_promos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_promos: service_role full access" ON public.subscription_promos;
CREATE POLICY "subscription_promos: service_role full access"
  ON public.subscription_promos FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── subscriptions: lock the applied promo onto the sub (spec §5.2) ───────────
-- plan_amount stays the FULL price so renewals after the first month are full.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS promo_id                uuid REFERENCES public.subscription_promos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intro_amount            numeric(10,2),
  ADD COLUMN IF NOT EXISTS intro_charges_remaining int NOT NULL DEFAULT 0;

-- ── checkout_sessions: carry the discount through checkout (spec §6.1) ───────
ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS promo_id        uuid REFERENCES public.subscription_promos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_amount numeric(10,2);
