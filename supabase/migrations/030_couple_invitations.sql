-- ============================================================
-- 030_couple_invitations.sql
-- Email-based couple invitations (replaces manual pair-code copy/paste
-- as the primary pairing mechanism; pair_code is kept but re-purposed
-- as a "game session code" for cross-device play - see D6).
--
-- Product rules (from Itzik, 2026-04-21):
--   * Only a couple owner (role='owner') can invite a partner.
--   * A couple has AT MOST ONE accepted invitation ever - once a
--     partner joins, the couple is "full" (2 members, closed).
--   * A couple has AT MOST ONE active pending invitation at a time
--     (revoke the old one before sending a new one).
--   * The invitee is NOT allowed to invite further people.
--   * Tokens are long, random, URL-safe and expire after 30 days.
-- ============================================================


-- ============================================================
-- SECTION 1 - TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.couple_invitations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id         uuid        NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  inviter_user_id   uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  invitee_email     text        NOT NULL,
  invitee_name_hint text,
  -- Secret token used in the email link. High entropy; base-58-ish.
  token             text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending',
  -- Bookkeeping
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at       timestamptz,
  accepted_by_user_id uuid      REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at        timestamptz,
  revoked_by_user_id uuid       REFERENCES auth.users(id) ON DELETE SET NULL,
  last_sent_at      timestamptz NOT NULL DEFAULT now(),
  send_count        integer     NOT NULL DEFAULT 1
);

-- Normalise email storage (lowercase) for lookup.
ALTER TABLE public.couple_invitations
  DROP CONSTRAINT IF EXISTS couple_invitations_email_lower_check;
ALTER TABLE public.couple_invitations
  ADD CONSTRAINT couple_invitations_email_lower_check
  CHECK (invitee_email = lower(invitee_email));

-- Enum-ish check on status
ALTER TABLE public.couple_invitations
  DROP CONSTRAINT IF EXISTS couple_invitations_status_check;
ALTER TABLE public.couple_invitations
  ADD CONSTRAINT couple_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'));

-- Unique token for secure link lookup
CREATE UNIQUE INDEX IF NOT EXISTS couple_invitations_token_key
  ON public.couple_invitations (token);

-- At most ONE pending invitation per couple at a time
CREATE UNIQUE INDEX IF NOT EXISTS couple_invitations_pending_one_per_couple
  ON public.couple_invitations (couple_id)
  WHERE status = 'pending';

-- At most ONE accepted invitation per couple (enforces "couple closed at 2")
CREATE UNIQUE INDEX IF NOT EXISTS couple_invitations_accepted_one_per_couple
  ON public.couple_invitations (couple_id)
  WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS couple_invitations_couple_idx
  ON public.couple_invitations (couple_id);

CREATE INDEX IF NOT EXISTS couple_invitations_email_idx
  ON public.couple_invitations (invitee_email);

CREATE INDEX IF NOT EXISTS couple_invitations_expires_idx
  ON public.couple_invitations (expires_at)
  WHERE status = 'pending';


-- ============================================================
-- SECTION 2 - RLS
-- ============================================================
ALTER TABLE public.couple_invitations ENABLE ROW LEVEL SECURITY;

-- Inviter (couple owner) can SELECT their own invitations
DROP POLICY IF EXISTS "couple_invitations_select_inviter" ON public.couple_invitations;
CREATE POLICY "couple_invitations_select_inviter"
  ON public.couple_invitations
  FOR SELECT
  USING (
    public.is_couple_member(couple_id)
    OR public.is_admin()
  );

-- Inviter can UPDATE (e.g. revoke) their own pending invite
DROP POLICY IF EXISTS "couple_invitations_update_inviter" ON public.couple_invitations;
CREATE POLICY "couple_invitations_update_inviter"
  ON public.couple_invitations
  FOR UPDATE
  USING (
    (inviter_user_id = auth.uid() AND status = 'pending')
    OR public.is_admin()
  )
  WITH CHECK (
    (inviter_user_id = auth.uid())
    OR public.is_admin()
  );

-- INSERT + DELETE are restricted to service-role (server actions).
-- We do NOT add policies here, so RLS rejects client writes.


-- ============================================================
-- SECTION 3 - HELPERS
-- ============================================================

-- Generate a cryptographically-random URL-safe token (32+ bytes)
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  -- 32 random bytes → 43-char base64url-ish string (stripping =, +, /)
  SELECT translate(
    encode(gen_random_bytes(32), 'base64'),
    '+/=',
    '-_'
  );
$$;


-- Accept an invitation: runs as SECURITY DEFINER so we can touch the
-- couple_members table even if the new user hasn't set their profile
-- yet. The caller must already be authenticated.
CREATE OR REPLACE FUNCTION public.accept_couple_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invite  public.couple_invitations%ROWTYPE;
  v_user_email text;
  v_is_already_member boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Reject if user already belongs to a couple - business rule
  SELECT EXISTS (
    SELECT 1 FROM public.couple_members WHERE user_id = v_user_id
  ) INTO v_is_already_member;
  IF v_is_already_member THEN
    RAISE EXCEPTION 'user already in a couple';
  END IF;

  SELECT * INTO v_invite
  FROM public.couple_invitations
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation status %', v_invite.status;
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.couple_invitations
    SET status = 'expired'
    WHERE id = v_invite.id;
    RAISE EXCEPTION 'invitation expired';
  END IF;

  -- Soft-check that the signed-in user's email matches the invitee email.
  -- We allow mismatch (e.g. partner signed up with a different address) but
  -- we record the accepter's real user_id either way.
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Attach the user to the couple as a partner
  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (v_invite.couple_id, v_user_id, 'partner');

  -- Mark the invitation as accepted
  UPDATE public.couple_invitations
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by_user_id = v_user_id
  WHERE id = v_invite.id;

  RETURN v_invite.couple_id;
END;
$$;


-- Mark all stale pending invitations as expired. Meant to be called
-- nightly by a scheduled job (later) but safe to call anytime.
CREATE OR REPLACE FUNCTION public.expire_old_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.couple_invitations
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now()
    RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM upd;
  RETURN v_count;
END;
$$;
