-- ───────────────────────────────────────────────────────────────────────────
-- 132_analytics_dashboard_views.sql
--
-- Phase 2 of the behavior-analytics system (admin-analytics-spec §5.6, §9).
-- READ-ONLY views over analytics_events + auth_login_events + the existing
-- journey tables. No data is created, changed, or deleted. Per §10.2 we stay on
-- views (not dedicated aggregate tables) until real volume forces otherwise.
--
-- Privacy (approach A, §10.1): metadata only — these views expose ids, counts,
-- timestamps and dwell milliseconds, never content. They read from RLS-locked
-- tables, so each view is explicitly REVOKEd from anon/authenticated and
-- GRANTed to service_role only (the admin dashboard reads via the service-role
-- client, exactly like analytics_events). Times bucket on Asia/Jerusalem where
-- a day boundary matters, matching analytics_daily_summary.
--
-- Threshold constants (calibratable later, §10.4):
--   • chapter abandoned  = item_opened with no completion after 7 days
--   • checkout abandoned = checkout_started with no subscription_activated in
--                          the same session_id
--   • game abandoned     = a SNAKES play session (game_start, game_type='snakes')
--                          with no game_completed in the same session. Snakes is
--                          the only game with a real end state. Wheel & adults
--                          are open-ended (never emit a completion, §6), so
--                          counting them here would force a misleading ~100%
--                          abandonment — they are EXCLUDED; their signal is
--                          dwell engagement in v_service_dwell, not abandonment.
--   • activity level     = active ≤7d · cooling 8–30d · churned >30d since last
--                          activity (login or any analytics event)
-- ───────────────────────────────────────────────────────────────────────────


-- ── v_user_last_login ───────────────────────────────────────────────────────
-- Reads: auth_login_events.
-- Returns: one row per user — when they last logged in, how many logins on
-- record, and the most recent country seen. Answers "when did this user last
-- come in" without the single-row overwrite problem of user_sessions.
CREATE OR REPLACE VIEW public.v_user_last_login AS
SELECT
  user_id,
  max(created_at)                                                            AS last_login_at,
  min(created_at)                                                            AS first_login_at,
  count(*)                                                                   AS login_count,
  (array_agg(country ORDER BY created_at DESC)
     FILTER (WHERE country IS NOT NULL))[1]                                  AS last_country
FROM public.auth_login_events
GROUP BY user_id;


-- ── v_user_activity_level ───────────────────────────────────────────────────
-- Reads: auth_login_events + analytics_events.
-- Returns: one row per user with their last activity (latest of any login or
-- any analytics event) and a bucket: active / cooling / churned.
CREATE OR REPLACE VIEW public.v_user_activity_level AS
WITH last_activity AS (
  SELECT user_id, max(ts) AS last_activity_at
  FROM (
    SELECT user_id, created_at AS ts FROM public.auth_login_events
    UNION ALL
    SELECT user_id, created_at AS ts FROM public.analytics_events WHERE user_id IS NOT NULL
  ) u
  GROUP BY user_id
)
SELECT
  user_id,
  last_activity_at,
  CASE
    WHEN last_activity_at >= now() - interval '7 days'  THEN 'active'
    WHEN last_activity_at >= now() - interval '30 days' THEN 'cooling'
    ELSE 'churned'
  END                                                                        AS activity_level
FROM last_activity;


-- ── v_chapter_funnel ────────────────────────────────────────────────────────
-- Reads: journey_user_activity (verb='item_opened') + journey_scheduled_items
--        + journey_item_completions.
-- Returns: per journey chapter (item_id) — how many scheduled instances were
-- opened, completed, and abandoned (opened, never completed, and the open is
-- older than the 7-day threshold). Funnel is scoped to opened items.
CREATE OR REPLACE VIEW public.v_chapter_funnel AS
WITH opened AS (
  SELECT scheduled_item_id, min(created_at) AS opened_at
  FROM public.journey_user_activity
  WHERE verb = 'item_opened' AND scheduled_item_id IS NOT NULL
  GROUP BY scheduled_item_id
)
SELECT
  si.item_id,
  count(DISTINCT o.scheduled_item_id)                                        AS opened_count,
  count(DISTINCT c.scheduled_item_id)                                        AS completed_count,
  count(DISTINCT o.scheduled_item_id) FILTER (
    WHERE c.scheduled_item_id IS NULL
      AND o.opened_at < now() - interval '7 days'
  )                                                                          AS abandoned_count
FROM opened o
JOIN public.journey_scheduled_items si ON si.id = o.scheduled_item_id
LEFT JOIN public.journey_item_completions c ON c.scheduled_item_id = o.scheduled_item_id
GROUP BY si.item_id;


-- ── v_service_dwell ─────────────────────────────────────────────────────────
-- Reads: analytics_events (event='dwell'); properties = { pillar, ms, item_id? }.
-- Returns: per user per pillar — number of dwell heartbeats and total active
-- milliseconds (the hook sends per-heartbeat DELTAS, so SUM = real dwell time).
-- user_id NULL = anonymous (tracked by device per §10.3). Average dwell per
-- pillar across users = avg(total_ms) grouped by pillar on top of this view.
CREATE OR REPLACE VIEW public.v_service_dwell AS
SELECT
  user_id,
  (properties->>'pillar')                                                    AS pillar,
  count(*)                                                                   AS dwell_events,
  sum((properties->>'ms')::numeric)                                          AS total_ms,
  round(avg((properties->>'ms')::numeric))                                   AS avg_ms_per_heartbeat
FROM public.analytics_events
WHERE event = 'dwell'
  AND properties ? 'ms'
  AND (properties->>'ms') ~ '^[0-9]+(\.[0-9]+)?$'
GROUP BY user_id, (properties->>'pillar');


-- ── v_abandonment ───────────────────────────────────────────────────────────
-- Reads: journey_user_activity + journey_item_completions (chapter), and
--        analytics_events (checkout sessions + snakes play sessions).
-- Returns: aggregate abandonment per context with started / abandoned / pct,
-- using the §10.4 thresholds. `started` counts everything entered (including
-- not-yet-eligible recent opens), so the pct is conservative. Only games with a
-- real end state are measured for abandonment (snakes); open-ended wheel/adult
-- play is engagement, not abandonment — see v_service_dwell.
CREATE OR REPLACE VIEW public.v_abandonment AS
WITH chapter AS (
  SELECT
    'chapter'::text AS context,
    count(*)        AS started,
    count(*) FILTER (
      WHERE c.scheduled_item_id IS NULL
        AND o.opened_at < now() - interval '7 days'
    )               AS abandoned
  FROM (
    SELECT scheduled_item_id, min(created_at) AS opened_at
    FROM public.journey_user_activity
    WHERE verb = 'item_opened' AND scheduled_item_id IS NOT NULL
    GROUP BY scheduled_item_id
  ) o
  LEFT JOIN public.journey_item_completions c ON c.scheduled_item_id = o.scheduled_item_id
),
checkout AS (
  SELECT
    'checkout'::text                       AS context,
    count(*)                               AS started,
    count(*) FILTER (WHERE NOT activated)  AS abandoned
  FROM (
    SELECT session_id, bool_or(event = 'subscription_activated') AS activated
    FROM public.analytics_events
    WHERE event IN ('checkout_started', 'subscription_activated')
      AND session_id IS NOT NULL
    GROUP BY session_id
    HAVING bool_or(event = 'checkout_started')
  ) s
),
game AS (
  -- Snakes only: the one game that emits game_completed. A snakes session is a
  -- session containing a game_start with game_type='snakes'; it is abandoned if
  -- that session has no game_completed. Wheel/adults are intentionally excluded
  -- (open-ended → no completion → would always read as abandoned).
  SELECT
    'game_snakes'::text                    AS context,
    count(*)                               AS started,
    count(*) FILTER (WHERE NOT completed)  AS abandoned
  FROM (
    SELECT session_id, bool_or(event = 'game_completed') AS completed
    FROM public.analytics_events
    WHERE session_id IS NOT NULL
      AND (
        (event = 'game_start' AND properties->>'game_type' = 'snakes')
        OR event = 'game_completed'
      )
    GROUP BY session_id
    HAVING bool_or(event = 'game_start' AND properties->>'game_type' = 'snakes')
  ) s
)
SELECT context, started, abandoned,
       round(100.0 * abandoned / nullif(started, 0), 1) AS abandonment_pct
FROM chapter
UNION ALL
SELECT context, started, abandoned,
       round(100.0 * abandoned / nullif(started, 0), 1)
FROM checkout
UNION ALL
SELECT context, started, abandoned,
       round(100.0 * abandoned / nullif(started, 0), 1)
FROM game;


-- ── Access: admin-only, mirrors the analytics_events service-role pattern ────
-- The admin dashboard queries these through the service-role client. Anon /
-- authenticated (PostgREST API roles) must never read them.
REVOKE ALL ON public.v_user_last_login,
              public.v_user_activity_level,
              public.v_chapter_funnel,
              public.v_service_dwell,
              public.v_abandonment
  FROM anon, authenticated;

GRANT SELECT ON public.v_user_last_login,
                public.v_user_activity_level,
                public.v_chapter_funnel,
                public.v_service_dwell,
                public.v_abandonment
  TO service_role;
