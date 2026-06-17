-- ─────────────────────────────────────────────────────────────────────────────
-- 130_auth_login_events.sql
-- Login history (admin-analytics-spec §5.2).
--
-- `user_sessions` holds a single row per user that is overwritten on every
-- login, so it cannot answer "when exactly did this user log in, and at what
-- hours". This append-only log captures one row per successful login, written
-- server-side from createSession() (lib/auth/session-enforcement.ts) — the one
-- point every login/signup flow passes through.
--
-- Privacy: metadata only (approach A, spec §10.1). No PII beyond user_id +
-- device_id + coarse device_info/country.
-- Retention: keep 12 months, then aggregate + purge (spec §10.6, Phase 6).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_login_events (
  id           uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    text,                                 -- mioshy_device_id cookie
  device_info  jsonb        NOT NULL DEFAULT '{}',   -- { ua, ip } from session
  country      text,                                 -- x-vercel-ip-country (optional)
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- Primary access pattern: a user's login history, most-recent first.
CREATE INDEX IF NOT EXISTS auth_login_events_user_time_idx ON auth_login_events(user_id, created_at DESC);
-- Time-range scans for "peak hours" aggregates + retention purge.
CREATE INDEX IF NOT EXISTS auth_login_events_time_idx      ON auth_login_events(created_at DESC);

-- RLS: writes happen server-side via the service-role client (which bypasses
-- RLS), so no anon/authenticated insert policy is needed. Only service_role
-- may read — mirrors analytics_events (migration 038).
ALTER TABLE auth_login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_login_events_select_service"
  ON auth_login_events
  FOR SELECT
  TO service_role
  USING (true);

COMMENT ON TABLE auth_login_events IS
  'Append-only login history for admin behavior analytics. Metadata only (user_id/device_id/device_info/country). Retain 12 months then aggregate + purge.';
