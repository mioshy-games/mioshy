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


-- ── 2. Backfill: expiry for existing couples, and kill already-used codes ────
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


-- ── 3. Attempt log — keyed by CALLER, not by code ────────────────────────────
CREATE TABLE IF NOT EXISTS public.couple_join_attempts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded    boolean     NOT NULL DEFAULT false
);

-- The lookup the limiter does: recent failures for one caller.
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

  -- The caller's own state — safe to report distinctly, and checked BEFORE the
  -- attempt is logged so a legitimate "you are already paired" is not counted
  -- as a guess. RAISE here is fine: nothing has been written yet.
  SELECT count(*) INTO v_existing_count
    FROM public.couple_members
   WHERE user_id = v_user_id;
  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'user already belongs to a couple';
  END IF;

  -- Rate limit: 5 failed attempts per 15 minutes per CALLER. Per-code counting
  -- would never trip — a guesser rotates codes, so no single code accumulates.
  SELECT count(*) INTO v_recent_fails
    FROM public.couple_join_attempts
   WHERE user_id = v_user_id
     AND succeeded = false
     AND attempted_at > now() - INTERVAL '15 minutes';

  IF v_recent_fails >= 5 THEN
    RETURN NULL;
  END IF;

  -- Log the attempt as failed; flipped to succeeded only if we get to the end.
  --
  -- ⚠️ Every failure below RETURNS NULL rather than raising. RAISE would abort
  -- the transaction and roll this INSERT back with it, so the counter would
  -- never accumulate and the rate limit would be inert. The caller already
  -- treats a NULL result as failure (app/actions/between-us-couple.ts:86,
  -- `if (error || !coupleId)`), and one undifferentiated NULL is exactly the
  -- uniform response the oracle fix requires.
  INSERT INTO public.couple_join_attempts (user_id, succeeded)
  VALUES (v_user_id, false);

  IF p_pair_code IS NULL OR length(p_pair_code) <> 6 THEN
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
-- generate_pair_code() already loops until the value is unused and
-- couples_pair_code_key enforces uniqueness, so the new code never collides
-- with a live one. Rotation clears used_at and restarts the 14-day window,
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
