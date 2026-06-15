-- 122_leads_phone_source.sql
-- =============================================================================
-- G (g-h-launch): marathon lead capture. The 7-day couples marathon runs over
-- WhatsApp, so we need the lead's phone (mobile) and a `source` tag to separate
-- marathon signups from other leads for manual outreach + funnel reporting.
--
-- Both columns nullable + additive; existing lead capture (/api/leads/upsert)
-- is unaffected. No RLS change: the anon-insert WITH CHECK policy (migration 012)
-- validates email/device_id/language/status only, which still holds.
-- =============================================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone  text,
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.leads.phone  IS 'Mobile number for WhatsApp outreach (e.g. marathon). Nullable.';
COMMENT ON COLUMN public.leads.source IS 'Acquisition tag, e.g. ''marathon-7day''. Nullable; existing leads stay NULL.';

CREATE INDEX IF NOT EXISTS leads_source_idx ON public.leads (source);
