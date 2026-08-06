-- ─────────────────────────────────────────────────────────────────────────────
-- 203  Pair-code hardening
--      Audit 2026-08-05, H8(c) — scope extended after review, 2026-08-06
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: numbered 203, leaving 202 free for the H6 `category` migration that
--       is waiting on the manual template classification.
--
-- ⚠️ NOT YET APPROVED TO RUN. Brought for review first — this changes a live
--    pairing flow. Do not execute until signed off.
--
-- Run in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/kphfmbqqafrvuzmiotsz/sql/new
--
-- THE PROBLEM, in order of severity:
--
--   1. The code was NEVER invalidated. join_couple_by_pair_code inserted a
--      couple_members row and returned; couples.pair_code was never cleared,
--      rotated or marked used. A code shared in WhatsApp or a screenshot stayed
--      valid forever, and if a member later left, the couple dropped back to
--      one seat and any previously harvested code became usable again.
--
--   2. The error messages were an enumeration oracle. 'pair_code not found'
--      versus 'couple is full' distinguished "no such code" from "a real
--      couple, currently full". With unlimited attempts that maps the entire
--      space of existing couples without a single successful join.
--
--   3. No rate limit. 6 chars over a 32-symbol alphabet is ~1.07e9, which a
--      distributed guesser reaches; the counter must be per CALLER, not per
--      code, or an attacker rotating random codes never trips any single
--      code's counter.
--
--   4. No expiry, and — critically — NO WAY TO GENERATE A NEW CODE. There is no
--      UPDATE on couples.pair_code anywhere in the repo. Expiry without
--      rotation would strand every couple that did not pair in time, so
--      rotate_pair_code ships in the SAME migration, not after.


-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS pair_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pair_code_used_at    timestamptz,
  ADD COLUMN IF NOT EXISTS pair_code_rotated_at timestamptz;

COMMENT ON COLUMN public.couples.pair_code_used_at IS
  'Set when a partner joins. A non-null value invalidates the code PERMANENTLY — a member leaving does not revive it; the remaining member must call rotate_pair_code. Audit H8(c).';


-- ── 2. Codes are reserved FOREVER, not just while live ──────────────────────
-- THE HOLE THIS CLOSES (found during review, 2026-08-06):
--
--   couples_pair_code_key (029:40) is a PARTIAL unique index:
--       CREATE UNIQUE INDEX ... ON couples (pair_code) WHERE is_active = true
--   and generate_pair_code() only checked
--       SELECT 1 FROM couples WHERE pair_code = code AND is_active = true
--
--   So uniqueness held only among ACTIVE couples. A code belonging to a
--   deactivated couple was already reissuable. Rotation makes that far worse:
--   every rotation OVERWRITES couples.pair_code, so the old value disappears
--   from the table entirely and becomes freely reissuable to a DIFFERENT
--   couple. Someone who screenshotted a code a year ago could then use it to
--   join a stranger's couple — worse than anything else H8 addresses.
--
--   The generator was also racy: SELECT EXISTS then use, with no lock.
--
-- Chosen fix: reserve every code ever issued in a table whose PRIMARY KEY does
-- the enforcing, and have the generator claim its code by INSERT. That is
-- atomic (no race), covers history (no reissue), and needs no change to the
-- existing partial index, which stays as a second layer for live rows.
CREATE TABLE IF NOT EXISTS public.pair_codes_issued (
  code      text PRIMARY KEY,
  issued_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pair_codes_issued IS
  'Every pair code ever issued. A code is never reused, even after the couple is deactivated or the code is rotated away. Audit H8(c).';

-- Reserve every code currently in use so the generator cannot hand one out again.
INSERT INTO public.pair_codes_issued (code)
SELECT DISTINCT pair_code FROM public.couples WHERE pair_code IS NOT NULL
ON CONFLICT (code) DO NOTHING;

-- Generator: claim-by-INSERT. Returns only a code it has successfully reserved.
CREATE OR REPLACE FUNCTION public.generate_pair_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- 32 symbols, deliberately excluding I, O, 0 and 1 so a code cannot be
  -- misread. This is what makes a 5-attempt limit fair to a real user.
  chars   text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  -- NOTE: named v_code, not `code`. The reservation table's column is also
  -- called `code`, and plpgsql resolves an unqualified `code` in
  -- VALUES (…) / ON CONFLICT (…) ambiguously — Postgres raises
  -- "column reference \"code\" is ambiguous" and the function never runs.
  -- Caught by tests/db/pair-code-hardening.test.ts.
  v_code  text;
  tries   integer := 0;
  claimed integer;
BEGIN
  LOOP
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;

    -- Atomic claim. ON CONFLICT means a concurrent generator racing us simply
    -- loses and loops again, instead of both walking away with the same code.
    INSERT INTO public.pair_codes_issued (code)
    VALUES (v_code)
    ON CONFLICT (code) DO NOTHING;
    GET DIAGNOSTICS claimed = ROW_COUNT;

    EXIT WHEN claimed = 1;

    tries := tries + 1;
    IF tries > 50 THEN
      RAISE EXCEPTION 'could not generate unique pair_code after 50 attempts';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;


-- ── 3. Backfill: expiry, and retire codes of couples that are already full ──
-- No existing code is invalidated retroactively by expiry: everyone gets a full
-- 14 days from the moment this migration runs, even if their couple is old.
UPDATE public.couples
   SET pair_code_expires_at = GREATEST(created_at + INTERVAL '14 days', now() + INTERVAL '14 days')
 WHERE pair_code_expires_at IS NULL;

-- Couples that already have both seats filled have no legitimate use for their
-- code. Retiring them now closes the whole historical exposure in one step
-- instead of waiting 14 days for it to age out.
UPDATE public.couples c
   SET pair_code_used_at = now()
 WHERE c.pair_code_used_at IS NULL
   AND (SELECT count(*) FROM public.couple_members m WHERE m.couple_id = c.id) >= 2;


-- ── 3b. Attempt log — keyed by CALLER, not by code ──────────────────────────
CREATE TABLE IF NOT EXISTS public.couple_join_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded    boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS couple_join_attempts_user_recent_idx
  ON public.couple_join_attempts (user_id, attempted_at DESC);

ALTER TABLE public.couple_join_attempts ENABLE ROW LEVEL SECURITY;
-- No policy: readable only via service role. The function is SECURITY DEFINER
-- and writes on the caller's behalf.

-- Rotation log. A counter column on `couples` cannot express "5 per hour"
-- (there is only ever one row per couple, so counting it yields 0 or 1); the
-- window has to be measured over discrete events.
CREATE TABLE IF NOT EXISTS public.couple_pair_code_rotations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id  uuid        NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  rotated_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  rotated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS couple_pair_code_rotations_recent_idx
  ON public.couple_pair_code_rotations (couple_id, rotated_at DESC);

ALTER TABLE public.couple_pair_code_rotations ENABLE ROW LEVEL SECURITY;


-- ── 4. join_couple_by_pair_code — uniform failure, rate limited, single use ──
-- EVERY failure that concerns the CODE returns a bare NULL, so the response
-- cannot distinguish "wrong code" from "expired", "already used", "full" or
-- "rate limited".
--
-- 'user already belongs to a couple' stays a distinct exception on purpose: it
-- describes the CALLER'S OWN state, which they already know, and leaks nothing
-- about anyone else. Collapsing it would make a common, legitimate situation
-- undebuggable for no security gain.
CREATE OR REPLACE FUNCTION public.join_couple_by_pair_code(p_pair_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_couple_id      uuid;
  v_existing_count integer;
  v_recent_fails   integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- The attempt is recorded as the FIRST statement, before any validation.
  --
  -- Ordering matters because a RAISE anywhere in a plpgsql function aborts the
  -- transaction and takes every earlier write with it. Logging first, and then
  -- never raising, is what makes the counter actually accumulate — an earlier
  -- draft of this migration raised on each failure and the limiter would have
  -- been completely inert.
  --
  -- ⚠️ INVARIANT: NOTHING BELOW THIS INSERT MAY RAISE. Every failure returns
  -- NULL, including "already in a couple". If you add a check here, return
  -- NULL — do not RAISE, and do not add a statement that can violate a
  -- constraint.
  INSERT INTO public.couple_join_attempts (user_id, succeeded)
  VALUES (v_user_id, false);

  -- Rate limit: 5 failures per 15 minutes per CALLER. Per-code counting would
  -- never trip — a guesser rotates codes, so no single code accumulates.
  -- The row just inserted is included, so a blocked caller who keeps hammering
  -- keeps their own window topped up; it clears 15 minutes after they stop.
  SELECT count(*) INTO v_recent_fails
    FROM public.couple_join_attempts
   WHERE user_id = v_user_id
     AND succeeded = false
     AND attempted_at > now() - INTERVAL '15 minutes';

  IF v_recent_fails > 5 THEN
    RETURN NULL;
  END IF;

  IF p_pair_code IS NULL OR length(p_pair_code) <> 6 THEN
    RETURN NULL;
  END IF;

  -- Caller already paired. Returns NULL like everything else so the invariant
  -- above holds; the app gives this case its own message by checking the
  -- caller's OWN membership before calling, which leaks nothing.
  SELECT count(*) INTO v_existing_count
    FROM public.couple_members
   WHERE user_id = v_user_id;
  IF v_existing_count > 0 THEN
    RETURN NULL;
  END IF;

  -- Valid = exists, active, unused, unexpired. Every miss is indistinguishable.
  SELECT id INTO v_couple_id
    FROM public.couples
   WHERE pair_code = upper(p_pair_code)
     AND is_active = true
     AND pair_code_used_at IS NULL
     AND (pair_code_expires_at IS NULL OR pair_code_expires_at > now())
   LIMIT 1;

  IF v_couple_id IS NULL THEN
    RETURN NULL;                      -- was 'pair_code not found'
  END IF;

  SELECT count(*) INTO v_existing_count
    FROM public.couple_members
   WHERE couple_id = v_couple_id;
  IF v_existing_count >= 2 THEN
    RETURN NULL;                      -- was 'couple is full' — the oracle's other half
  END IF;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (v_couple_id, v_user_id, 'partner');

  -- Single use, permanent: a member leaving later does NOT revive this code.
  UPDATE public.couples
     SET pair_code_used_at = now()
   WHERE id = v_couple_id;

  UPDATE public.couple_join_attempts
     SET succeeded = true
   WHERE id = (
     SELECT id FROM public.couple_join_attempts
      WHERE user_id = v_user_id ORDER BY attempted_at DESC LIMIT 1
   );

  RETURN v_couple_id;
END;
$$;


-- ── 5. rotate_pair_code — mandatory counterpart to expiry and single use ─────
-- Members only. Rate limited to 5 rotations per hour per couple, which is far
-- above any real use (a couple rotates once, maybe twice) and low enough that
-- it cannot be used to enumerate the code space from the inside.
-- generate_pair_code() now claims its code by INSERT into pair_codes_issued,
-- so the new value has never been issued to anyone, ever — not merely absent
-- from live rows. Rotation clears used_at and restarts the 14-day window,
-- which is what makes a code recoverable after a member leaves.
CREATE OR REPLACE FUNCTION public.rotate_pair_code(p_couple_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_is_member boolean;
  v_recent   integer;
  v_new_code text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.couple_members
     WHERE couple_id = p_couple_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not a member of this couple';
  END IF;

  SELECT count(*) INTO v_recent
    FROM public.couple_pair_code_rotations
   WHERE couple_id = p_couple_id
     AND rotated_at > now() - INTERVAL '1 hour';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'too many rotations, try again later';
  END IF;

  v_new_code := public.generate_pair_code();

  -- The previous code stops working the instant this commits.
  UPDATE public.couples
     SET pair_code            = v_new_code,
         pair_code_used_at    = NULL,
         pair_code_expires_at = now() + INTERVAL '14 days',
         pair_code_rotated_at = now()
   WHERE id = p_couple_id;

  INSERT INTO public.couple_pair_code_rotations (couple_id, rotated_by)
  VALUES (p_couple_id, v_user_id);

  RETURN v_new_code;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_pair_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_pair_code(uuid) TO authenticated;
