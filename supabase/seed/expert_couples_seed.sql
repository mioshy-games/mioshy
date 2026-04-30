-- ===========================================================================
-- expert_couples_seed.sql — Test seed for the Mioshy Coaching pilot.
-- ===========================================================================
-- Creates a self-contained, realistic-but-fake test scenario:
--
--   1 admin       (admin@mioshy.test)
--   2 experts     (dr.cohen@mioshy.test, dr.bar.zilai@mioshy.test)
--   2 couples     (4 users total, paired)
--   2 individuals (no couple, no expert)
--
-- Plus a starter Journey program with 6 items, an assignment per couple,
-- and pre-marked completions per the spec:
--
--     Couple 1 → Expert 1 — 3 completed + 2 active scheduled items
--     Couple 2 → Expert 2 — 1 completed + 4 active scheduled items
--
-- Idempotent: re-running this script is safe. All passwords are
-- 'TestPass123!' (bcrypt-hashed via pgcrypto). Deterministic UUIDs make
-- the data easy to reference from manual tests; UUIDs use mnemonic hex
-- prefixes (`0a` admin · `0e` expert · `c1`/`c2` couples · `50` solo ·
-- `cc` couple records · `ee` expert-couple links · `aa` program ·
-- `bb` category · `cd` items · `fa` assignments · `fb`/`fc` scheduled).
--
-- USAGE
--   psql "$SUPABASE_DB_URL" -f supabase/seed/expert_couples_seed.sql
--   -- OR via Supabase SQL editor (paste the whole file).
--
-- TEAR-DOWN — to wipe just this seed without touching real data:
--   DELETE FROM auth.users WHERE email LIKE '%@mioshy.test';
--   -- The cascade does the rest; couple/journey rows go with it.
-- ===========================================================================

-- pgcrypto is normally already on, but make sure crypt() is available.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. auth.users — 9 fake accounts with deterministic ids
-- ---------------------------------------------------------------------------
-- All emails end in @mioshy.test (RFC 2606 reserved-style, never deliverable)
-- so they can't be confused with real users.
WITH new_users (id, email, full_name, role) AS (
  VALUES
    -- Admin
    ('0a0a0a0a-0000-0000-0000-000000000001'::uuid, 'admin@mioshy.test',         'Admin Mioshy',       'admin'),
    -- Experts
    ('0e0e0e0e-0000-0000-0000-000000000001'::uuid, 'dr.cohen@mioshy.test',      'Dr. Naama Cohen',    'expert'),
    ('0e0e0e0e-0000-0000-0000-000000000002'::uuid, 'dr.bar.zilai@mioshy.test',  'Dr. Eitan Bar-Zilai','expert'),
    -- Couple 1 partners
    ('c1c1c1c1-0000-0000-0000-000000000001'::uuid, 'noa.levi@mioshy.test',      'Noa Levi',           'user'),
    ('c1c1c1c1-0000-0000-0000-000000000002'::uuid, 'tom.levi@mioshy.test',      'Tom Levi',           'user'),
    -- Couple 2 partners
    ('c2c2c2c2-0000-0000-0000-000000000001'::uuid, 'shira.gross@mioshy.test',   'Shira Gross',        'user'),
    ('c2c2c2c2-0000-0000-0000-000000000002'::uuid, 'amir.gross@mioshy.test',    'Amir Gross',         'user'),
    -- Standalone users
    ('5050abab-0000-0000-0000-000000000001'::uuid, 'maya.shapira@mioshy.test',  'Maya Shapira',       'user'),
    ('5050abab-0000-0000-0000-000000000002'::uuid, 'yoav.dahan@mioshy.test',    'Yoav Dahan',         'user')
)
INSERT INTO auth.users (
  id, instance_id, aud, role,
  email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
SELECT
  nu.id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  nu.email,
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', nu.full_name, 'seed', true),
  now() - interval '30 days',
  now()
FROM new_users nu
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      updated_at = now();

-- auth.identities row — needed for password sign-in to work.
--
-- Two GoTrue contracts that bit us once already (see expert_couples_seed_repair.sql):
--   1. For provider = 'email', provider_id MUST be the lower-cased email,
--      not the user_id. GoTrue's sign-in lookup is
--      `WHERE provider = 'email' AND provider_id = lower($input_email)`.
--   2. identity_data MUST include email_verified=true (and phone_verified=false
--      is recommended) — otherwise GoTrue treats the identity as half-formed
--      and fails the sign-in with "Database error querying schema".
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  lower(u.email),
  jsonb_build_object(
    'sub',            u.id::text,
    'email',          u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email LIKE '%@mioshy.test'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );


-- ---------------------------------------------------------------------------
-- 2. profiles — full_name + role
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, role, full_name, created_at)
VALUES
  ('0a0a0a0a-0000-0000-0000-000000000001', 'admin',  'Admin Mioshy',        now()),
  ('0e0e0e0e-0000-0000-0000-000000000001', 'expert', 'Dr. Naama Cohen',     now()),
  ('0e0e0e0e-0000-0000-0000-000000000002', 'expert', 'Dr. Eitan Bar-Zilai', now()),
  ('c1c1c1c1-0000-0000-0000-000000000001', 'user',   'Noa Levi',            now()),
  ('c1c1c1c1-0000-0000-0000-000000000002', 'user',   'Tom Levi',            now()),
  ('c2c2c2c2-0000-0000-0000-000000000001', 'user',   'Shira Gross',         now()),
  ('c2c2c2c2-0000-0000-0000-000000000002', 'user',   'Amir Gross',          now()),
  ('5050abab-0000-0000-0000-000000000001', 'user',   'Maya Shapira',        now()),
  ('5050abab-0000-0000-0000-000000000002', 'user',   'Yoav Dahan',          now())
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      full_name = EXCLUDED.full_name;


-- ---------------------------------------------------------------------------
-- 3. couples + couple_members
-- ---------------------------------------------------------------------------
INSERT INTO public.couples (id, pair_code, created_by, display_name, is_active, created_at, updated_at)
VALUES
  ('cccc1111-0000-0000-0000-000000000001', 'SEEDA1',
    'c1c1c1c1-0000-0000-0000-000000000001', 'Noa & Tom',  true, now() - interval '20 days', now()),
  ('cccc2222-0000-0000-0000-000000000002', 'SEEDB2',
    'c2c2c2c2-0000-0000-0000-000000000001', 'Shira & Amir', true, now() - interval '15 days', now())
ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      is_active = EXCLUDED.is_active;

INSERT INTO public.couple_members (couple_id, user_id, role, joined_at)
VALUES
  ('cccc1111-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001', 'owner',   now() - interval '20 days'),
  ('cccc1111-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000002', 'partner', now() - interval '20 days'),
  ('cccc2222-0000-0000-0000-000000000002', 'c2c2c2c2-0000-0000-0000-000000000001', 'owner',   now() - interval '15 days'),
  ('cccc2222-0000-0000-0000-000000000002', 'c2c2c2c2-0000-0000-0000-000000000002', 'partner', now() - interval '15 days')
ON CONFLICT (couple_id, user_id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 4. expert_couples — Expert 1 → Couple 1, Expert 2 → Couple 2
-- ---------------------------------------------------------------------------
INSERT INTO public.expert_couples (
  id, expert_id, couple_id, is_active, notes, created_by, created_at
)
VALUES
  ('eecccc11-0000-0000-0000-000000000001',
   '0e0e0e0e-0000-0000-0000-000000000001',
   'cccc1111-0000-0000-0000-000000000001',
   true,
   'Seed: pilot pairing 1 — communication focus',
   '0a0a0a0a-0000-0000-0000-000000000001',
   now() - interval '12 days'),
  ('eecccc22-0000-0000-0000-000000000002',
   '0e0e0e0e-0000-0000-0000-000000000002',
   'cccc2222-0000-0000-0000-000000000002',
   true,
   'Seed: pilot pairing 2 — intimacy focus',
   '0a0a0a0a-0000-0000-0000-000000000001',
   now() - interval '10 days')
ON CONFLICT (expert_id, couple_id) DO UPDATE
  SET is_active = true,
      notes = EXCLUDED.notes;


-- ---------------------------------------------------------------------------
-- 5. Starter Journey content — 1 program / 1 category / 6 items
-- ---------------------------------------------------------------------------
INSERT INTO public.journey_programs (
  id, slug, name_he, name_en, description_he, description_en,
  default_anchor, is_active, sort_weight, created_by, created_at, updated_at
)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'seed-coaching-foundations',
  'יסודות הליווי הזוגי',
  'Coaching Foundations',
  'תוכנית בסיסית של 6 שלבים שנשתלת בליווי מיאושי לזוגות חדשים.',
  '6-step starter program seeded for the Mioshy Coaching pilot.',
  'assignment',
  true,
  1000,
  '0a0a0a0a-0000-0000-0000-000000000001',
  now() - interval '25 days',
  now()
)
ON CONFLICT (id) DO UPDATE
  SET is_active = true,
      name_he = EXCLUDED.name_he;

INSERT INTO public.journey_categories (
  id, program_id, slug, name_he, name_en, description_he,
  sort_order, is_active, created_at, updated_at
)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'connection-rebuild',
  'חיבור מחדש',
  'Reconnection',
  'שש משימות שמייצרות נקודות מפגש קטנות שבועיות.',
  1, true, now() - interval '25 days', now()
)
ON CONFLICT (id) DO UPDATE
  SET is_active = true;

-- 6 items, day offsets 0,2,5,9,14,21 from anchor.
INSERT INTO public.journey_items (
  id, category_id, slug, title_he, title_en, body_he,
  default_offset_days, sort_order, is_active, created_by, created_at, updated_at
)
VALUES
  ('cdcdcdcd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'seed-item-1',
   'שאלה אחת על העבר',          'One Question About the Past',
   'שאלו את בן/בת הזוג שאלה אחת על שנה משמעותית בעברו לפני שהכרתם.',
   0, 1, true, '0a0a0a0a-0000-0000-0000-000000000001', now() - interval '25 days', now()),
  ('cdcdcdcd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'seed-item-2',
   'דקה של תודה',                'A Minute of Gratitude',
   'דקה אחת לפני השינה — כל אחד אומר משהו אחד שהוא מעריך אצל השני היום.',
   2, 2, true, '0a0a0a0a-0000-0000-0000-000000000001', now() - interval '25 days', now()),
  ('cdcdcdcd-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'seed-item-3',
   'מסך כבוי',                   'Screens Off',
   'ערב אחד השבוע, שעתיים בלי טלפונים בכלל. צילמו עם המצלמה הרגילה אם תרצו.',
   5, 3, true, '0a0a0a0a-0000-0000-0000-000000000001', now() - interval '25 days', now()),
  ('cdcdcdcd-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000001', 'seed-item-4',
   'דקה של תכלית',               'Purpose Minute',
   'מה דבר אחד שהיית רוצה שהזוגיות שלכם תיתן לך השנה?',
   9, 4, true, '0a0a0a0a-0000-0000-0000-000000000001', now() - interval '25 days', now()),
  ('cdcdcdcd-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000001', 'seed-item-5',
   'הליכה ארוכה',                'Long Walk',
   'הליכה של 45 דקות ביחד בלי תכנון מראש של נושא.',
   14, 5, true, '0a0a0a0a-0000-0000-0000-000000000001', now() - interval '25 days', now()),
  ('cdcdcdcd-0000-0000-0000-000000000006', 'bbbbbbbb-0000-0000-0000-000000000001', 'seed-item-6',
   'סיכום שבועיים',              'Two-Week Recap',
   'מה היה רגע אחד שמדבר על הזוגיות בשבועיים האחרונים?',
   21, 6, true, '0a0a0a0a-0000-0000-0000-000000000001', now() - interval '25 days', now())
ON CONFLICT (category_id, slug) DO UPDATE
  SET title_he = EXCLUDED.title_he,
      is_active = true;


-- ---------------------------------------------------------------------------
-- 6. journey_assignments — one program assignment per couple
-- ---------------------------------------------------------------------------
INSERT INTO public.journey_assignments (
  id, user_id, couple_id, source_kind, source_id,
  anchor_kind, anchor_date, origin, assigned_by, notes, is_active, created_at, updated_at
)
VALUES
  ('fadefade-0000-0000-0000-000000000001',
   NULL, 'cccc1111-0000-0000-0000-000000000001',
   'program', 'aaaaaaaa-0000-0000-0000-000000000001',
   'assignment', now() - interval '12 days',
   'admin_manual',
   '0e0e0e0e-0000-0000-0000-000000000001',
   'Seed: prescribed by Dr. Cohen at intake.',
   true, now() - interval '12 days', now()),
  ('fadefade-0000-0000-0000-000000000002',
   NULL, 'cccc2222-0000-0000-0000-000000000002',
   'program', 'aaaaaaaa-0000-0000-0000-000000000001',
   'assignment', now() - interval '8 days',
   'admin_manual',
   '0e0e0e0e-0000-0000-0000-000000000002',
   'Seed: prescribed by Dr. Bar-Zilai at intake.',
   true, now() - interval '8 days', now())
ON CONFLICT (id) DO UPDATE
  SET is_active = true,
      anchor_date = EXCLUDED.anchor_date;


-- ---------------------------------------------------------------------------
-- 7. journey_scheduled_items — 5 items per assignment (items 1-5)
-- ---------------------------------------------------------------------------
INSERT INTO public.journey_scheduled_items (
  id, assignment_id, item_id, unlock_at, sort_order, has_unlock_override, created_at, updated_at
)
VALUES
  -- ─ Couple 1 (anchor: now - 12 days) ─────────────────────────────────────
  ('fbbbbbb1-0000-0000-0000-000000000001', 'fadefade-0000-0000-0000-000000000001', 'cdcdcdcd-0000-0000-0000-000000000001', now() - interval '12 days', 1, false, now(), now()),
  ('fbbbbbb1-0000-0000-0000-000000000002', 'fadefade-0000-0000-0000-000000000001', 'cdcdcdcd-0000-0000-0000-000000000002', now() - interval '10 days', 2, false, now(), now()),
  ('fbbbbbb1-0000-0000-0000-000000000003', 'fadefade-0000-0000-0000-000000000001', 'cdcdcdcd-0000-0000-0000-000000000003', now() - interval '7 days',  3, false, now(), now()),
  ('fbbbbbb1-0000-0000-0000-000000000004', 'fadefade-0000-0000-0000-000000000001', 'cdcdcdcd-0000-0000-0000-000000000004', now() - interval '3 days',  4, false, now(), now()),
  ('fbbbbbb1-0000-0000-0000-000000000005', 'fadefade-0000-0000-0000-000000000001', 'cdcdcdcd-0000-0000-0000-000000000005', now() + interval '2 days',  5, false, now(), now()),
  -- ─ Couple 2 (anchor: now - 8 days) ──────────────────────────────────────
  ('fccccccc-0000-0000-0000-000000000001', 'fadefade-0000-0000-0000-000000000002', 'cdcdcdcd-0000-0000-0000-000000000001', now() - interval '8 days',  1, false, now(), now()),
  ('fccccccc-0000-0000-0000-000000000002', 'fadefade-0000-0000-0000-000000000002', 'cdcdcdcd-0000-0000-0000-000000000002', now() - interval '6 days',  2, false, now(), now()),
  ('fccccccc-0000-0000-0000-000000000003', 'fadefade-0000-0000-0000-000000000002', 'cdcdcdcd-0000-0000-0000-000000000003', now() - interval '3 days',  3, false, now(), now()),
  ('fccccccc-0000-0000-0000-000000000004', 'fadefade-0000-0000-0000-000000000002', 'cdcdcdcd-0000-0000-0000-000000000004', now() + interval '1 days',  4, false, now(), now()),
  ('fccccccc-0000-0000-0000-000000000005', 'fadefade-0000-0000-0000-000000000002', 'cdcdcdcd-0000-0000-0000-000000000005', now() + interval '6 days',  5, false, now(), now())
ON CONFLICT (assignment_id, item_id) DO UPDATE
  SET unlock_at = EXCLUDED.unlock_at;


-- ---------------------------------------------------------------------------
-- 8. journey_item_completions — match the spec
-- ---------------------------------------------------------------------------
--   Couple 1: items 1-3 done (3 completed), 4-5 still active.
--   Couple 2: only item 1 done (1 completed), 2-5 still active.
INSERT INTO public.journey_item_completions (scheduled_item_id, completed_at, completed_by, created_at)
VALUES
  -- Couple 1 — partner Noa marks items 1 and 3, partner Tom marks item 2.
  ('fbbbbbb1-0000-0000-0000-000000000001', now() - interval '11 days', 'c1c1c1c1-0000-0000-0000-000000000001', now() - interval '11 days'),
  ('fbbbbbb1-0000-0000-0000-000000000002', now() - interval '9 days',  'c1c1c1c1-0000-0000-0000-000000000002', now() - interval '9 days'),
  ('fbbbbbb1-0000-0000-0000-000000000003', now() - interval '5 days',  'c1c1c1c1-0000-0000-0000-000000000001', now() - interval '5 days'),
  -- Couple 2 — only one completion so far.
  ('fccccccc-0000-0000-0000-000000000001', now() - interval '6 days',  'c2c2c2c2-0000-0000-0000-000000000001', now() - interval '6 days')
ON CONFLICT (scheduled_item_id) DO UPDATE
  SET completed_at = EXCLUDED.completed_at,
      completed_by = EXCLUDED.completed_by;


-- ---------------------------------------------------------------------------
-- 9. Visual sanity check
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_users   int;
  v_couples int;
  v_links   int;
  v_assigns int;
  v_sched   int;
  v_done    int;
BEGIN
  SELECT count(*) INTO v_users   FROM auth.users WHERE email LIKE '%@mioshy.test';
  SELECT count(*) INTO v_couples FROM public.couples WHERE pair_code IN ('SEEDA1','SEEDB2');
  SELECT count(*) INTO v_links   FROM public.expert_couples
    WHERE id IN ('eecccc11-0000-0000-0000-000000000001'::uuid,
                 'eecccc22-0000-0000-0000-000000000002'::uuid);
  SELECT count(*) INTO v_assigns FROM public.journey_assignments
    WHERE id IN ('fadefade-0000-0000-0000-000000000001'::uuid,
                 'fadefade-0000-0000-0000-000000000002'::uuid);
  SELECT count(*) INTO v_sched   FROM public.journey_scheduled_items
    WHERE assignment_id IN ('fadefade-0000-0000-0000-000000000001'::uuid,
                             'fadefade-0000-0000-0000-000000000002'::uuid);
  SELECT count(*) INTO v_done    FROM public.journey_item_completions jic
    JOIN public.journey_scheduled_items jsi ON jsi.id = jic.scheduled_item_id
    WHERE jsi.assignment_id IN ('fadefade-0000-0000-0000-000000000001'::uuid,
                                 'fadefade-0000-0000-0000-000000000002'::uuid);

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Mioshy Coaching seed applied.';
  RAISE NOTICE '  users (mioshy.test):     %', v_users;
  RAISE NOTICE '  couples:                 %', v_couples;
  RAISE NOTICE '  expert_couples links:    %', v_links;
  RAISE NOTICE '  journey_assignments:     %', v_assigns;
  RAISE NOTICE '  journey_scheduled_items: %', v_sched;
  RAISE NOTICE '  journey_item_completions:%', v_done;
  RAISE NOTICE '───────────────────────────────────────────────────';
  RAISE NOTICE 'Sign-in password for ALL accounts: TestPass123!';
  RAISE NOTICE '  Admin     → admin@mioshy.test';
  RAISE NOTICE '  Expert 1  → dr.cohen@mioshy.test     (Couple 1: Noa & Tom)';
  RAISE NOTICE '  Expert 2  → dr.bar.zilai@mioshy.test (Couple 2: Shira & Amir)';
  RAISE NOTICE '  Couple 1  → noa.levi / tom.levi @mioshy.test';
  RAISE NOTICE '  Couple 2  → shira.gross / amir.gross @mioshy.test';
  RAISE NOTICE '  Solo 1/2  → maya.shapira / yoav.dahan @mioshy.test';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END
$$;

COMMIT;
