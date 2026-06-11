-- ============================================================
-- Migration 108 — admin defense-in-depth
-- ============================================================
-- Itzik 2026-06-02 security audit:
--
-- Today, "is this user an admin?" relies on ONE check per route:
--   app code reads profiles.role = 'admin' via requireAdmin().
-- If a future server action / API route forgets that gate, a regular
-- authenticated user could call it and mutate sensitive tables —
-- because most of those tables don't have admin-restrictive RLS, and
-- the app uses the service-role client (bypasses RLS) for them.
--
-- This migration closes that gap at the DB layer so that even if app
-- code regresses, a non-admin session cannot write the data:
--
--   1. Lock profiles.role to a known enum-like set via CHECK.
--      A bad insert/update with role='Admin' (capital A), 'sysadmin',
--      or anything outside the set is rejected.
--
--   2. Enable RLS + admin-only policy on sensitive admin-managed
--      tables. The service-role client (used by /api routes that
--      already gate behind requireAdmin) bypasses RLS by design — so
--      this doesn't break the app. What it DOES block: any session
--      client (a normal authenticated user via @supabase/ssr) trying
--      to read/write the row.
--
--   3. Revoke anon's grants on profiles. Defense for the case where
--      an unauthenticated request somehow reaches PostgREST.
--
--   4. Add role_change_log + trigger — forensics if a role ever
--      changes, including who changed it.
--
-- Nothing here breaks existing flows: the dashboard already uses the
-- admin (service-role) client for these tables, which bypasses RLS.
-- The whole point is to make sure NON-service-role calls fail.
-- ============================================================

BEGIN;

-- ── 1. CHECK constraint on profiles.role ─────────────────────
-- Lock to lowercase ('user' | 'expert' | 'admin'). Anything else
-- raises an error at insert/update time.
DO $$
BEGIN
  -- Drop any pre-existing constraint with the same name so the
  -- migration is re-runnable.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('user','expert','admin'));
END$$;

-- ── 2. Admin-only RLS on sensitive admin-managed tables ──────
-- These are tables that the dashboard mutates via the service-role
-- client. RLS only restricts session clients — service-role bypasses
-- it entirely, so dashboard flows remain unaffected.
DO $$
DECLARE
  v_table text;
  v_policy text;
  v_target_tables text[] := ARRAY[
    'journey_tasks',
    'user_notes',
    'sent_messages',
    'activity_logs',
    'engagement_schedules',
    'message_templates',
    'journey_assignments',
    'journey_match_rules',
    'journey_user_priorities'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_target_tables LOOP
    -- Skip tables that don't exist in this environment (defensive —
    -- the audit listed targets that may or may not all be present).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = v_table
    ) THEN
      RAISE NOTICE 'skipping % — table not found', v_table;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      v_table
    );
    EXECUTE format(
      'ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',
      v_table
    );

    v_policy := v_table || '_admin_all';
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_policy, v_table
    );
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
        FOR ALL TO authenticated
        USING (public.is_admin())
        WITH CHECK (public.is_admin())
    $f$, v_policy, v_table);

    RAISE NOTICE 'hardened % with admin-only RLS', v_table;
  END LOOP;
END$$;

-- ── 3. Revoke anon's access to profiles ──────────────────────
-- Belt-and-braces: profiles_select_own already restricts row reads
-- to the row owner, but explicit REVOKE makes the intent obvious in
-- the GRANTs table and removes any wiggle room.
REVOKE ALL ON public.profiles FROM anon;

-- ── 4. role_change_log + audit trigger ───────────────────────
CREATE TABLE IF NOT EXISTS public.role_change_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID        NOT NULL,
  old_role    TEXT,
  new_role    TEXT,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only admins can read the audit log via session client; service-role
-- still has full access.
ALTER TABLE public.role_change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_change_log_admin_read ON public.role_change_log;
CREATE POLICY role_change_log_admin_read ON public.role_change_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.role_change_log (
      user_id, old_role, new_role, changed_by
    ) VALUES (
      NEW.id, OLD.role, NEW.role, auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_audit ON public.profiles;
CREATE TRIGGER profiles_role_audit
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_change();

-- ── 5. Diagnostic — confirm the constraint + log table landed ──
DO $$
DECLARE
  v_constraint_ok BOOLEAN;
  v_log_table_ok  BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) INTO v_constraint_ok;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'role_change_log'
  ) INTO v_log_table_ok;

  IF NOT v_constraint_ok OR NOT v_log_table_ok THEN
    RAISE EXCEPTION 'hardening verify failed (constraint=%, log=%)',
      v_constraint_ok, v_log_table_ok;
  END IF;
  RAISE NOTICE 'admin hardening verified ✓';
END$$;

COMMIT;
