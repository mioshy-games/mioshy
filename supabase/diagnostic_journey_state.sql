-- ============================================================
-- diagnostic_journey_state.sql
-- ============================================================
-- Run this in Supabase SQL Editor to check whether the Journey
-- content-delivery system is wired up for a freshly-purchased
-- subscription.
--
-- USAGE: paste the whole file into SQL Editor and run. Each
-- numbered query prints a small result set you can read top-to-
-- bottom.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Are there any Journey programs configured at all?
--    Each `journey_programs` row is a distinct catalogue. We
--    expect ONE active row with product_slug='journey' for the
--    Cardcom Journey product to auto-assign on purchase.
-- ────────────────────────────────────────────────────────────
SELECT
  id,
  slug,
  name_he,
  name_en,
  product_slug,
  is_active,
  default_anchor,
  created_at
FROM public.journey_programs
ORDER BY created_at DESC;

-- ────────────────────────────────────────────────────────────
-- 2. How many categories does each program contain?
--    A program with 0 categories will produce 0 visible content
--    even after auto-assign — the user lands on an empty desk.
-- ────────────────────────────────────────────────────────────
SELECT
  p.slug                                                 AS program_slug,
  p.name_he                                              AS program_name_he,
  p.product_slug,
  COUNT(c.id)                                            AS category_count,
  STRING_AGG(c.assessment_priority_key, ', ' ORDER BY c.assessment_priority_key)
                                                         AS priority_keys_covered
FROM public.journey_programs p
LEFT JOIN public.journey_categories c ON c.program_id = p.id
GROUP BY p.id, p.slug, p.name_he, p.product_slug
ORDER BY p.slug;

-- ────────────────────────────────────────────────────────────
-- 2b. Standalone categories (program_id IS NULL).
--     Migration 055 seeded the five priority categories as
--     standalone. They count for the assessment ranking but
--     auto-assign on purchase only expands categories that are
--     ATTACHED to a program. Use this to confirm before running
--     migration 065 (which promotes them to the new program).
-- ────────────────────────────────────────────────────────────
SELECT
  id, slug, name_he, assessment_priority_key, is_active
FROM public.journey_categories
WHERE program_id IS NULL
ORDER BY assessment_priority_key;

-- ────────────────────────────────────────────────────────────
-- 3. How many ITEMS does each category have?
--    Items are the actual content units the user sees. A category
--    with 0 items shows up as "Coming soon" in the rail.
-- ────────────────────────────────────────────────────────────
SELECT
  COALESCE(p.slug, '(standalone)')           AS program_slug,
  c.name_he                                  AS category_name_he,
  c.assessment_priority_key                  AS priority_key,
  COUNT(i.id)                                AS item_count,
  MIN(i.default_offset_days)                 AS earliest_offset_days,
  MAX(i.default_offset_days)                 AS latest_offset_days
FROM public.journey_categories c
LEFT JOIN public.journey_programs p ON p.id = c.program_id
LEFT JOIN public.journey_items     i ON i.category_id = c.id AND i.is_active
GROUP BY p.slug, c.name_he, c.assessment_priority_key
ORDER BY p.slug NULLS LAST, c.assessment_priority_key;

-- ────────────────────────────────────────────────────────────
-- 4. For a SPECIFIC user (e.g. Itzik / bdika@test.com), what
--    has actually been assigned + scheduled?
--    NOTE: change the email below if you want to inspect a
--    different test user.
-- ────────────────────────────────────────────────────────────
WITH target AS (
  SELECT id FROM auth.users WHERE email = 'bdika@test.com' LIMIT 1
),
target_couples AS (
  -- Pull couple_id via couple_members if that table exists; if it
  -- doesn't (project may use a different membership table), the
  -- subquery degrades to no rows and the user-side branch covers it.
  SELECT cm.couple_id
  FROM public.couple_members cm
  WHERE cm.user_id IN (SELECT id FROM target)
)
SELECT
  a.id                  AS assignment_id,
  a.origin,
  a.origin_ref,
  a.is_active,
  a.anchor_date,
  a.notes,
  COUNT(s.id)           AS scheduled_items,
  SUM(CASE WHEN s.unlock_at <= now() THEN 1 ELSE 0 END)
                        AS unlocked_now,
  MIN(s.unlock_at)      AS earliest_unlock,
  MAX(s.unlock_at)      AS latest_unlock
FROM public.journey_assignments a
LEFT JOIN public.journey_scheduled_items s ON s.assignment_id = a.id
WHERE a.user_id   IN (SELECT id FROM target)
   OR a.couple_id IN (SELECT couple_id FROM target_couples)
GROUP BY a.id
ORDER BY a.anchor_date DESC;

-- ────────────────────────────────────────────────────────────
-- 5. Did the assessment responses get saved for that user?
-- ────────────────────────────────────────────────────────────
WITH target AS (
  SELECT id FROM auth.users WHERE email = 'bdika@test.com' LIMIT 1
)
SELECT
  j.id                  AS journey_id,
  j.last_activity_at,
  j.completed_at,
  COUNT(r.id)           AS response_count,
  SUM(CASE WHEN r.answer ->> 'kind' = 'ranking' THEN 1 ELSE 0 END)
                        AS ranking_responses
FROM public.journeys j
LEFT JOIN public.journey_responses r ON r.journey_id = j.id
WHERE j.user_id IN (SELECT id FROM target)
GROUP BY j.id
ORDER BY j.last_activity_at DESC;

-- ────────────────────────────────────────────────────────────
-- WHAT TO DO BASED ON THE ABOVE:
--
-- Q1 returns ZERO rows                → no programs exist. Run
--                                      migration 065 to create
--                                      the Journey program.
--
-- Q1 returns rows but no row has product_slug='journey' AND
-- is_active=true                     → that's the silent failure.
--                                      The Cardcom indicator
--                                      webhook hits "no program
--                                      configured" and creates
--                                      zero assignments.
--                                      Fix: run migration 065 (it
--                                      sets product_slug='journey'
--                                      idempotently).
--
-- Q2b shows 5 standalone categories
--   AND Q2 shows 0 categories on the journey program
--                                    → migration 065 hasn't run
--                                      yet (it promotes the
--                                      standalone rows to the
--                                      program). Run it.
--
-- Q3 shows item_count=0 in any row   → no content has been
--                                      authored. Migration 065
--                                      seeds 5 items per category
--                                      (25 items total).
--
-- Q4 shows 0 assignments for the user → auto-assign didn't run, or
--                                      ran on a no-program-configured
--                                      branch. After fixing Q1+Q2,
--                                      re-process the latest checkout
--                                      via the cardcom indicator
--                                      endpoint or fire
--                                      assignJourneyOnPurchase from
--                                      a one-off admin task.
--
-- Q4 shows 0 unlocked_now            → items have non-zero offset
--                                      and the cadence engine
--                                      hasn't ticked yet. The new
--                                      day-1 override (B3.1) fixes
--                                      this for FUTURE purchases.
--                                      For existing rows, manually
--                                      UPDATE journey_scheduled_items
--                                      SET unlock_at = now()
--                                      WHERE id = <first item's id>.
-- ────────────────────────────────────────────────────────────
