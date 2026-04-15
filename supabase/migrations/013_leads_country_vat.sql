-- Leads: capture country for VAT logic

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS country_code text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS country_name text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS vat_rate_percent integer NOT NULL DEFAULT 0;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_country_code_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_country_code_check
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_vat_rate_percent_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_vat_rate_percent_check
  CHECK (vat_rate_percent IN (0, 18));

-- Backfill VAT flag for existing leads (best-effort)
UPDATE public.leads
SET vat_rate_percent = 18
WHERE country_code = 'IL';

