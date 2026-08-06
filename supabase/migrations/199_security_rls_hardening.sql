-- ─────────────────────────────────────────────────────────────────────────────
-- 199  Security hardening — RLS scope fixes
--      Audit 2026-08-05, findings CRITICAL #1 and #2
-- ─────────────────────────────────────────────────────────────────────────────
-- Run in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/kphfmbqqafrvuzmiotsz/sql/new
--
-- Read this before running:
--   • The five app call sites that read admin_users_overview through a
--     cookie-based `authenticated` client were switched to the service-role
--     client in the same commit as this migration. Deploy the code and run
--     this migration together — running the REVOKE against the OLD code
--     breaks the admin users list, the user detail page and admin message send.
--   • `security_invoker` is deliberately NOT set on admin_users_overview.
--     That view reads auth.users; under invoker semantics the reader would
--     need SELECT on auth.users, which we could not verify against production.
--     Once the view is revoked from anon/authenticated and granted only to
--     service_role, security_invoker buys nothing — service_role bypasses RLS
--     either way. Recorded in FOLLOWUPS.md.


-- ── C1: user_sessions ────────────────────────────────────────────────────────
-- 020 created this policy with no TO clause. In Postgres a policy without TO
-- applies to PUBLIC — which includes `anon`, the key shipped in the browser
-- bundle. Combined with Supabase's default table-level GRANT (never revoked on
-- this table), anyone could read every user's session_token, delete sessions,
-- and insert forged ones.
--
-- Safe to revoke: user_sessions is touched ONLY by lib/auth/session-enforcement,
-- which uses createAdminSupabaseClient() (service role). Verified 2026-08-06 —
-- no other file in the repo references the table.
DROP POLICY IF EXISTS "user_sessions_service_all" ON public.user_sessions;

CREATE POLICY "user_sessions_service_all"
  ON public.user_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.user_sessions FROM anon, authenticated;
GRANT SELECT ON public.user_sessions TO authenticated;  -- keeps user_sessions_select_own working

ALTER TABLE public.user_sessions FORCE ROW LEVEL SECURITY;


-- ── C2: admin_users_overview ─────────────────────────────────────────────────
-- 026:367 granted this view to `authenticated`. It joins auth.users with
-- journeys, subscriptions and journey_analysis and is not security_invoker, so
-- it runs as its owner and bypasses RLS on every underlying table. Any
-- logged-in user could read every user's email, plan, and relationship
-- analysis (friendship_score, passion_risk, four_horsemen_flag …).
REVOKE ALL ON public.admin_users_overview FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.admin_users_overview TO service_role;


-- ── C2b: analytics_daily_summary ─────────────────────────────────────────────
-- 038:43 created this view with no REVOKE, over an RLS-protected table whose
-- own policy is service-role-only — so the view was the way around it.
-- No application code reads this view (verified 2026-08-06), so tightening it
-- to invoker semantics as well carries no risk here.
REVOKE ALL ON public.analytics_daily_summary FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.analytics_daily_summary TO service_role;
ALTER VIEW public.analytics_daily_summary SET (security_invoker = on);
