-- ───────────────────────────────────────────────────────────────────────────
-- 180_profiles_whatsapp_opt_in_columns.sql
--
-- Restores the whatsapp opt-in columns on public.profiles. Migration 120
-- (whatsapp_messaging) declared them, but they never landed in the live DB, so
-- the columns are MISSING in prod.
--
-- Impact (found 2026-07-08): app/actions/journey-inline-signup.ts writes
-- marketing_consent in the SAME profiles.upsert({...}) that also sets
-- whatsapp_opt_in / _at / _source. PostgREST rejects the whole statement when a
-- referenced column doesn't exist, so the upsert throws and NOTHING persists —
-- marketing_consent, full_name AND gender all silently fail to save on every
-- journey inline signup. This is the root cause of the "0 consented" audience.
--
-- Additive + idempotent (add column if not exists); safe on rows already present
-- (whatsapp_opt_in defaults false). No data loss. Mirrors migration 120's DDL.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists whatsapp_opt_in        boolean     not null default false,
  add column if not exists whatsapp_opt_in_at      timestamptz,
  add column if not exists whatsapp_opt_in_source  text,
  add column if not exists whatsapp_opt_out_at     timestamptz;

comment on column public.profiles.whatsapp_opt_in is
  'Marketing WhatsApp opt-in (Israeli Communications Act §30A). Written together with marketing_consent by journey inline signup.';
comment on column public.profiles.whatsapp_opt_in_source is
  'Where the opt-in was captured (e.g. journey_inline).';
