-- ============================================================
-- diagnostic_itzik_journey_v2.sql
--
-- Single-query version of the journey diagnostic. Supabase SQL
-- Editor shows ONE result tab — only the last statement's
-- output of a multi-statement script renders. This rewrite
-- collapses all 10 checks into one query with UNION ALL so
-- everything lands in a single result set.
--
-- Each row has:
--   check  text   — which subsystem we looked at
--   count  int    — how many rows matched
--   data   jsonb  — the actual rows, aggregated
--
-- count=0 (data IS NULL) is itself a diagnostic — it means
-- "this subsystem has nothing for the user". The most common
-- "user is stuck" pattern is:
--   subscriptions count >= 1 (paid)
--   journeys count >= 1 with status='complete'
--   journey_user_priorities count = 1
--   journey_assignments count >= 1
--   journey_scheduled_items count = 0   ← the smoking gun
--
-- Replace the email in the `me` CTE below.
-- ============================================================

WITH me AS (
  SELECT id AS user_id
  FROM auth.users
  WHERE email = 'itzik@uxellent.com'
),
mine_assignments AS (
  SELECT ja.id AS assignment_id
  FROM public.journey_assignments ja
  JOIN me ON ja.user_id = me.user_id
  WHERE ja.source_kind = 'cadence' AND ja.is_active
)

SELECT '01_subscriptions' AS check, count(*)::int AS count,
       jsonb_agg(to_jsonb(s) - 'stripe_subscription_id') AS data
FROM public.subscriptions s JOIN me ON s.user_id = me.user_id

UNION ALL
SELECT '02_journeys', count(*)::int,
       jsonb_agg(jsonb_build_object(
         'id', j.id, 'status', j.status, 'current_step', j.current_step,
         'started_at', j.started_at, 'completed_at', j.completed_at,
         'last_activity_at', j.last_activity_at))
FROM public.journeys j JOIN me ON j.user_id = me.user_id

UNION ALL
SELECT '03_journey_analysis', count(*)::int,
       jsonb_agg(jsonb_build_object(
         'id', a.id,
         'friendship_score', a.friendship_score,
         'conflict_health', a.conflict_health,
         'passion_risk', a.passion_risk,
         'top_gap', a.top_gap,
         'computed_at', a.computed_at))
FROM public.journey_analysis a JOIN me ON a.user_id = me.user_id

UNION ALL
SELECT '04_user_priorities', count(*)::int,
       jsonb_agg(to_jsonb(p))
FROM public.journey_user_priorities p JOIN me ON p.user_id = me.user_id

UNION ALL
SELECT '05_couple_membership', count(*)::int,
       jsonb_agg(jsonb_build_object(
         'couple_id', cm.couple_id, 'role', cm.role,
         'started_journey_at', c.started_journey_at,
         'members', (SELECT count(*) FROM public.couple_members cm2 WHERE cm2.couple_id = cm.couple_id)))
FROM public.couple_members cm
JOIN public.couples c ON c.id = cm.couple_id
JOIN me ON cm.user_id = me.user_id

UNION ALL
SELECT '06_cadence_assignment', count(*)::int,
       jsonb_agg(jsonb_build_object(
         'assignment_id', ja.id, 'source_kind', ja.source_kind,
         'is_active', ja.is_active, 'created_at', ja.created_at,
         'user_id', ja.user_id, 'couple_id', ja.couple_id))
FROM public.journey_assignments ja JOIN me ON ja.user_id = me.user_id
WHERE ja.source_kind = 'cadence'

UNION ALL
SELECT '07_scheduled_items', count(*)::int,
       jsonb_agg(jsonb_build_object(
         'scheduled_id', si.id, 'item_id', si.item_id,
         'unlock_at', si.unlock_at, 'sort_order', si.sort_order))
FROM public.journey_scheduled_items si
JOIN mine_assignments ma ON si.assignment_id = ma.assignment_id

UNION ALL
SELECT '08_delivered_items', count(*)::int,
       jsonb_agg(jsonb_build_object(
         'item_id', d.item_id, 'source', d.source,
         'delivered_at', d.delivered_at))
FROM public.journey_user_delivered_items d JOIN me ON d.user_id = me.user_id

UNION ALL
SELECT '09_active_pauses', count(*)::int,
       jsonb_agg(jsonb_build_object(
         'paused_at', sp.paused_at, 'paused_until', sp.paused_until,
         'reason', sp.reason))
FROM public.subscription_pauses sp JOIN me ON sp.user_id = me.user_id
WHERE sp.resumed_at IS NULL AND sp.paused_until > now()

UNION ALL
SELECT '10_active_journey_program', count(*)::int,
       jsonb_agg(jsonb_build_object(
         'id', jp.id, 'product_slug', jp.product_slug,
         'is_active', jp.is_active))
FROM public.journey_programs jp
WHERE jp.is_active AND jp.product_slug = 'journey'

ORDER BY check;
