-- POST-RUN verification for migration 203. Run immediately AFTER applying it.
--
-- "The migration ran successfully" only means there was no syntax error. Two of
-- the four bugs found in 203 were invisible to review and to a successful
-- apply — a missing column DEFAULT and an ambiguous plpgsql variable — so each
-- statement below proves an OUTCOME, not that a statement executed.
--
-- Every check states its expected result. Any mismatch = stop and report.

-- ── 1. The DEFAULT exists on the column, not merely values on old rows ──────
SELECT column_name, column_default, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'couples'
   AND column_name  = 'pair_code_expires_at';
-- EXPECT: column_default contains "now() + '14 days'".
-- NULL default = the expiry is dead for every future couple, exactly the bug
-- the backfill hides.

-- ── 2. A couple created through the PRODUCTION path gets a real expiry ──────
-- Uses ensure_couple_for_user, the same RPC the Cardcom callback calls.
-- Replace <FRESH_USER> with a user id that is not yet in any couple.
BEGIN;
SELECT public.ensure_couple_for_user('<FRESH_USER>') AS new_couple_id;
SELECT id,
       pair_code,
       pair_code_expires_at,
       round(EXTRACT(EPOCH FROM (pair_code_expires_at - now())) / 86400)::int AS days_left,
       pair_code_used_at
  FROM public.couples
 WHERE created_by = '<FRESH_USER>'
 ORDER BY created_at DESC
 LIMIT 1;
-- EXPECT: pair_code_expires_at NOT NULL, days_left = 14, pair_code_used_at NULL.

-- ── 3. …and its code was reserved in the history table ─────────────────────
SELECT c.pair_code,
       (i.code IS NOT NULL) AS is_reserved
  FROM public.couples c
  LEFT JOIN public.pair_codes_issued i ON i.code = c.pair_code
 WHERE c.created_by = '<FRESH_USER>'
 ORDER BY c.created_at DESC
 LIMIT 1;
-- EXPECT: is_reserved = true. False means generate_pair_code is not claiming,
-- and a live code could later be handed to a second couple.
ROLLBACK;   -- discard the probe couple

-- ── 4. Rotation retires the old code AND issues a fresh window ─────────────
-- Replace <COUPLE> with a couple you belong to. Note the old code first.
SELECT pair_code AS old_code, pair_code_expires_at AS old_expiry
  FROM public.couples WHERE id = '<COUPLE>';

SELECT public.rotate_pair_code('<COUPLE>') AS new_code;

SELECT pair_code AS new_code,
       round(EXTRACT(EPOCH FROM (pair_code_expires_at - now())) / 86400)::int AS days_left,
       pair_code_used_at,
       (SELECT count(*) FROM public.pair_codes_issued WHERE code = '<OLD_CODE>') AS old_still_reserved
  FROM public.couples WHERE id = '<COUPLE>';
-- EXPECT: new_code differs from old_code, days_left = 14, pair_code_used_at
-- NULL, old_still_reserved = 1 (the retired code stays reserved forever).

-- ── 5. The three tables are invisible to the API roles ─────────────────────
SELECT grantee, table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('pair_codes_issued','couple_join_attempts','couple_pair_code_rotations')
   AND grantee IN ('anon','authenticated');
-- EXPECT: zero rows. Any row means the code list is readable and the whole
-- fix inverts — reading codes beats guessing them.

SELECT relname, relrowsecurity, relforcerowsecurity
  FROM pg_class
 WHERE relnamespace = 'public'::regnamespace
   AND relname IN ('pair_codes_issued','couple_join_attempts','couple_pair_code_rotations');
-- EXPECT: three rows, both booleans true on each.
