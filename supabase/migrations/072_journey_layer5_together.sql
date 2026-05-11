-- 072_journey_layer5_together.sql
--
-- Layer 5 (Together) — the couple-shared surface.
--
-- Two new tables + one column:
--   1. journey_couple_channels — one per couple, marker for "this
--      couple has a shared channel." Mirrors journey_user_channels.
--   2. journey_couple_channel_messages — couple-scoped messages.
--      Both partners + assigned experts can read. Sister to
--      journey_messages but explicitly couple-keyed so privacy
--      semantics stay clear: per-user channels are PRIVATE to one
--      partner; couple channel is SHARED.
--   3. couples.started_journey_at — anchor for couple-anniversary
--      milestones (30/90/365 days). Defaults to created_at on
--      backfill.
--
-- Idempotent on re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. couples.started_journey_at
-- ---------------------------------------------------------------------------

ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS started_journey_at TIMESTAMPTZ;

-- Backfill: anything already in the system gets the couple's
-- created_at as its journey start. Future couples get stamped
-- at journey-purchase time (assignJourneyOnPurchase will be
-- updated as a follow-up; for the first ship, created_at is fine).
UPDATE public.couples
SET started_journey_at = created_at
WHERE started_journey_at IS NULL;

COMMENT ON COLUMN public.couples.started_journey_at IS
  'Layer 5 anchor for couple-anniversary milestones (30/90/365 days). '
  'Falls back to couples.created_at when not explicitly set.';

-- ---------------------------------------------------------------------------
-- 2. journey_couple_channels
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_couple_channels (
  couple_id        UUID PRIMARY KEY REFERENCES public.couples(id) ON DELETE CASCADE,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_couple_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_couple_channels_member_read ON public.journey_couple_channels;
CREATE POLICY journey_couple_channels_member_read
  ON public.journey_couple_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = journey_couple_channels.couple_id
        AND cm.user_id   = auth.uid()
    )
  );

DROP POLICY IF EXISTS journey_couple_channels_expert_read ON public.journey_couple_channels;
CREATE POLICY journey_couple_channels_expert_read
  ON public.journey_couple_channels FOR SELECT
  USING (public.is_expert_for_couple(couple_id));

DROP POLICY IF EXISTS journey_couple_channels_admin_all ON public.journey_couple_channels;
CREATE POLICY journey_couple_channels_admin_all
  ON public.journey_couple_channels FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_couple_channels IS
  'One row per couple — marks that the shared couple channel exists. last_message_at drives sort/badge logic on /my/journey/together.';

-- ---------------------------------------------------------------------------
-- 3. journey_couple_channel_messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.journey_couple_channel_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id         UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  -- author_user_id NULL means system-generated (rare; reserve for
  -- future automated couple-anniversary celebrations).
  author_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_kind       TEXT NOT NULL CHECK (author_kind IN ('partner','expert','system')),
  -- For expert messages: the specific coach who wrote it (Layer 2
  -- pattern). NULL for partner/system messages.
  expert_signed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body              TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 4000),
  reactions         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS journey_couple_channel_messages_couple_idx
  ON public.journey_couple_channel_messages (couple_id, created_at DESC);

ALTER TABLE public.journey_couple_channel_messages ENABLE ROW LEVEL SECURITY;

-- Both partners read everything in their couple channel.
DROP POLICY IF EXISTS journey_couple_channel_messages_member_read
  ON public.journey_couple_channel_messages;
CREATE POLICY journey_couple_channel_messages_member_read
  ON public.journey_couple_channel_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = journey_couple_channel_messages.couple_id
        AND cm.user_id   = auth.uid()
    )
  );

-- Either partner can post (author_user_id must be themselves).
DROP POLICY IF EXISTS journey_couple_channel_messages_member_insert
  ON public.journey_couple_channel_messages;
CREATE POLICY journey_couple_channel_messages_member_insert
  ON public.journey_couple_channel_messages FOR INSERT
  WITH CHECK (
    author_user_id = auth.uid()
    AND author_kind = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.couple_members cm
      WHERE cm.couple_id = journey_couple_channel_messages.couple_id
        AND cm.user_id   = auth.uid()
    )
  );

-- Authors can edit/delete their own.
DROP POLICY IF EXISTS journey_couple_channel_messages_author_update
  ON public.journey_couple_channel_messages;
CREATE POLICY journey_couple_channel_messages_author_update
  ON public.journey_couple_channel_messages FOR UPDATE
  USING (author_user_id = auth.uid())
  WITH CHECK (author_user_id = auth.uid());

DROP POLICY IF EXISTS journey_couple_channel_messages_author_delete
  ON public.journey_couple_channel_messages;
CREATE POLICY journey_couple_channel_messages_author_delete
  ON public.journey_couple_channel_messages FOR DELETE
  USING (author_user_id = auth.uid());

-- Experts read everything for their assigned couples.
DROP POLICY IF EXISTS journey_couple_channel_messages_expert_read
  ON public.journey_couple_channel_messages;
CREATE POLICY journey_couple_channel_messages_expert_read
  ON public.journey_couple_channel_messages FOR SELECT
  USING (public.is_expert_for_couple(couple_id));

-- Admin all-access.
DROP POLICY IF EXISTS journey_couple_channel_messages_admin_all
  ON public.journey_couple_channel_messages;
CREATE POLICY journey_couple_channel_messages_admin_all
  ON public.journey_couple_channel_messages FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.journey_couple_channel_messages IS
  'Layer 5 — the SHARED couple channel. Distinct from journey_messages.channel_user_id (which is per-user-private). Both partners read; either partner posts; experts post via app/actions/journey-couple-channel.ts (service role insert with author_kind=expert).';

-- ---------------------------------------------------------------------------
-- 4. Coach library — accept 'couple_message' kind
-- ---------------------------------------------------------------------------
-- Already permissive: kind CHECK uses ('saved_reply','content_pin','couple_note').
-- Add 'couple_message' so coaches can save reusable couple-level notes.

DO $$
BEGIN
  -- Drop the existing CHECK constraint if it exists; re-add with new value.
  -- Different Postgres versions name auto-generated checks differently;
  -- iterate any matching constraint.
  PERFORM 1
  FROM pg_constraint
  WHERE conrelid = 'public.journey_expert_library'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%saved_reply%';

  -- Drop all CHECK constraints on 'kind' column matching the old set.
  EXECUTE (
    SELECT string_agg(
      'ALTER TABLE public.journey_expert_library DROP CONSTRAINT ' || quote_ident(conname) || ';',
      ' '
    )
    FROM pg_constraint
    WHERE conrelid = 'public.journey_expert_library'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%saved_reply%'
  );
END$$;

ALTER TABLE public.journey_expert_library
  ADD CONSTRAINT journey_expert_library_kind_check
  CHECK (kind IN ('saved_reply','content_pin','couple_note','couple_message'));

COMMIT;

NOTIFY pgrst, 'reload schema';
