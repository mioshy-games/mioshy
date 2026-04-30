-- ===========================================================================
-- 043_expert_couples.sql
-- ===========================================================================
-- "Mioshy Coaching" foundation: link an expert (a profile with role='expert'
-- or role='admin') to one or more couples. Powers the /dashboard/my-clients
-- dashboard so each expert sees only the couples they're responsible for.
--
-- Future migrations will build on this:
--   - per-partner content visibility (who sees what within a couple)
--   - expert notes table (private observation log per couple)
--   - automation rules keyed on expert + diagnostic axis
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. expert_couples — join table linking experts to their assigned couples
-- ---------------------------------------------------------------------------
-- A row means: this expert is responsible for this couple's coaching path.
-- An expert may have many couples; a couple may (in theory) have multiple
-- experts on it (e.g. handoff, second opinion). The pair is unique to keep
-- the relationship explicit.
CREATE TABLE IF NOT EXISTS public.expert_couples (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_id   uuid        NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  notes       text,
  UNIQUE (expert_id, couple_id)
);

CREATE INDEX IF NOT EXISTS expert_couples_expert_idx
  ON public.expert_couples (expert_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS expert_couples_couple_idx
  ON public.expert_couples (couple_id) WHERE is_active = true;


-- ---------------------------------------------------------------------------
-- 2. Role helpers
-- ---------------------------------------------------------------------------
-- 'expert' is now a recognized role in profiles.role. We don't add a check
-- constraint (the column is free-form text) but we add a helper to test it
-- consistently across RLS and server code.
CREATE OR REPLACE FUNCTION public.is_expert()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('expert', 'admin')
  );
$$;

-- "Is the current user an expert linked to this couple?" — used by RLS on
-- downstream tables (assignments visibility, notes, content, etc.).
CREATE OR REPLACE FUNCTION public.is_expert_for_couple(p_couple_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expert_couples ec
    WHERE ec.couple_id = p_couple_id
      AND ec.expert_id = auth.uid()
      AND ec.is_active = true
  );
$$;


-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.expert_couples ENABLE ROW LEVEL SECURITY;

-- Admins see everything
DROP POLICY IF EXISTS "expert_couples_select_admin" ON public.expert_couples;
CREATE POLICY "expert_couples_select_admin"
  ON public.expert_couples FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Experts see their own links
DROP POLICY IF EXISTS "expert_couples_select_own" ON public.expert_couples;
CREATE POLICY "expert_couples_select_own"
  ON public.expert_couples FOR SELECT
  TO authenticated
  USING (expert_id = auth.uid());

-- Couple members see who their expert is (read-only)
DROP POLICY IF EXISTS "expert_couples_select_couple_member" ON public.expert_couples;
CREATE POLICY "expert_couples_select_couple_member"
  ON public.expert_couples FOR SELECT
  TO authenticated
  USING (public.is_couple_member(couple_id));

-- Only admins can create/modify/delete the link itself.
-- (Experts can't unilaterally claim couples; admin assigns them.)
DROP POLICY IF EXISTS "expert_couples_admin_write" ON public.expert_couples;
CREATE POLICY "expert_couples_admin_write"
  ON public.expert_couples FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- ---------------------------------------------------------------------------
-- 4. Comments — DB-level documentation
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.expert_couples IS
  'Links a coaching expert (profiles.role=expert|admin) to a couple they manage.';
COMMENT ON COLUMN public.expert_couples.expert_id IS
  'auth.users.id of the expert; must have profiles.role IN (expert, admin) to access /dashboard/my-clients.';
COMMENT ON COLUMN public.expert_couples.couple_id IS
  'couples.id this expert is responsible for. Soft-delete via is_active=false.';
COMMENT ON COLUMN public.expert_couples.notes IS
  'Free-form admin note (e.g. why this expert was chosen for this couple). Not visible to the couple.';
