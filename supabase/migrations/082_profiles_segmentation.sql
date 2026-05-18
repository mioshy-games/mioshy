-- 082_profiles_segmentation.sql
--
-- Marketing-consent + preferred-language columns on profiles, in support
-- of the Brevo segmentation sync layer (Step C of the segmentation rollout).
--
-- Why these columns live on profiles, not on leads:
--   The existing `leads` table (migrations 012, 018) already carries
--   marketing_consent + terms_accepted, but that table is keyed by
--   (email, device_id) and represents anonymous interest captures. Once
--   a visitor signs up, the authoritative record of their consent must
--   move to `profiles` so:
--     1. The signup action can stamp it transactionally with the auth
--        user creation.
--     2. The Brevo sync layer can read it from a single row instead of
--        joining across leads.
--     3. The unsubscribe webhook (app/api/brevo/unsubscribe-webhook)
--        has one row to flip.
--
-- The columns are additive with safe defaults. No backfill from `leads`
-- is performed here — that's a separate concern (still an open question
-- in docs/segmentation-audit-2026-05-17.md §6 item 9). New signups will
-- have explicit consent stamped by the signup action; existing users
-- remain consent=false until they opt in.
--
-- Israeli Communications Act §30A reminder: marketing emails require
-- prior explicit consent. Transactional emails (receipts, invitations,
-- service notifications) are not gated by this flag; those flow through
-- separate code paths.

-- ----------------------------------------------------------------
-- 1) marketing_consent state on profiles
-- ----------------------------------------------------------------
alter table public.profiles
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text;

-- marketing_consent_source values used by app code (free-form text in
-- the schema for forward compatibility, but these are the known values):
--   'signup'              — set at /auth/signup with the consent checkbox
--   'registration_modal'  — set at the in-game RegistrationModal popup
--   'lead_promotion'      — backfilled from a prior leads-table opt-in
--   'admin'               — manually set by an admin
--   'brevo_unsubscribe'   — flipped to false by the Brevo webhook

-- ----------------------------------------------------------------
-- 2) preferred_language on profiles
-- ----------------------------------------------------------------
-- Until now, language has been re-detected per-request from URL/headers
-- (see middleware.ts detectLocale()). For email sends we need a sticky
-- per-user value. Default to 'he' to match the public-app default; the
-- signup action will stamp this from the resolved locale at signup time.
alter table public.profiles
  add column if not exists preferred_language text not null default 'he';

alter table public.profiles
  drop constraint if exists profiles_preferred_language_check;
alter table public.profiles
  add constraint profiles_preferred_language_check
  check (preferred_language in ('he', 'en'));

-- ----------------------------------------------------------------
-- 3) Index for fast "who opted in" lookups
-- ----------------------------------------------------------------
-- Partial index — only rows that have actually opted in. The vast
-- majority of profiles will sit at marketing_consent = false (most
-- people skip the checkbox), so the partial index stays small and
-- the segmentation-sync workers can list opted-in profiles cheaply.
create index if not exists idx_profiles_marketing_consent
  on public.profiles (marketing_consent)
  where marketing_consent = true;

-- ----------------------------------------------------------------
-- Idempotency note
-- ----------------------------------------------------------------
-- All ALTERs use `if not exists` / `drop constraint if exists` patterns
-- so this file can be re-applied without error. No data is mutated.
