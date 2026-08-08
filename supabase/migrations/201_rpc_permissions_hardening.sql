-- ─────────────────────────────────────────────────────────────────────────────
-- 201  RPC permission hardening + phase-1 follow-ups
--      Audit 2026-08-05 — H8 (a), (b), (d) · FOLLOWUPS F10, F11
-- ─────────────────────────────────────────────────────────────────────────────
-- Run in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/kphfmbqqafrvuzmiotsz/sql/new
--
-- H8(c) — expiry + attempt counter on join_couple_by_pair_code — is NOT here.
-- It changes the behaviour of a live pairing flow, so it needs a decision on
-- the expiry window, the attempt budget, and what happens to couples holding a
-- code today. Proposal is in SECURITY-PROGRESS.md under H8.
--
-- NOTE ON SERVICE ROLE: every guard below follows the pattern already
-- established by profiles_enforce_role_change (002:44) — when auth.uid() is
-- NULL there is no end user in the request, i.e. it is the service role or a
-- cron, and the operation is allowed. Without that arm these changes would
-- break the crons that legitimately call these functions.


-- ── H8(a): pact_record_honoured_week had no ownership check ──────────────────
-- 070:204 defined it SECURITY DEFINER, taking a pact id and a week number, and
-- granted EXECUTE to `authenticated`. Any signed-in user could mark ANY
-- couple's pact honoured for any week just by naming its id — writing to
-- another couple's commitment record. Called for real only by the
-- /api/journey/pact-honoured cron, which runs as service role.
CREATE OR REPLACE FUNCTION public.pact_record_honoured_week(
  p_pact_id UUID,
  p_week    INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id UUID;
  v_user_id   UUID;
BEGIN
  SELECT couple_id, user_id
    INTO v_couple_id, v_user_id
    FROM public.journey_couple_pacts
   WHERE id = p_pact_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pact not found';
  END IF;

  -- No end user in the request → service role / cron. Allow.
  IF auth.uid() IS NOT NULL THEN
    IF NOT (
      public.is_admin()
      -- A solo pact belongs to one user.
      OR (v_user_id IS NOT NULL AND v_user_id = auth.uid())
      -- A couple pact belongs to its members, and to that couple's expert.
      OR (v_couple_id IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM public.couple_members cm
              WHERE cm.couple_id = v_couple_id AND cm.user_id = auth.uid()
            )
            OR public.is_expert_for_couple(v_couple_id)
          ))
    ) THEN
      RAISE EXCEPTION 'not authorised for this pact';
    END IF;
  END IF;

  UPDATE public.journey_couple_pacts
  SET honoured_through_week = GREATEST(COALESCE(honoured_through_week, 0), p_week)
  WHERE id = p_pact_id;
END;
$$;


-- ── H8(b): ensure_couple_for_user was callable by any signed-in user ─────────
-- 042:125 granted EXECUTE to `authenticated`. It is SECURITY DEFINER and takes
-- an arbitrary p_user_id, so any signed-in user could create a couple (and a
-- pair code) on behalf of any other user. Every real caller — the Cardcom
-- indicator and the trial processor — uses the service-role client.
REVOKE EXECUTE ON FUNCTION public.ensure_couple_for_user(uuid) FROM authenticated;


-- ── H8(d): block non-admins from setting privileged profile columns ──────────
-- profiles_insert_own + profiles_enforce_role_change (002) stop a user from
-- granting themselves `role`, but three other columns carry privilege or
-- change behaviour and had no guard: is_default_coach (routes clients to you),
-- is_test_user (excludes the row from Brevo/billing side effects) and
-- expert_specialties (drives assignment). A user can UPDATE their own profile
-- row under profiles_update_own, so these were self-settable.
CREATE OR REPLACE FUNCTION public.profiles_enforce_admin_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default_coach   IS DISTINCT FROM OLD.is_default_coach
  OR NEW.is_test_user       IS DISTINCT FROM OLD.is_test_user
  OR NEW.expert_specialties IS DISTINCT FROM OLD.expert_specialties
  THEN
    -- No end user in the request → service role / trigger / cron. Allow.
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;
    IF public.is_admin() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot change privileged profile columns';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_admin_columns ON public.profiles;
CREATE TRIGGER profiles_enforce_admin_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_admin_columns();


-- ── F10: retire is_expert() ──────────────────────────────────────────────────
-- After migration 200 no policy references it. It stays in the schema looking
-- like a valid authorisation helper, which is exactly how CRITICAL #4 would be
-- reintroduced by the next person who writes a policy.
--
-- Deliberately NOT `CASCADE`: if any policy still depends on it, Postgres will
-- refuse this statement instead of silently dropping that policy. If it fails,
-- stop and run:
--   SELECT schemaname, tablename, policyname FROM pg_policies
--   WHERE qual::text LIKE '%is_expert()%' OR with_check::text LIKE '%is_expert()%';
DROP FUNCTION IF EXISTS public.is_expert();


-- ── F11: make low_profile_code unique ────────────────────────────────────────
-- 016:30 indexes it but does not enforce uniqueness, while the C3 fix now
-- resolves the checkout session by that column on every callback. Defence in
-- depth rather than an emergency (the ReturnValue fallback still resolves the
-- right session if a duplicate ever appeared), but the constraint makes the
-- assumption explicit.
--
-- LAST in this file on purpose: if duplicates exist this statement fails, and
-- everything above it has already applied. If it fails, run:
--   SELECT low_profile_code, count(*), array_agg(id ORDER BY created_at)
--   FROM checkout_sessions WHERE low_profile_code IS NOT NULL
--   GROUP BY low_profile_code HAVING count(*) > 1;
-- and bring me the result before cleaning anything up.
CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_low_profile_uniq
  ON public.checkout_sessions (low_profile_code)
  WHERE low_profile_code IS NOT NULL;
