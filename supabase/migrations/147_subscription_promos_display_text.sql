-- ───────────────────────────────────────────────────────────────────────────
-- 147_subscription_promos_display_text.sql
--
-- Adds an optional customer-facing display title to subscription_promos. The
-- existing `name` is the ADMIN label ("July 50%"); `display_text` is what the
-- customer sees on the offer (e.g. "מבצע קיץ - 50% הנחה"). Null/empty → the UI
-- falls back to "מבצע {name}".
--
-- Additive + nullable → safe. Changes no billing behaviour. Itzik runs this
-- migration manually.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.subscription_promos
  ADD COLUMN IF NOT EXISTS display_text text;  -- customer-facing title; null = "מבצע {name}"
