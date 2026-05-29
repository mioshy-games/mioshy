-- ============================================================
-- diagnostic_itzik_journey.sql
--
-- Run inside Supabase SQL editor to inspect a single user's
-- post-payment journey state. Reveals which step of the
-- cadence pipeline is missing so we know whether the bug is:
--   • no subscription detected at the time of assessment
--     completion (Cardcom webhook race) →
--     `subscriptions` empty or `created_at` later than
--     `journeys.completed_at`
--   • priorities row never written →
--     `journey_user_priorities` row missing
--   • cadence assignment never created →
--     `journey_assignments` empty / no source_kind='cadence'
--   • day-1 materialize failed →
--     `journey_scheduled_items` empty for the cadence assignment
--
-- Replace the :user_email below with Itzik's actual login email.
-- Each section returns one or zero rows; an empty result is itself
-- a diagnostic.
-- ============================================================

-- Resolve user_id from the email so the rest of the queries read
-- naturally. Adjust the email here.
WITH me AS (
  SELECT id AS user_id
  FROM auth.users
  WHERE email = 'itzik@uxellent.com'
)

-- 1) Subscription state. The `plan` column carries the product
--    identifier ('weekly' for journey, 'monthly_adults', etc.) —
--    there is no separate `product` column.
SELECT
  'subscriptions' AS check,
  s.id,
  s.plan,
  s.status,
  s.created_at,
  s.current_period_end
FROM public.subscriptions s
JOIN me ON s.user_id = me.user_id
ORDER BY s.created_at DESC
LIMIT 5;

-- 2) Journey (assessment) state — pick the most recent journey row.
WITH me AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'itzik@uxellent.com'
)
SELECT
  'journeys' AS check,
  j.id AS journey_id,
  j.status,
  j.current_step,
  j.started_at,
  j.completed_at,
  j.last_activity_at
FROM public.journeys j
JOIN me ON j.user_id = me.user_id
ORDER BY j.last_activity_at DESC
LIMIT 5;

-- 3) Analysis row — written on assessment completion.
WITH me AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'itzik@uxellent.com'
)
SELECT
  'journey_analysis' AS check,
  a.id,
  a.friendship_score,
  a.conflict_health,
  a.passion_risk,
  a.top_gap,
  a.primary_love_language,
  a.computed_at
FROM public.journey_analysis a
JOIN me ON a.user_id = me.user_id
ORDER BY a.computed_at DESC
LIMIT 5;

-- 4) Priorities row — set after assessment OR by /my/journey self-heal.
WITH me AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'itzik@uxellent.com'
)
SELECT
  'journey_user_priorities' AS check,
  p.user_id,
  p.ranking,
  p.weights,
  p.source,
  p.updated_at
FROM public.journey_user_priorities p
JOIN me ON p.user_id = me.user_id;

-- 5) Couple membership — every paying user gets one via
--    ensure_couple_for_user on Cardcom webhook. Empty = the webhook
--    never fired. `members_count` is computed (no partner_count column
--    on couples — fixed 2026-05-28).
WITH me AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'itzik@uxellent.com'
)
SELECT
  'couple_members' AS check,
  cm.couple_id,
  cm.user_id,
  cm.role,
  c.started_journey_at,
  (
    SELECT count(*)
    FROM public.couple_members cm2
    WHERE cm2.couple_id = cm.couple_id
  ) AS members_count
FROM public.couple_members cm
JOIN public.couples c ON c.id = cm.couple_id
JOIN me ON cm.user_id = me.user_id;

-- 6) Cadence assignment — per-user, unique partial index. The row
--    that drives ongoing weekly deliveries.
WITH me AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'itzik@uxellent.com'
)
SELECT
  'journey_assignments (cadence)' AS check,
  ja.id AS assignment_id,
  ja.user_id,
  ja.couple_id,
  ja.source_kind,
  ja.is_active,
  ja.created_at
FROM public.journey_assignments ja
JOIN me ON ja.user_id = me.user_id
WHERE ja.source_kind = 'cadence'
ORDER BY ja.created_at DESC;

-- 7) Scheduled items for any cadence assignment of this user.
--    Empty here is the smoking gun: the user has subscription +
--    priorities + assignment but no items to display.
WITH me AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'itzik@uxellent.com'
),
mine AS (
  SELECT ja.id AS assignment_id
  FROM public.journey_assignments ja
  JOIN me ON ja.user_id = me.user_id
  WHERE ja.source_kind = 'cadence' AND ja.is_active
)
SELECT
  'journey_scheduled_items' AS check,
  si.id AS scheduled_id,
  si.assignment_id,
  si.item_id,
  si.unlock_at,
  si.sort_order,
  si.created_at
FROM public.journey_scheduled_items si
JOIN mine ON si.assignment_id = mine.assignment_id
ORDER BY si.unlock_at;

-- 8) Delivered-items dedup table. If a row exists here for the user
--    but no scheduled_item exists with matching item_id, the engine
--    thinks it already delivered something it actually didn't.
WITH me AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'itzik@uxellent.com'
)
SELECT
  'journey_user_delivered_items' AS check,
  d.user_id,
  d.item_id,
  d.delivered_at
FROM public.journey_user_delivered_items d
JOIN me ON d.user_id = me.user_id
ORDER BY d.delivered_at DESC
LIMIT 10;

-- 9) Pause state — defensive guard inside the cadence engine. If a
--    paused row exists with paused_until in the future AND no
--    resumed_at, NO new items will ever materialize. (Pauses don't
--    have a `status` column — "active" is computed as resumed_at IS
--    NULL AND paused_until > now.)
WITH me AS (
  SELECT id AS user_id FROM auth.users WHERE email = 'itzik@uxellent.com'
)
SELECT
  'subscription_pauses (active)' AS check,
  sp.id,
  sp.user_id,
  sp.subscription_id,
  sp.paused_at,
  sp.paused_until,
  sp.resumed_at,
  sp.reason
FROM public.subscription_pauses sp
JOIN me ON sp.user_id = me.user_id
WHERE sp.resumed_at IS NULL
  AND sp.paused_until > now()
ORDER BY sp.paused_at DESC;

-- 10) Active journey program. If is_active=false for all rows, the
--     resolver returns no_program and nothing ever materializes.
SELECT
  'journey_programs (active)' AS check,
  id,
  product_slug,
  is_active,
  created_at
FROM public.journey_programs
WHERE is_active = true
  AND product_slug = 'journey';
