-- Verification for migration 203 — rate limiter accumulation.
-- Run AFTER applying 203, in a transaction that is rolled back at the end.
BEGIN;

-- A throwaway user to attempt as.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000aa', 'ratelimit-probe@example.invalid')
ON CONFLICT (id) DO NOTHING;

-- Impersonate them the way PostgREST does.
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}';

-- Six attempts with a code that cannot exist.
SELECT 1 AS attempt, public.join_couple_by_pair_code('ZZZZZZ') AS result
UNION ALL SELECT 2, public.join_couple_by_pair_code('ZZZZZZ')
UNION ALL SELECT 3, public.join_couple_by_pair_code('ZZZZZZ')
UNION ALL SELECT 4, public.join_couple_by_pair_code('ZZZZZZ')
UNION ALL SELECT 5, public.join_couple_by_pair_code('ZZZZZZ')
UNION ALL SELECT 6, public.join_couple_by_pair_code('ZZZZZZ');
-- EXPECTED: all six return NULL (indistinguishable), and the 6th is the
-- rate-limited one rather than a code miss.

-- THE ASSERTION THAT MATTERS: the rows survived, i.e. nothing rolled them back.
SELECT count(*) AS attempts_recorded, count(*) FILTER (WHERE NOT succeeded) AS failures
FROM public.couple_join_attempts
WHERE user_id = '00000000-0000-0000-0000-0000000000aa';
-- EXPECTED: attempts_recorded = 6, failures = 6.
-- A result of 0 means a RAISE crept back in and the limiter is inert.

ROLLBACK;
