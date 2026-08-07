-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO RUN THIS FILE            (Supabase SQL editor, manually, after 203)
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE  End-to-end pass under Supabase's own roles, RLS and auth.uid().
--          pglite proves the logic; this proves it in the real environment.
--
-- ⚠️ SAFETY  This one MUTATES AND KEEPS ITS CHANGES — there is no ROLLBACK,
--            because the point is to exercise the real flow. Use a couple YOU
--            own and are willing to rotate. Rotating a stranger's couple kills
--            a code their partner may be holding right now.
--
-- PLACEHOLDERS TO FILL — three:
--
--   <COUPLE>     a couple id you are a member of. Get it with:
--                  SELECT c.id, c.pair_code
--                    FROM public.couples c
--                    JOIN public.couple_members m ON m.couple_id = c.id
--                   WHERE m.user_id = '<YOUR_USER>';
--
--   <YOUR_USER>  your own auth.users.id (needed so auth.uid() resolves —
--                it is NULL in the SQL editor).
--
--   <NEW_CODE>   NOT known up front. It is the value step 1 RETURNS.
--                Run step 1, copy the result, then fill it into steps 2-4.
--
-- CORRECT OUTPUT
--   1  new_code  — a 6-char code, different from the couple's current one
--   2  joined    — the couple id (as the OTHER user)
--   3  must_be_null          — NULL, not an error
--   4  retired_must_be_null  — NULL
--   5  zero rows
-- ═══════════════════════════════════════════════════════════════════════════

-- Act as yourself so auth.uid() resolves.
SELECT set_config('request.jwt.claims',
                  json_build_object('sub','<YOUR_USER>','role','authenticated')::text,
                  false);

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
