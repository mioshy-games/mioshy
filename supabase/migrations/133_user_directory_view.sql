-- ───────────────────────────────────────────────────────────────────────────
-- 133_user_directory_view.sql
--
-- Phase 4 of the behavior-analytics system (admin-analytics-spec §7.1, §4.2).
-- One READ-ONLY row per user for the admin customer list — search + filter +
-- sort + paginate happen in the DB on this view, so the list never N+1s or
-- loops per user. Builds on the Phase-2 views (v_user_last_login,
-- v_user_activity_level) plus profiles / completions / plays / subscriptions.
--
-- No data created/changed/deleted (§10.2 — stays on views). Metadata only
-- (§10.1): ids, name/email/phone (for search), counts, status — no content.
-- Service-role only (REVOKE anon/authenticated), like the other admin views;
-- the dashboard reads it via the service-role client behind requireAdmin.
--
-- Columns:
--   user_id, email, full_name, phone        — identity + search
--   last_login_at                           — v_user_last_login
--   activity_level                          — v_user_activity_level (active/cooling/churned)
--   completed_chapters                      — count from journey_item_completions
--   games_played                            — distinct games from user_game_plays
--   subscription_status, subscription_product, plan — latest active subscription
--
-- Performance: regular view (not materialized). Per §10.2, revisit as a
-- materialized view / table only if real volume forces it.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_user_directory AS
SELECT
  u.id                                          AS user_id,
  u.email,
  pr.full_name,
  coalesce(pr.phone, pr.mobile)                 AS phone,
  ll.last_login_at,
  al.activity_level,
  coalesce(cc.completed_chapters, 0)            AS completed_chapters,
  coalesce(gp.games_played, 0)                  AS games_played,
  sub.status                                    AS subscription_status,
  sub.product                                   AS subscription_product,
  sub.plan                                      AS plan
FROM auth.users u
LEFT JOIN public.profiles pr               ON pr.id = u.id
LEFT JOIN public.v_user_last_login ll      ON ll.user_id = u.id
LEFT JOIN public.v_user_activity_level al  ON al.user_id = u.id
LEFT JOIN (
  SELECT completed_by AS user_id, count(*) AS completed_chapters
  FROM public.journey_item_completions
  WHERE completed_by IS NOT NULL
  GROUP BY completed_by
) cc ON cc.user_id = u.id
LEFT JOIN (
  SELECT user_id, count(*) AS games_played   -- unique(user_id, game_slug) ⇒ distinct games
  FROM public.user_game_plays
  GROUP BY user_id
) gp ON gp.user_id = u.id
LEFT JOIN LATERAL (
  SELECT status, product, plan
  FROM public.subscriptions
  WHERE user_id = u.id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
) sub ON true;

-- Admin-only access (mirrors the Phase-2 views + analytics_events pattern).
REVOKE ALL ON public.v_user_directory FROM anon, authenticated;
GRANT SELECT ON public.v_user_directory TO service_role;
