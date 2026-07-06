-- ───────────────────────────────────────────────────────────────────────────
-- 177_email_hard_bounces.sql
--
-- Hard-bounce suppression store (Itzik 2026-07-06, mailing diagnostics step 3).
-- A dedicated email-keyed table because profiles has no email column. The Brevo
-- event webhook stamps a row on every hardBounce; sendBrevoEmail then skips any
-- recipient present here, so a fake/broken address that hard-bounced can never
-- re-contaminate a future send.
--
-- Idempotent.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_hard_bounces (
  email       text PRIMARY KEY,
  bounced_at  timestamptz NOT NULL DEFAULT now(),
  reason      text,
  source      text DEFAULT 'brevo_webhook'
);

ALTER TABLE public.email_hard_bounces ENABLE ROW LEVEL SECURITY;
-- Service-role only (webhook writes, sender reads via the admin client). No
-- policies → anon/authenticated get nothing; the service role bypasses RLS.
