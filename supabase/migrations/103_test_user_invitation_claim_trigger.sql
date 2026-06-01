-- ============================================================
-- Migration 103 — auto-claim test_user_invitations via DB trigger
-- ============================================================
-- Itzik 2026-06-01: signupAction's app-side auto-claim missed at
-- least one signup (itzikbab@gmail.com, the second registration on
-- 2026-06-01 16:04 UTC). The miss happens whenever the signup
-- bypasses signupAction — OAuth, magic-link, Supabase Auth dashboard
-- create, or an old client build that doesn't yet run our updated
-- server action.
--
-- A DB-level trigger fixes that for good: it fires regardless of
-- which application route created the profile row, so the claim is
-- guaranteed to happen as long as the profile makes it into
-- public.profiles.
--
-- Behaviour:
--   • AFTER INSERT on public.profiles
--   • Resolve the new row's email via auth.users (the profile.id IS
--     the auth.user.id).
--   • Look up a pending row in test_user_invitations by email
--     (CITEXT — case-insensitive equality).
--   • If found:
--       – Set is_test_user = true on the new profile.
--       – Copy the admin's note + invited_by → marked_at + marked_by.
--       – Stamp claimed_at + claimed_user_id on the invitation.
--   • If not found: no-op. Trigger always returns NEW, never raises.
--
-- The function uses SECURITY DEFINER so it can read auth.users
-- (which is owned by the auth schema). The grant is narrow — only
-- the postgres role owns the function. Application code never calls
-- it directly; postgres invokes it via the trigger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_test_user_invitation_on_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email   citext;
  v_invite  RECORD;
BEGIN
  -- Resolve the new profile's email from auth.users. profile.id IS
  -- the auth.user.id (foreign key set up in migration 002), so a
  -- single point-lookup is all we need.
  SELECT u.email::citext INTO v_email
  FROM auth.users u
  WHERE u.id = NEW.id
  LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find a pending invitation for this email. The "first pending"
  -- semantics are unambiguous because email is the PRIMARY KEY of
  -- test_user_invitations — at most one row per address.
  SELECT * INTO v_invite
  FROM public.test_user_invitations
  WHERE email = v_email
    AND claimed_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Apply the grant. We update the NEW row directly in profiles
  -- (instead of relying on NEW.is_test_user assignment) so the
  -- audit columns settle to the invite's metadata.
  UPDATE public.profiles
  SET is_test_user        = TRUE,
      test_user_note      = v_invite.note,
      test_user_marked_at = now(),
      test_user_marked_by = v_invite.invited_by
  WHERE id = NEW.id;

  UPDATE public.test_user_invitations
  SET claimed_at      = now(),
      claimed_user_id = NEW.id
  WHERE email = v_email;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block the profile INSERT because of our auto-claim
    -- failing. Worst case: admin re-marks the user manually via
    -- /dashboard/test-users, same as today.
    RAISE WARNING '[claim_test_user_invitation_on_profile_insert] swallowed error for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop & recreate the trigger so re-running the migration is safe.
DROP TRIGGER IF EXISTS trg_profiles_claim_test_user_invitation
  ON public.profiles;

CREATE TRIGGER trg_profiles_claim_test_user_invitation
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.claim_test_user_invitation_on_profile_insert();

COMMENT ON FUNCTION public.claim_test_user_invitation_on_profile_insert IS
  'Auto-grants is_test_user when a new profile matches a pending '
  'invitation in test_user_invitations. Replaces the app-side '
  'auto-claim in signupAction so the grant is enforced regardless '
  'of which signup route the user took.';
