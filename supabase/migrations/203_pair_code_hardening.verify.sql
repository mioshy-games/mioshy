-- ═══════════════════════════════════════════════════════════════════════════
-- HOW TO RUN THIS FILE            (Supabase SQL editor, manually, after 203)
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE  Proves the rate limiter ACCUMULATES in the real database. An earlier
--          draft of 203 raised an exception on each failure, which aborts the
--          transaction and rolls the counter row back with it — the limiter
--          would have been inert. Only running it shows that.
--
-- SAFETY   Everything is inside BEGIN … ROLLBACK. Nothing is kept.
--          It does NOT create a user: an INSERT into auth.users would fire the
--          on_auth_user_created trigger (002:22). It borrows an existing one.
--
-- PLACEHOLDER TO FILL — exactly one:
--
--   <PROBE_USER>   any real auth.users.id that is NOT in a couple.
--                  Get it with:
--                      SELECT u.id, u.email
--                        FROM auth.users u
--                       WHERE NOT EXISTS (
--                         SELECT 1 FROM public.couple_members m WHERE m.user_id = u.id)
--                       LIMIT 1;
--                  Their data is untouched — the transaction is rolled back.
--
-- CORRECT OUTPUT
--   · First result: six rows, `result` NULL in every one. Identical NULLs are
--     the point — wrong code and rate-limited must be indistinguishable.
--   · Second result: attempts_recorded = 6, failures = 6.
--       0 here = a RAISE crept back in and the rate limit is dead.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Act as the probe user so auth.uid() resolves (it is NULL in the editor).
SELECT set_config('request.jwt.claims',
                  json_build_object('sub','<PROBE_USER>','role','authenticated')::text,
                  true);

-- Six attempts with a code that cannot exist.
SELECT 1 AS attempt, public.join_couple_by_pair_code('ZZZZZZ') AS result
UNION ALL SELECT 2, public.join_couple_by_pair_code('ZZZZZZ')
UNION ALL SELECT 3, public.join_couple_by_pair_code('ZZZZZZ')
UNION ALL SELECT 4, public.join_couple_by_pair_code('ZZZZZZ')
UNION ALL SELECT 5, public.join_couple_by_pair_code('ZZZZZZ')
UNION ALL SELECT 6, public.join_couple_by_pair_code('ZZZZZZ');

-- THE assertion: the rows survived, i.e. nothing rolled them back.
SELECT count(*) AS attempts_recorded,
       count(*) FILTER (WHERE NOT succeeded) AS failures
  FROM public.couple_join_attempts
 WHERE user_id = '<PROBE_USER>';

ROLLBACK;
