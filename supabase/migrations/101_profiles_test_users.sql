-- ============================================================
-- Migration 101 — test users
-- ============================================================
-- Itzik, 2026-06-01: lets us whitelist internal/QA emails so the
-- checkout flow auto-grants them every product without going through
-- Cardcom. The signup → checkout → service flow is unchanged from
-- their POV — we simply detect the flag and skip the payment step.
--
-- The columns live on `profiles` (not a separate table) so:
--   • the existing JOIN through couple_members → profiles already
--     surfaces the flag for partner-sharing decisions,
--   • RLS reuses the profile policies we already trust,
--   • there's a single source of truth — no risk of a stale email
--     mirror diverging from the canonical user row.
--
-- Permissions:
--   • Admins can flip is_test_user (via service-role writes from the
--     /dashboard/test-users surface). RLS doesn't grant UPDATE for the
--     `is_test_user` column to anyone but the service role, which is
--     the existing rule for profile-elevated-fields.
--   • Users themselves can READ the flag (so a friendly "Test mode"
--     banner could surface in /my if we ever decide to), but cannot
--     write it.
--
-- Audit:
--   • `test_user_marked_at` + `test_user_marked_by` capture WHEN and
--     by WHOM the flag was last toggled — admins can pull the trail
--     directly with `SELECT id, email, is_test_user, test_user_note,
--     test_user_marked_at, test_user_marked_by FROM profiles WHERE
--     is_test_user`.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_user BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS test_user_note TEXT,
  ADD COLUMN IF NOT EXISTS test_user_marked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS test_user_marked_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Partial index — the table is large but flagged rows are a tiny
-- subset. Index only TRUE so the entitlements gate's check stays
-- cheap and we don't bloat the index for the 99% of normal rows.
CREATE INDEX IF NOT EXISTS profiles_is_test_user_idx
  ON public.profiles (id)
  WHERE is_test_user = TRUE;

COMMENT ON COLUMN public.profiles.is_test_user IS
  'When TRUE the entitlements gate auto-grants every product and the '
  'checkout flow skips Cardcom. Set via /dashboard/test-users admin UI.';
COMMENT ON COLUMN public.profiles.test_user_note IS
  'Free-text reason the admin marked this user (e.g. "QA — Itzik 2026-06-01").';
COMMENT ON COLUMN public.profiles.test_user_marked_at IS
  'When the flag was last flipped. NULL when the user has never been marked.';
COMMENT ON COLUMN public.profiles.test_user_marked_by IS
  'Admin profile id that flipped the flag — for audit trail.';
