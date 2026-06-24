-- ───────────────────────────────────────────────────────────────────────────
-- 141_profiles_terms_accepted.sql
--
-- Record terms/privacy acceptance per user on public.profiles. Until now these
-- existed only on the `leads` table; the journey inline signup
-- (app/actions/journey-inline-signup.ts) needs them on profiles so every
-- registered user carries the status + timestamp (shown in the admin).
--
-- marketing_consent / marketing_consent_at / marketing_consent_source already
-- exist on profiles — this only adds the two terms columns.
--
-- Additive and safe: terms_accepted defaults false so existing rows get a
-- well-defined value; terms_accepted_at stays NULL for them. IF NOT EXISTS so
-- it is idempotent / re-runnable. Apply manually on prod (no auto-runner).
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
