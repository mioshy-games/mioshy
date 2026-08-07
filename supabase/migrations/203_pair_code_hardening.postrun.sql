-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO RUN THIS FILE            (Supabase SQL editor, manually)
-- ═══════════════════════════════════════════════════════════════════════════
-- WHEN     Immediately after 203_pair_code_hardening.sql applies.
--
-- PLACEHOLDERS TO FILL — two, both auth.users ids NOT currently in a couple.
--          Get both at once:
--              SELECT u.id, u.email
--                FROM auth.users u
--               WHERE NOT EXISTS (
--                 SELECT 1 FROM public.couple_members m WHERE m.user_id = u.id)
--               LIMIT 2;
--          Put the first in <FRESH_USER_A>, the second in <FRESH_USER_B>.
--          Their data is untouched — both probes are rolled back.
--          <OLD_CODE> is optional and only for the commented-out last query in
--          check 4; it is the old_code value that check prints.
--
-- SAFETY   Checks 1 and 5 are catalog reads. Checks 2-4 create their own probe
--          couples inside BEGIN … ROLLBACK and keep nothing. NEVER point any
--          check at a real couple.
--
-- CORRECT OUTPUT   Each check carries its own EXPECT line. All five must match.
--                  Any mismatch = stop and report; do not "fix" it in place.
-- ═══════════════════════════════════════════════════════════════════════════

-- POST-RUN verification for migration 203. Run immediately AFTER applying it.
--
-- "The migration ran successfully" only means there was no syntax error. Two of
-- the four bugs found in 203 were invisible to review AND to a clean apply — a
-- missing column DEFAULT and an ambiguous plpgsql variable — so every statement
-- below proves an OUTCOME, not that a statement executed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- SAFETY: what each check touches
--
--   1  READ ONLY   — catalog only.
--   2  MUTATES     — wrapped in BEGIN … ROLLBACK, creates its own probe couple.
--   3  MUTATES     — same transaction as 2.
--   4  MUTATES     — wrapped in BEGIN … ROLLBACK, creates its OWN probe couple.
--   5  READ ONLY   — catalog only.
--
-- Check 4 must NEVER be pointed at a real couple. Rotating a live couple's code
-- kills a code a partner may be holding right now — damage caused by the test
-- itself — and it burns one of that couple's five rotations per hour. It also
-- cannot reuse the couple from check 2, which is rolled back by then.
--
-- AUTH: rotate_pair_code and join_couple_by_pair_code read auth.uid(), which is
-- NULL in the SQL editor — they would raise 'not authenticated' and look broken
-- when they are not. Each transaction below sets request.jwt.claims so
-- auth.uid() resolves. The role is deliberately NOT switched: these run as the
-- editor's role so RLS on couples does not obstruct the verification reads,
-- while auth.uid() still returns the identity the functions check.
--
-- Replace <FRESH_USER_A> and <FRESH_USER_B> with two real auth.users ids that
-- are NOT currently members of any couple. Find them with:
--   SELECT u.id FROM auth.users u
--    WHERE NOT EXISTS (SELECT 1 FROM public.couple_members m WHERE m.user_id = u.id)
--    LIMIT 2;
--
-- Any mismatch against an EXPECT line = stop and report.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. READ ONLY — the DEFAULT exists on the column ─────────────────────────
-- Not merely that old rows were filled: the backfill hides a missing default.
SELECT column_name, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'couples'
   AND column_name  = 'pair_code_expires_at';
-- EXPECT: column_default contains "now() + '14 days'".
-- NULL default = the expiry is dead for every future couple.


-- ── 2 + 3. MUTATES (rolled back) — production path gets a real expiry, and ──
-- ──         its code was reserved in the history table ──────────────────────
BEGIN;

SELECT set_config('request.jwt.claims',
                  json_build_object('sub','<FRESH_USER_A>','role','authenticated')::text,
                  true);

-- The same RPC the Cardcom callback calls.
SELECT public.ensure_couple_for_user('<FRESH_USER_A>') AS probe_couple_id;

SELECT c.id,
       c.pair_code,
       c.pair_code_expires_at,
       round(EXTRACT(EPOCH FROM (c.pair_code_expires_at - now())) / 86400)::int AS days_left,
       c.pair_code_used_at,
       (i.code IS NOT NULL) AS is_reserved
  FROM public.couples c
  LEFT JOIN public.pair_codes_issued i ON i.code = c.pair_code
 WHERE c.created_by = '<FRESH_USER_A>'
 ORDER BY c.created_at DESC
 LIMIT 1;
-- EXPECT (check 2): pair_code_expires_at NOT NULL, days_left = 14,
--                   pair_code_used_at NULL.
-- EXPECT (check 3): is_reserved = true. False means generate_pair_code is not
--                   claiming, and a live code could later go to a second couple.

ROLLBACK;   -- discards the probe couple, its membership and its reserved code


-- ── 4. MUTATES (rolled back) — rotation retires the old code and issues a ───
-- ──    fresh window. Uses its OWN probe couple, never a real one. ───────────
BEGIN;

SELECT set_config('request.jwt.claims',
                  json_build_object('sub','<FRESH_USER_B>','role','authenticated')::text,
                  true);

SELECT public.ensure_couple_for_user('<FRESH_USER_B>') AS probe_couple_id;

-- Age the probe couple so an inherited expiry would be visibly wrong: if
-- rotation leaned on the column DEFAULT instead of assigning explicitly, the
-- new code would be born already expired.
UPDATE public.couples
   SET created_at           = now() - INTERVAL '20 days',
       pair_code_expires_at = now() - INTERVAL '6 days'
 WHERE created_by = '<FRESH_USER_B>';

SELECT pair_code AS old_code
  FROM public.couples WHERE created_by = '<FRESH_USER_B>';

SELECT public.rotate_pair_code(
         (SELECT id FROM public.couples WHERE created_by = '<FRESH_USER_B>')
       ) AS new_code;

SELECT c.pair_code AS new_code,
       round(EXTRACT(EPOCH FROM (c.pair_code_expires_at - now())) / 86400)::int AS days_left,
       c.pair_code_used_at,
       (SELECT count(*) FROM public.pair_codes_issued WHERE code = c.pair_code) AS new_reserved
  FROM public.couples c
 WHERE c.created_by = '<FRESH_USER_B>';
-- EXPECT: new_code differs from old_code, days_left = 14 (NOT negative — a
--         negative value means the expiry was inherited), pair_code_used_at
--         NULL, new_reserved = 1.

-- The retired code stays reserved forever. Paste old_code from above.
-- SELECT count(*) AS old_still_reserved
--   FROM public.pair_codes_issued WHERE code = '<OLD_CODE>';
-- EXPECT: 1.

ROLLBACK;   -- discards the probe couple and the rotation


-- ── 5. READ ONLY — the three tables are invisible to the API roles ──────────
SELECT grantee, table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('pair_codes_issued','couple_join_attempts','couple_pair_code_rotations')
   AND grantee IN ('anon','authenticated');
-- EXPECT: zero rows. Any row means the code list is readable and the whole fix
-- inverts — reading codes beats guessing them.

SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
 WHERE relnamespace = 'public'::regnamespace
   AND relname IN ('pair_codes_issued','couple_join_attempts','couple_pair_code_rotations');
-- EXPECT: three rows, both booleans true on each.
