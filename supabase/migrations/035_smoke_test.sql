-- ============================================================
-- 035_smoke_test.sql — POST-MIGRATION smoke test for Journey Content.
--
-- Run this AFTER applying 035_journey_content_system.sql. It is
-- idempotent-ish (rolls back in a transaction) and exercises:
--   * program → category → item insert chain (admin writes work)
--   * XOR owner constraint rejects invalid rows
--   * Partial unique indexes behave correctly (standalone vs program)
--   * scheduled_items is a pure FK (no content copy)
--   * Item body edits propagate to existing scheduled rows via JOIN
--   * is_private policy blocks cross-partner leakage
--
-- USAGE: run in Supabase SQL editor with service role. No data is
-- committed — the whole test is wrapped in a ROLLBACK.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Pull two real user ids for realistic owner testing. Replace
-- the LIMIT 2 with specific ids if you want deterministic output.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_user_a uuid;
  v_user_b uuid;
BEGIN
  SELECT id INTO v_user_a FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_user_a IS NULL THEN
    RAISE EXCEPTION 'No users in auth.users — create at least one test user first.';
  END IF;
  PERFORM set_config('test.user_a', v_user_a::text, true);
  RAISE NOTICE 'Using user_a = %', v_user_a;
END $$;

-- ------------------------------------------------------------
-- 1. Program → category → item insert chain
-- ------------------------------------------------------------
INSERT INTO public.journey_programs (slug, name_he, name_en, default_anchor, is_active)
VALUES ('smoke-program', 'מסלול-בדיקה', 'Smoke Program', 'assignment', true);

INSERT INTO public.journey_categories (program_id, slug, name_he, is_active)
SELECT id, 'week-1', 'שבוע 1', true FROM public.journey_programs WHERE slug = 'smoke-program';

INSERT INTO public.journey_items (category_id, slug, title_he, body_he, default_offset_days, is_active)
SELECT id, 'item-1', 'כותרת-מקור', 'גוף-המקור', 0, true
FROM public.journey_categories WHERE slug = 'week-1' AND program_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. XOR owner constraint: both-set must FAIL, neither-set must FAIL
-- ------------------------------------------------------------
DO $$
DECLARE
  v_user uuid := current_setting('test.user_a')::uuid;
  v_couple uuid := (SELECT id FROM public.couples LIMIT 1);  -- may be NULL if none exist
  v_err text;
BEGIN
  -- Both set → should fail
  BEGIN
    INSERT INTO public.journey_assignments
      (user_id, couple_id, source_kind, source_id, anchor_date)
    VALUES (v_user, COALESCE(v_couple, v_user), 'program', gen_random_uuid(), now());
    RAISE EXCEPTION 'FAIL: both user_id and couple_id accepted (XOR broken)';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'OK: XOR rejects both-set (% )', 'expected';
  END;

  -- Neither set → should fail
  BEGIN
    INSERT INTO public.journey_assignments
      (source_kind, source_id, anchor_date)
    VALUES ('program', gen_random_uuid(), now());
    RAISE EXCEPTION 'FAIL: neither user_id nor couple_id accepted (XOR broken)';
  EXCEPTION WHEN check_violation OR not_null_violation THEN
    RAISE NOTICE 'OK: XOR rejects neither-set (expected)';
  END;
END $$;

-- ------------------------------------------------------------
-- 3. Partial unique indexes
-- ------------------------------------------------------------
-- 3a. Same slug in two DIFFERENT programs → OK
INSERT INTO public.journey_programs (slug, name_he, default_anchor, is_active)
VALUES ('smoke-program-2', 'מסלול-בדיקה-2', 'assignment', true);

INSERT INTO public.journey_categories (program_id, slug, name_he, is_active)
SELECT id, 'week-1', 'שבוע 1 / תוכנית אחרת', true
FROM public.journey_programs WHERE slug = 'smoke-program-2';

-- 3b. Same slug in SAME program → must fail
DO $$
BEGIN
  BEGIN
    INSERT INTO public.journey_categories (program_id, slug, name_he, is_active)
    SELECT id, 'week-1', 'duplicate', true
    FROM public.journey_programs WHERE slug = 'smoke-program';
    RAISE EXCEPTION 'FAIL: duplicate slug in same program accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: duplicate slug in same program rejected';
  END;
END $$;

-- 3c. Two STANDALONE categories with same slug → must fail
INSERT INTO public.journey_categories (program_id, slug, name_he, is_active)
VALUES (NULL, 'standalone-slug', 'עצמאי', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.journey_categories (program_id, slug, name_he, is_active)
    VALUES (NULL, 'standalone-slug', 'עצמאי שני', true);
    RAISE EXCEPTION 'FAIL: duplicate standalone slug accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK: duplicate standalone slug rejected';
  END;
END $$;

-- 3d. Standalone + program-owned with same slug → must SUCCEED
-- (they live in different partial indexes)
INSERT INTO public.journey_categories (program_id, slug, name_he, is_active)
SELECT id, 'standalone-slug', 'לא-באמת-עצמאי', true
FROM public.journey_programs WHERE slug = 'smoke-program';
-- If this blows up, the partial indexes are wrong.

-- ------------------------------------------------------------
-- 4. Materialize a scheduled_item; verify pure FK (no content copy)
-- ------------------------------------------------------------
INSERT INTO public.journey_assignments
  (user_id, source_kind, source_id, anchor_date, origin)
SELECT
  current_setting('test.user_a')::uuid,
  'program',
  p.id,
  date_trunc('day', now()),
  'admin_manual'
FROM public.journey_programs p WHERE p.slug = 'smoke-program';

INSERT INTO public.journey_scheduled_items (assignment_id, item_id, unlock_at)
SELECT
  a.id,
  i.id,
  a.anchor_date + (i.default_offset_days || ' days')::interval
FROM public.journey_assignments a
JOIN public.journey_programs p ON p.id = a.source_id AND p.slug = 'smoke-program'
JOIN public.journey_categories c ON c.program_id = p.id AND c.slug = 'week-1'
JOIN public.journey_items i ON i.category_id = c.id AND i.slug = 'item-1';

-- Column check: scheduled_items should NOT have content columns.
DO $$
DECLARE
  v_has_content_cols int;
BEGIN
  SELECT count(*) INTO v_has_content_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'journey_scheduled_items'
    AND column_name IN ('title_he','title_en','body_he','body_en','video_url','image_url');
  IF v_has_content_cols > 0 THEN
    RAISE EXCEPTION 'FAIL: journey_scheduled_items has content columns (should be FK-only)';
  ELSE
    RAISE NOTICE 'OK: journey_scheduled_items carries no content columns';
  END IF;
END $$;

-- Timeline fetch: JOIN through FK. Should show the original body.
SELECT s.id AS scheduled_id, s.unlock_at, i.title_he, i.body_he
FROM public.journey_scheduled_items s
JOIN public.journey_items i ON i.id = s.item_id
JOIN public.journey_assignments a ON a.id = s.assignment_id
WHERE a.user_id = current_setting('test.user_a')::uuid;

-- ------------------------------------------------------------
-- 5. Propagation: edit the item, re-fetch timeline → body updates
-- ------------------------------------------------------------
UPDATE public.journey_items
   SET body_he = 'גוף-לאחר-עדכון'
 WHERE slug = 'item-1'
   AND category_id IN (SELECT id FROM public.journey_categories WHERE slug = 'week-1' AND program_id IS NOT NULL);

DO $$
DECLARE
  v_body text;
BEGIN
  SELECT i.body_he INTO v_body
  FROM public.journey_scheduled_items s
  JOIN public.journey_items i ON i.id = s.item_id
  JOIN public.journey_assignments a ON a.id = s.assignment_id
  WHERE a.user_id = current_setting('test.user_a')::uuid
  LIMIT 1;

  IF v_body = 'גוף-לאחר-עדכון' THEN
    RAISE NOTICE 'OK: item body edit reflected in existing timeline (retroactive propagation works)';
  ELSE
    RAISE EXCEPTION 'FAIL: timeline body is stale — got %, expected גוף-לאחר-עדכון', v_body;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. is_private: cross-partner leakage guard (RLS only)
--
-- Service role BYPASSES RLS, so we simulate the RLS check manually
-- by calling a SELECT as if we were user_b. The real test of the
-- policy requires a session JWT — do that from the app with two
-- accounts. Here we at least verify the policy USING clause parses.
-- ------------------------------------------------------------
INSERT INTO public.journey_item_responses (scheduled_item_id, user_id, response_text, is_private)
SELECT s.id, current_setting('test.user_a')::uuid, 'private reflection', true
FROM public.journey_scheduled_items s
LIMIT 1;

SELECT polqual IS NOT NULL AS policy_has_using
FROM pg_policy
WHERE polname = 'journey_item_responses_read';

-- ------------------------------------------------------------
-- Roll back everything so we leave a clean DB.
-- ------------------------------------------------------------
ROLLBACK;
