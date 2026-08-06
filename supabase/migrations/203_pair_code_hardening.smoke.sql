-- Manual smoke for migration 203, to run against the REAL Supabase after
-- applying it. pglite proves the logic; this proves it under Supabase's own
-- roles, RLS and auth.uid(). The ambiguous-`code` bug is why this exists.
--
-- Run as an ordinary AUTHENTICATED user, not in the SQL editor's default role.
-- Replace <COUPLE> with a couple you own.

-- 1. Generate: returns a new 6-char code, and the old one is now dead.
SELECT public.rotate_pair_code('<COUPLE>') AS new_code;

-- 2. Join: as the OTHER user, with the code from step 1 → returns the couple id.
SELECT public.join_couple_by_pair_code('<NEW_CODE>') AS joined;

-- 3. Reuse: same code again → must be NULL (retired by step 2), not an error.
SELECT public.join_couple_by_pair_code('<NEW_CODE>') AS must_be_null;

-- 4. Rotate again, then try the code from step 1 → must be NULL.
SELECT public.rotate_pair_code('<COUPLE>') AS newer_code;
SELECT public.join_couple_by_pair_code('<NEW_CODE>') AS retired_must_be_null;

-- 5. The blocking check: these three tables must be invisible to the API roles.
SELECT grantee, table_name, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name IN ('pair_codes_issued','couple_join_attempts','couple_pair_code_rotations')
   AND grantee IN ('anon','authenticated');
-- EXPECTED: zero rows.
