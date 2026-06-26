-- ───────────────────────────────────────────────────────────────────────────
-- 145_analytics_events_pillar_index.sql
--
-- Assessment-funnel analytics (assessment-funnel-analytics-brief §1.1, §6).
-- Composite index for the funnel's behavioural reads, which filter
-- analytics_events by event + a JSONB `pillar` and scan recent rows
-- (referrers, exit targets, dwell pillar='assessment'). Without it those
-- queries degrade to a seq scan as analytics_events grows.
--
-- Additive + idempotent (IF NOT EXISTS). No data is created/changed/deleted.
-- Run manually (no auto-runner). On a large table prefer CONCURRENTLY:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS ...   (cannot run inside a txn)
-- ───────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS analytics_events_event_pillar_time
  ON public.analytics_events (event, (properties ->> 'pillar'), created_at DESC);
