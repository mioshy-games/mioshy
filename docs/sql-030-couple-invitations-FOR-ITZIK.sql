-- ============================================================
-- couple_invitations — RESTORE SQL · ⛔ NOT RUN, AND NOT TO BE RUN ⛔
-- Prepared 2026-07-27. Kept for the record only.
--
-- ┌──────────────────────────────────────────────────────────┐
-- │ DECISION (Itzik, 2026-07-27): DO NOT RUN THIS.           │
-- │ We chose option B — the email-invite flow was REMOVED    │
-- │ from the codebase instead of revived. Pairing is         │
-- │ pair-code via couple_members, and that is the only       │
-- │ pairing path now. Deleted in the same change:            │
-- │   app/[locale]/invite/[token]/page.tsx                   │
-- │   components/invite/InviteClaimClient.tsx                │
-- │   components/between-us/InvitePartnerByEmail.tsx         │
-- │   app/actions/invite-claim.ts                            │
-- │   app/actions/couple-invitations.ts                      │
-- │   lib/between-us/invitations.ts                          │
-- │ This file is retained ONLY so the schema is on record if │
-- │ the decision is ever revisited. Reviving it needs the    │
-- │ code back too — the SQL alone does nothing.              │
-- └──────────────────────────────────────────────────────────┘
--
-- ⚠️ ORIGINAL REVIEW NOTES (kept as written) ⚠️
-- Migration 030 was NOT skipped by accident. There is an explicit written
-- instruction not to run it:
--     docs/assessment-funnel-analytics-FINAL-CHECKLIST.md:69
--     "couple_invitations נוטשה לטובת couple_members. אל תריץ את mig 030."
-- Running this SQL reverses that decision. Only run it if reviving the
-- email-invite flow is what you actually want.
--
-- WHAT IS TRUE IN PRODUCTION TODAY (probed 2026-07-27):
--   • migration 029 DID run — couples, couple_members, is_couple_member(),
--     is_admin() all exist.
--   • migration 030 did NOT — public.couple_invitations is absent, and so are
--     accept_couple_invitation(), generate_invitation_token(),
--     expire_old_invitations().
--   • Consequence: https://mioshy.com/he/invite/<token> returns HTTP 500 for
--     every token ("Could not find the table 'public.couple_invitations'").
--   • Mitigating: <InvitePartnerByEmail/> is not rendered anywhere in the app
--     (only its TypeScript type is imported), so no invitation email has ever
--     been sent and nobody holds one of these links. The route is dead, not
--     actively breaking on real users.
--
-- This is migration 030 verbatim, with ONE deliberate change, marked [FIX]:
-- generate_invitation_token() had `SET search_path = public`, but on Supabase
-- pgcrypto's gen_random_bytes() lives in the `extensions` schema — as written
-- the function would create fine and then fail at call time with
-- "function gen_random_bytes(integer) does not exist". search_path now includes
-- extensions.
--
-- Run as one transaction in the Supabase SQL editor. Safe to re-run
-- (IF NOT EXISTS / OR REPLACE throughout). After it completes, reload the
-- PostgREST schema cache (the NOTIFY at the end) or the API will keep saying
-- the table is missing.
-- ============================================================

BEGIN;

-- ── TABLE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.couple_invitations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id           uuid        NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  inviter_user_id     uuid        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  invitee_email       text        NOT NULL,
  invitee_name_hint   text,
  token               text        NOT NULL,
  status              text        NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at         timestamptz,
  accepted_by_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at          timestamptz,
  revoked_by_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  last_sent_at        timestamptz NOT NULL DEFAULT now(),
  send_count          integer     NOT NULL DEFAULT 1
);

ALTER TABLE public.couple_invitations
  DROP CONSTRAINT IF EXISTS couple_invitations_email_lower_check;
ALTER TABLE public.couple_invitations
  ADD CONSTRAINT couple_invitations_email_lower_check
  CHECK (invitee_email = lower(invitee_email));

ALTER TABLE public.couple_invitations
  DROP CONSTRAINT IF EXISTS couple_invitations_status_check;
ALTER TABLE public.couple_invitations
  ADD CONSTRAINT couple_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'));

CREATE UNIQUE INDEX IF NOT EXISTS couple_invitations_token_key
  ON public.couple_invitations (token);
CREATE UNIQUE INDEX IF NOT EXISTS couple_invitations_pending_one_per_couple
  ON public.couple_invitations (couple_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS couple_invitations_accepted_one_per_couple
  ON public.couple_invitations (couple_id) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS couple_invitations_couple_idx
  ON public.couple_invitations (couple_id);
CREATE INDEX IF NOT EXISTS couple_invitations_email_idx
  ON public.couple_invitations (invitee_email);
CREATE INDEX IF NOT EXISTS couple_invitations_expires_idx
  ON public.couple_invitations (expires_at) WHERE status = 'pending';

-- ── RLS (INSERT/DELETE stay service-role only: no policies for them) ──
ALTER TABLE public.couple_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_invitations_select_inviter" ON public.couple_invitations;
CREATE POLICY "couple_invitations_select_inviter"
  ON public.couple_invitations FOR SELECT
  USING (public.is_couple_member(couple_id) OR public.is_admin());

DROP POLICY IF EXISTS "couple_invitations_update_inviter" ON public.couple_invitations;
CREATE POLICY "couple_invitations_update_inviter"
  ON public.couple_invitations FOR UPDATE
  USING ((inviter_user_id = auth.uid() AND status = 'pending') OR public.is_admin())
  WITH CHECK ((inviter_user_id = auth.uid()) OR public.is_admin());

-- ── FUNCTIONS ───────────────────────────────────────────────
-- [FIX] search_path includes `extensions` so gen_random_bytes() resolves.
CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
$$;

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

  SELECT EXISTS (SELECT 1 FROM public.couple_members WHERE user_id = v_user_id)
    INTO v_is_already_member;
  IF v_is_already_member THEN
    RAISE EXCEPTION 'user already in a couple';
  END IF;

  SELECT * INTO v_invite FROM public.couple_invitations WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;
  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation status %', v_invite.status;
  END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE public.couple_invitations SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'invitation expired';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  INSERT INTO public.couple_members (couple_id, user_id, role)
  VALUES (v_invite.couple_id, v_user_id, 'partner');

  UPDATE public.couple_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by_user_id = v_user_id
  WHERE id = v_invite.id;

  RETURN v_invite.couple_id;
END;
$$;

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
    UPDATE public.couple_invitations SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now()
    RETURNING id
  )
  SELECT count(*)::int INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

COMMIT;

-- PostgREST caches the schema; without this the API keeps reporting the table
-- as missing for up to a few minutes.
NOTIFY pgrst, 'reload schema';

-- ── VERIFY AFTER RUNNING ────────────────────────────────────
-- SELECT to_regclass('public.couple_invitations');            -- expect: couple_invitations
-- SELECT public.generate_invitation_token();                  -- expect: a 43-char token
-- Then load https://mioshy.com/he/invite/whatever — expect the
-- "invitation not found" screen, NOT a 500.
