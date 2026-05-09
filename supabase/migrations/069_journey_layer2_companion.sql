-- 069_journey_layer2_companion.sql
--
-- Layer 2 (Companion) infrastructure. Single migration that lights up
-- everything the layer needs:
--
--   1. profiles.coach_*  — the coach's user-facing persona (display
--      name, avatar, short bio). Distinct from the user's own
--      first/last name on profiles, which is private.
--   2. journey_messages.expert_signed_by — FK back to the specific
--      coach who wrote the reply. Drives the "your coach Yael said"
--      affordance in the user's thread instead of "מיאושי" generic.
--   3. journey_expert_library — per-coach saved snippets (replies +
--      content suggestions + couple notes). Powers /library popover
--      in the compose box.
--   4. journey_assignments.track_role — 'primary' | 'paused' |
--      'archived'. Lets a coach switch a couple between tracks
--      without losing history (paused tracks stay queryable for
--      audit + downstream "previous track" surfaces).
--   5. journey_track_switches — append-only audit of every
--      track-switch event for compliance + post-mortem.
--   6. journey_view_as_audit — every coach impersonation logged.
--      Required by the access-control story; never assume the audit
--      is implicit.
--
-- All RLS-tightened. All idempotent on re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. profiles.coach_* — coach persona
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_display_name_he TEXT,
  ADD COLUMN IF NOT EXISTS coach_display_name_en TEXT,
  ADD COLUMN IF NOT EXISTS coach_avatar_url      TEXT,
  ADD COLUMN IF NOT EXISTS coach_short_bio_he    TEXT,
  ADD COLUMN IF NOT EXISTS coach_short_bio_en    TEXT;

COMMENT ON COLUMN public.profiles.coach_display_name_he IS
  'Hebrew first name shown to clients on every coach surface (replies, bio, first-session intro). Distinct from full_name (private).';
COMMENT ON COLUMN public.profiles.coach_display_name_en IS
  'English first name shown to clients. Falls back to coach_display_name_he when absent.';
COMMENT ON COLUMN public.profiles.coach_avatar_url IS
  'Public URL to the coach''s avatar (Supabase storage). Optional — UI falls back to colored initial.';
COMMENT ON COLUMN public.profiles.coach_short_bio_he IS
  'Two-line warm intro shown once per session on first message tap. Hebrew. Max ~200 chars.';

-- ---------------------------------------------------------------------------
-- 2. journey_messages.expert_signed_by
-- ---------------------------------------------------------------------------

ALTER TABLE public.journey_messages
  ADD COLUMN IF NOT EXISTS expert_signed_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS journey_messages_expert_signed_by_idx
  ON public.journey_messages (expert_signed_by);

-- Backfill expert messages with their author as the signer. Future
-- messages get this from the action layer at write time.
UPDATE public.journey_messages
SET expert_signed_by = author_user_id
WHERE author_kind = 'expert'
  AND expert_signed_by IS NULL;

COMMENT ON COLUMN public.journey_messages.expert_signed_by IS
  'Layer 2 — the specific coach who wrote this reply. Drives persona display. NULL only on legacy rows the backfill could not attribute.';

-- ---------------------------------------------------------------------------
-- 3. journey_expert_library
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_expert_library (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'saved_reply' | 'content_pin' | 'couple_note'
  kind          TEXT NOT NULL CHECK (kind IN ('saved_reply','content_pin','couple_note')),
  -- Bilingual labels — coach picks once, system surfaces by locale.
  label         TEXT NOT NULL,
  body_he       TEXT NOT NULL,
  body_en       TEXT,
  -- Free-form tags ("conflict", "intimacy", "first-week"...) for the
  -- /library popover filter.
  tags          TEXT[] NOT NULL DEFAULT '{}',
  -- For couple_note kind: the couple this note belongs to. NULL for
  -- the other two kinds.
  couple_id     UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  -- Use count helps the library auto-rank "what works" for this coach.
  use_count     INTEGER NOT NULL DEFAULT 0,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journey_expert_library_expert_idx
  ON public.journey_expert_library (expert_id);
CREATE INDEX IF NOT EXISTS journey_expert_library_kind_idx
  ON public.journey_expert_library (expert_id, kind);
CREATE INDEX IF NOT EXISTS journey_expert_library_tags_idx
  ON public.journey_expert_library USING gin (tags);

ALTER TABLE public.journey_expert_library ENABLE ROW LEVEL SECURITY;

-- Coaches see + write only their own library entries.
CREATE POLICY journey_expert_library_owner_all
  ON public.journey_expert_library FOR ALL
  USING (expert_id = auth.uid())
  WITH CHECK (expert_id = auth.uid());

-- Admins see everything.
CREATE POLICY journey_expert_library_admin_all
  ON public.journey_expert_library FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_expert_library IS
  'Per-coach personal library: saved replies, content pins, couple notes. Drives /library popover and couple-context note surface in Coaching Room.';

-- Touch trigger
CREATE OR REPLACE FUNCTION public.tg_journey_expert_library_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey_expert_library_touch
  ON public.journey_expert_library;
CREATE TRIGGER journey_expert_library_touch
  BEFORE UPDATE ON public.journey_expert_library
  FOR EACH ROW EXECUTE FUNCTION public.tg_journey_expert_library_touch();

-- ---------------------------------------------------------------------------
-- 4. journey_assignments.track_role
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journey_assignments'
      AND column_name = 'track_role'
  ) THEN
    ALTER TABLE public.journey_assignments
      ADD COLUMN track_role TEXT NOT NULL DEFAULT 'primary'
        CHECK (track_role IN ('primary','paused','archived'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS journey_assignments_track_role_idx
  ON public.journey_assignments (track_role) WHERE is_active = true;

COMMENT ON COLUMN public.journey_assignments.track_role IS
  'Layer 2 — tracks how a switched-from assignment is treated. primary=current; paused=user kept history; archived=admin retired. Only one primary per (owner, source_kind=program).';

-- ---------------------------------------------------------------------------
-- 5. journey_track_switches — audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_track_switches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Same polymorphic owner as journey_assignments.
  user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  couple_id          UUID REFERENCES public.couples(id) ON DELETE SET NULL,
  -- Old assignment going to paused/archived; new assignment becoming primary.
  from_assignment_id UUID REFERENCES public.journey_assignments(id) ON DELETE SET NULL,
  to_assignment_id   UUID REFERENCES public.journey_assignments(id) ON DELETE SET NULL,
  -- Slugs of from/to programs for fast filtering even when assignments
  -- are deleted.
  from_program_slug  TEXT,
  to_program_slug    TEXT,
  -- The coach who made the call.
  switched_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason             TEXT,
  -- Snapshot of how many future-locked items got cancelled vs preserved.
  items_cancelled    INTEGER NOT NULL DEFAULT 0,
  items_preserved    INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT track_switch_owner_present CHECK (user_id IS NOT NULL OR couple_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS journey_track_switches_couple_idx
  ON public.journey_track_switches (couple_id);
CREATE INDEX IF NOT EXISTS journey_track_switches_user_idx
  ON public.journey_track_switches (user_id);
CREATE INDEX IF NOT EXISTS journey_track_switches_coach_idx
  ON public.journey_track_switches (switched_by);

ALTER TABLE public.journey_track_switches ENABLE ROW LEVEL SECURITY;

-- Coaches see switches for their assigned couples.
CREATE POLICY journey_track_switches_expert_read
  ON public.journey_track_switches FOR SELECT
  USING (
    couple_id IS NOT NULL
    AND public.is_expert_for_couple(couple_id)
  );

-- Admins all access.
CREATE POLICY journey_track_switches_admin_all
  ON public.journey_track_switches FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_track_switches IS
  'Append-only audit of mid-journey track switches. Drives "previously on intimacy track" surfaces + compliance.';

-- ---------------------------------------------------------------------------
-- 6. journey_view_as_audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_view_as_audit (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The coach who entered impersonation mode.
  coach_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  -- The user being viewed-as.
  viewed_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Optional couple context, when the view-as was launched from a couple page.
  couple_id          UUID REFERENCES public.couples(id) ON DELETE SET NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Closed when the impersonation cookie is cleared. Open rows mean
  -- the coach is currently viewing-as. NULL ended_at + ttl handled at
  -- read time.
  ended_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS journey_view_as_audit_coach_idx
  ON public.journey_view_as_audit (coach_id, started_at DESC);
CREATE INDEX IF NOT EXISTS journey_view_as_audit_user_idx
  ON public.journey_view_as_audit (viewed_user_id, started_at DESC);

ALTER TABLE public.journey_view_as_audit ENABLE ROW LEVEL SECURITY;

-- Coaches see their own view-as history.
CREATE POLICY journey_view_as_audit_coach_read
  ON public.journey_view_as_audit FOR SELECT
  USING (coach_id = auth.uid());

-- Coaches insert + close their own rows. Inserts must reference an
-- assigned couple so a coach can't impersonate users outside their
-- assigned couples.
CREATE POLICY journey_view_as_audit_coach_insert
  ON public.journey_view_as_audit FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND (
      couple_id IS NULL  -- admin-only path
      OR public.is_expert_for_couple(couple_id)
    )
  );

CREATE POLICY journey_view_as_audit_coach_update
  ON public.journey_view_as_audit FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Admins see everything.
CREATE POLICY journey_view_as_audit_admin_all
  ON public.journey_view_as_audit FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_view_as_audit IS
  'Every coach impersonation logged. Open rows = currently viewing-as. Required for compliance — never make impersonation implicit.';

COMMIT;

NOTIFY pgrst, 'reload schema';
