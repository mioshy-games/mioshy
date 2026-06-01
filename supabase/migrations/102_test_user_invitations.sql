-- ============================================================
-- Migration 102 — test_user_invitations
-- ============================================================
-- Itzik, 2026-06-01: companion to migration 101.
--
-- 101 added `profiles.is_test_user` for users who ALREADY exist.
-- This migration lets the admin invite an email that has NOT signed
-- up yet:
--   • admin adds email X to the whitelist
--   • we store the email in `test_user_invitations` (since there's
--     no profile row to flip)
--   • a "you've been invited" email goes out
--   • when X signs up, the signup action checks this table and
--     auto-flips `is_test_user = true` on the new profile, then
--     removes the invitation row
--
-- Email is the primary key (case-insensitive via citext) so we
-- can't accidentally invite the same address twice. RLS denies
-- public access — only the service role reads/writes.
-- ============================================================

-- The citext extension MUST exist before the table definition below
-- uses the CITEXT type. CREATE EXTENSION is idempotent.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.test_user_invitations (
  email           CITEXT PRIMARY KEY,
  note            TEXT,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Stamped when the email signed up and the signupAction trigger
  -- flipped the new profile's `is_test_user` flag. NULL while pending.
  claimed_at      TIMESTAMPTZ,
  claimed_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.test_user_invitations IS
  'Pending test-user grants for emails that have not signed up yet. '
  'signupAction reads this on every new account creation; when the '
  'email matches, the new profile is auto-flagged is_test_user=true '
  'and the invitation row is stamped claimed_at + claimed_user_id.';

-- Filter on (claimed_at IS NULL) is the hot read path (admin UI
-- pending list, signup-time lookup). Partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS test_user_invitations_pending_idx
  ON public.test_user_invitations (email)
  WHERE claimed_at IS NULL;

-- Lock down access. The admin UI calls server actions that use the
-- service-role client, so no RLS policy is required for either read
-- or write — but we explicitly DENY direct end-user access via
-- ENABLE without a policy.
ALTER TABLE public.test_user_invitations ENABLE ROW LEVEL SECURITY;
