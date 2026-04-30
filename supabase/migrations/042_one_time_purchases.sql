-- ============================================================================
-- 042_one_time_purchases.sql
-- ----------------------------------------------------------------------------
-- Adds support for ONE-TIME PURCHASES to the existing Cardcom billing pipeline.
--
-- Until now, every successful Cardcom indicator callback created a row in
-- public.subscriptions (recurring). The Adults pillar now ships as one-time
-- per-game purchases - one Cardcom charge unlocks a single experience_game
-- forever, no recurring billing, no subscription row.
--
-- We extend the existing `checkout_sessions` table with two columns:
--
--   • `purchase_type`  - 'subscription' | 'one_time'
--   • `target_game_id` - uuid (nullable) that points at experience_games.id
--                        when purchase_type = 'one_time'
--
-- Both default sensibly so existing flows (Journey live in prod) keep working
-- without a single line of route-handler change. The indicator webhook will
-- branch on `purchase_type`: 'subscription' → today's path; 'one_time' →
-- insert couple_entitlement (source = 'paid'), no subscription row.
--
-- Permanent access for purchased Adults games: the entitlement is keyed by
-- the COUPLE (not the user) and never expires - this remains true even after
-- a Journey subscription is cancelled, per spec.
-- ============================================================================

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS purchase_type text
    NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS target_game_id uuid
    REFERENCES public.experience_games(id) ON DELETE SET NULL;

-- Constrain to a known set so a typo at the call-site can never silently
-- create a bad session row.
ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_purchase_type_check;
ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_purchase_type_check
  CHECK (purchase_type IN ('subscription', 'one_time'));

-- Sanity rule: target_game_id is required for one_time purchases (otherwise
-- the indicator webhook has no idea which game to entitle), and forbidden for
-- subscriptions (those grant pillar-wide access - they don't target a row).
ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_target_shape_check;
ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_target_shape_check
  CHECK (
    (purchase_type = 'one_time' AND target_game_id IS NOT NULL)
    OR
    (purchase_type = 'subscription' AND target_game_id IS NULL)
  );

-- Helpful index for the indicator webhook to look up sessions by target +
-- type when reconciling - and for reporting ("how many one-time Adults
-- purchases this month").
CREATE INDEX IF NOT EXISTS checkout_sessions_purchase_type_idx
  ON public.checkout_sessions (purchase_type, target_game_id)
  WHERE purchase_type = 'one_time';

-- ============================================================================
-- ensure_couple_for_user(p_user_id uuid)
-- ----------------------------------------------------------------------------
-- The Cardcom indicator webhook runs with the SUPABASE service-role key -
-- there is NO `auth.uid()` available inside its execution context (it's not
-- an authenticated user request, it's a server-to-server call).
--
-- The existing `create_couple_for_current_user()` RPC takes its identity
-- from `auth.uid()`, so the webhook can't use it. We add a sister RPC that
-- accepts the user_id explicitly as a parameter. It's SECURITY DEFINER so
-- it can write to public.couples + public.couple_members regardless of the
-- caller's RLS posture, and it's locked down via REVOKE/GRANT so only the
-- service role and authenticated callers can invoke it.
--
-- Idempotent: if the user is already a member of a couple, returns that
-- couple_id without creating anything new. Mirrors the behaviour of the
-- auth.uid() variant exactly.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_couple_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_couple_id uuid;
  v_pair_code text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id required';
  END IF;

  -- Already a member of a couple? Return that one (idempotent).
  SELECT couple_id
    INTO v_couple_id
    FROM public.couple_members
   WHERE user_id = p_user_id
   LIMIT 1;

  IF v_couple_id IS NOT NULL THEN
    RETURN v_couple_id;
  END IF;

  -- Otherwise, fresh couple. Reuse the existing pair-code generator so the
  -- format stays consistent (6-char A–Z0–9, ambiguous chars excluded).
  v_pair_code := public.generate_pair_code();

  INSERT INTO public.couples (pair_code, created_by, display_name)
  VALUES (v_pair_code, p_user_id, NULL)
  RETURNING id INTO v_couple_id;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (v_couple_id, p_user_id, 'owner');

  RETURN v_couple_id;
END;
$$;

-- Lock down: revoke from PUBLIC, grant only to service_role + authenticated.
-- Authenticated callers don't normally need this (they should still go
-- through create_couple_for_current_user) but we leave it open in case a
-- future server action needs it under an authenticated cookie.
REVOKE ALL ON FUNCTION public.ensure_couple_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_couple_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_couple_for_user(uuid) TO authenticated;
