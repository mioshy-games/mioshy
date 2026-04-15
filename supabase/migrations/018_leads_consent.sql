-- 018_leads_consent.sql
-- Add legal-consent fields to the leads table.
-- stored for GDPR / legal audit: marketing opt-in, T&C acceptance timestamp.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS full_name          text,
  ADD COLUMN IF NOT EXISTS marketing_consent  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL;
