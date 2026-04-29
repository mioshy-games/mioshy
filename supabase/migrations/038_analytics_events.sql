-- ─────────────────────────────────────────────────────────────────────────────
-- 038_analytics_events.sql
-- Product analytics event log (internal — no third-party trackers).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_events (
  id          uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event       text          NOT NULL,              -- e.g. 'game_start'
  session_id  text,                                -- per-tab session from sessionStorage
  device_id   text,                                -- mioshy_device_id cookie
  user_id     uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  locale      text,                                -- 'he' | 'en'
  properties  jsonb         NOT NULL DEFAULT '{}', -- event-specific payload
  created_at  timestamptz   NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX analytics_events_event_idx  ON analytics_events(event);
CREATE INDEX analytics_events_user_idx   ON analytics_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX analytics_events_device_idx ON analytics_events(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX analytics_events_time_idx   ON analytics_events(created_at DESC);
CREATE INDEX analytics_events_event_time ON analytics_events(event, created_at DESC);

-- RLS: only service-role can read; anyone (anon/authed) can insert via our API route
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically — these policies cover the API route
-- which runs as the anon/authenticated role via Supabase client
CREATE POLICY "analytics_insert_anon"
  ON analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only service_role (used in API routes with admin client) can read
CREATE POLICY "analytics_select_service"
  ON analytics_events
  FOR SELECT
  TO service_role
  USING (true);

-- ─── Convenience view for the admin dashboard ─────────────────────────────────
CREATE OR REPLACE VIEW analytics_daily_summary AS
SELECT
  date_trunc('day', created_at AT TIME ZONE 'Asia/Jerusalem') AS day,
  event,
  locale,
  COUNT(*)                                                     AS event_count,
  COUNT(DISTINCT device_id)                                    AS unique_devices,
  COUNT(DISTINCT user_id)                                      AS unique_users
FROM analytics_events
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 3 DESC;

COMMENT ON TABLE analytics_events IS
  'Product analytics — fire-and-forget events from client + server. No PII beyond user_id/device_id.';
