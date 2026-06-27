-- ───────────────────────────────────────────────────────────────────────────
-- 148_subscription_promos_cadence.sql
--
-- Lets a promo be limited to a single billing cadence (e.g. "monthly only").
-- `cadence` is nullable: NULL = applies to ALL cadences (today's behaviour). A
-- concrete value ('weekly'/'monthly'/'quarterly'/'yearly') restricts the promo
-- so it only discounts a checkout whose resolved cadence matches.
--
-- Additive + nullable → safe. Existing promos (cadence NULL) keep applying to
-- every cadence, so this migration changes no current behaviour. Itzik runs it.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.subscription_promos
  ADD COLUMN IF NOT EXISTS cadence text
    CHECK (cadence IS NULL OR cadence IN ('weekly','monthly','quarterly','yearly'));
  -- NULL = all cadences; otherwise the promo applies only to that cadence.
