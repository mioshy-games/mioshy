-- 081_default_coach.sql
--
-- Phase 14 — promote a single profile to "default coach". Every couple
-- (existing + new) is auto-linked to this coach via expert_couples, so:
--
--   - The user-facing /my/journey surface always has a face + name to
--     show (the "Yitzhak" persona until you reassign).
--   - The coach dashboard /dashboard/my-clients lists every couple
--     under this coach by default — no manual link step per couple.
--
-- Mechanics:
--   1. ALTER profiles ADD COLUMN is_default_coach
--      → partial UNIQUE index ensures only one row is ever the default.
--   2. UPDATE for itzik@uxellent.com:
--        is_default_coach = true
--        coach_avatar_url = '/images/yitzhak.webp' (only if NULL/empty)
--      The other coach_* fields (display name, bio) are left alone so
--      anything filled via /dashboard/coach-profile sticks.
--   3. Backfill: every existing couple without an active expert link
--      gets linked to the default coach.
--   4. Trigger: every new couple inserted from now on is auto-linked
--      to whoever is_default_coach = true at that moment.
--
-- Idempotent on re-run.

BEGIN;

-- ── 1. Column + uniqueness ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_default_coach BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_default_coach_unique
  ON public.profiles ((is_default_coach))
  WHERE is_default_coach = true;

COMMENT ON COLUMN public.profiles.is_default_coach IS
  'Phase 14 — when true, this profile is the system-wide default coach. Auto-linked to every couple that has no active expert. Only one row may be true (enforced by profiles_default_coach_unique).';

-- ── 2. Set itzik as the default + ensure avatar is wired ─────────────
-- profiles has no email column — email lives on auth.users. Join via
-- profiles.id = auth.users.id. If the user doesn't exist yet (fresh DB),
-- this is a no-op and the rest of the migration still runs.
UPDATE public.profiles p
SET
  is_default_coach = true,
  coach_avatar_url = COALESCE(NULLIF(TRIM(p.coach_avatar_url), ''), '/images/yitzhak.webp')
FROM auth.users u
WHERE p.id = u.id
  AND u.email = 'mioshyoffice@gmail.com';

-- ── 3. Backfill existing couples ─────────────────────────────────────
-- For every couple that has no active expert link, insert one to the
-- default coach. ON CONFLICT to handle re-runs safely (UNIQUE on
-- (expert_id, couple_id)).
WITH default_coach AS (
  SELECT id FROM public.profiles WHERE is_default_coach = true LIMIT 1
)
INSERT INTO public.expert_couples (expert_id, couple_id, is_active, created_at, notes)
SELECT
  dc.id,
  c.id,
  true,
  now(),
  'auto-linked: default coach (migration 081)'
FROM public.couples c
CROSS JOIN default_coach dc
WHERE NOT EXISTS (
  SELECT 1 FROM public.expert_couples ec
  WHERE ec.couple_id = c.id AND ec.is_active = true
)
ON CONFLICT (expert_id, couple_id) DO NOTHING;

-- ── 4. Trigger: auto-link every new couple to the default coach ──────
CREATE OR REPLACE FUNCTION public.auto_link_new_couple_to_default_coach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_id UUID;
BEGIN
  SELECT id INTO v_default_id
  FROM public.profiles
  WHERE is_default_coach = true
  LIMIT 1;

  IF v_default_id IS NOT NULL THEN
    INSERT INTO public.expert_couples (expert_id, couple_id, is_active, created_at, notes)
    VALUES (v_default_id, NEW.id, true, now(), 'auto-linked: default coach (trigger)')
    ON CONFLICT (expert_id, couple_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_link_new_couple_to_default_coach_trigger ON public.couples;
CREATE TRIGGER auto_link_new_couple_to_default_coach_trigger
  AFTER INSERT ON public.couples
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_new_couple_to_default_coach();

COMMENT ON FUNCTION public.auto_link_new_couple_to_default_coach IS
  'Phase 14 — fires on couples INSERT. Looks up the row in profiles where is_default_coach=true and creates an active expert_couples link. No-op if no default coach is configured.';

COMMIT;

NOTIFY pgrst, 'reload schema';
