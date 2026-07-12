-- ───────────────────────────────────────────────────────────────────────────
-- 185_consultation_requests.sql
--
-- Stage 2 — "schedule a call with a rep" (Calendly). When an invitee finishes
-- booking on the results page, the client fires Meta Schedule (Pixel + CAPI,
-- shared eventId) and the server records a lead here. Read by the admin
-- "בקשות שיחה" screen.
--
-- Metadata only (no message body). Additive, idempotent. Service-role only
-- (RLS on, no anon/authenticated policies — the app reads/writes with the
-- service-role client behind requireAdmin / a server action).
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.consultation_requests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email                text,
  source               text,
  calendly_invitee_uri text,
  status               text NOT NULL DEFAULT 'scheduled',
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consultation_requests_created_idx
  ON public.consultation_requests (created_at DESC);

ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;
-- No policies → only the service_role (which bypasses RLS) can read/write.

-- Refresh PostgREST schema cache so the table is queryable immediately.
SELECT pg_notify('pgrst', 'reload schema');
