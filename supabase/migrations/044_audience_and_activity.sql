-- ===========================================================================
-- 044_audience_and_activity.sql
-- ===========================================================================
-- Adds three things on top of the journey content system:
--
--   1. Per-item / per-scheduled-item AUDIENCE
--      Each item (and each materialized scheduled row) targets one of:
--          'both'     - visible to both partners (default, keeps current
--                       behavior for everything already in the DB)
--          'owner'    - only the couple_members.role='owner' partner sees it
--          'partner'  - only the couple_members.role='partner' partner sees it
--      Solo (user-owned) assignments always behave as 'both'.
--
--   2. profiles.gender (optional, free-form: 'male'|'female'|'other'|NULL)
--      Lets the expert label which partner is which when designing audience-
--      aware content. Display only - the audience filter is structural,
--      driven by couple_members.role.
--
--   3. journey_user_activity - append-only log of meaningful user actions on
--      the journey timeline (completion, response posted, item opened).
--      Powers the "history of actions" + "what to do now" surface and gives
--      experts a real audit log of what the couple actually did.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. AUDIENCE on items + scheduled rows
-- ---------------------------------------------------------------------------

ALTER TABLE public.journey_items
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'both';

ALTER TABLE public.journey_items
  DROP CONSTRAINT IF EXISTS journey_items_audience_check;
ALTER TABLE public.journey_items
  ADD CONSTRAINT journey_items_audience_check
  CHECK (audience IN ('both', 'owner', 'partner'));


ALTER TABLE public.journey_scheduled_items
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'both';

ALTER TABLE public.journey_scheduled_items
  DROP CONSTRAINT IF EXISTS journey_scheduled_items_audience_check;
ALTER TABLE public.journey_scheduled_items
  ADD CONSTRAINT journey_scheduled_items_audience_check
  CHECK (audience IN ('both', 'owner', 'partner'));

-- Backfill existing scheduled rows from their item's audience. Existing data
-- defaults to 'both' so it's idempotent and non-disruptive.
UPDATE public.journey_scheduled_items s
SET audience = i.audience
FROM public.journey_items i
WHERE s.item_id = i.id
  AND s.audience = 'both'
  AND i.audience <> 'both';

CREATE INDEX IF NOT EXISTS journey_scheduled_items_audience_idx
  ON public.journey_scheduled_items (audience);


-- ---------------------------------------------------------------------------
-- 2. profiles.gender - display label for the expert UI
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'other'));


-- ---------------------------------------------------------------------------
-- 3. journey_user_activity - audit log of timeline actions
-- ---------------------------------------------------------------------------
-- Append-only. Every meaningful interaction the user has with the timeline
-- writes a row. Reads surface in two places:
--   • the user's "Recent activity" panel on /journey/timeline
--   • the expert's couple-detail page so the expert sees what the partners
--     have been doing without needing to chase them.
--
-- Schema is intentionally narrow: scheduled_item_id + verb + payload.
-- Verbs ('item_opened' | 'item_completed' | 'response_posted' |
-- 'response_deleted'), payload free-form jsonb for verb-specific extras
-- (e.g. response privacy flag, completion source).
CREATE TABLE IF NOT EXISTS public.journey_user_activity (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  couple_id          uuid         REFERENCES public.couples(id) ON DELETE CASCADE,
  scheduled_item_id  uuid         REFERENCES public.journey_scheduled_items(id) ON DELETE CASCADE,
  verb               text         NOT NULL,
  payload            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_user_activity
  DROP CONSTRAINT IF EXISTS journey_user_activity_verb_check;
ALTER TABLE public.journey_user_activity
  ADD CONSTRAINT journey_user_activity_verb_check
  CHECK (verb IN (
    'item_opened',
    'item_completed',
    'item_uncompleted',
    'response_posted',
    'response_deleted'
  ));

CREATE INDEX IF NOT EXISTS journey_user_activity_user_idx
  ON public.journey_user_activity (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS journey_user_activity_couple_idx
  ON public.journey_user_activity (couple_id, created_at DESC)
  WHERE couple_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS journey_user_activity_scheduled_idx
  ON public.journey_user_activity (scheduled_item_id);


-- RLS - users see their own + partner's events; experts see their couples';
-- admins see everything; nobody but service-role inserts (server actions
-- write through the service-role client).
ALTER TABLE public.journey_user_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journey_user_activity_select_self" ON public.journey_user_activity;
CREATE POLICY "journey_user_activity_select_self"
  ON public.journey_user_activity FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "journey_user_activity_select_couple" ON public.journey_user_activity;
CREATE POLICY "journey_user_activity_select_couple"
  ON public.journey_user_activity FOR SELECT
  TO authenticated
  USING (couple_id IS NOT NULL AND public.is_couple_member(couple_id));

DROP POLICY IF EXISTS "journey_user_activity_select_expert" ON public.journey_user_activity;
CREATE POLICY "journey_user_activity_select_expert"
  ON public.journey_user_activity FOR SELECT
  TO authenticated
  USING (couple_id IS NOT NULL AND public.is_expert_for_couple(couple_id));

DROP POLICY IF EXISTS "journey_user_activity_select_admin" ON public.journey_user_activity;
CREATE POLICY "journey_user_activity_select_admin"
  ON public.journey_user_activity FOR SELECT
  TO authenticated
  USING (public.is_admin());


-- ---------------------------------------------------------------------------
-- 4. Documentation
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.journey_items.audience IS
  'Targeted partner: both | owner | partner. Solo assignments behave as both.';
COMMENT ON COLUMN public.journey_scheduled_items.audience IS
  'Materialized audience copy. The expert can override per-couple via the per-couple CSV upload.';
COMMENT ON COLUMN public.profiles.gender IS
  'Display label for the expert UI: male | female | other | NULL. Audience filtering uses couple_members.role, not this field.';
COMMENT ON TABLE public.journey_user_activity IS
  'Append-only audit log of timeline interactions. Drives the user "recent activity" panel and the expert couple-detail timeline preview.';
