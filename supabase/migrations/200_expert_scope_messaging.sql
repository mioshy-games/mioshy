-- ─────────────────────────────────────────────────────────────────────────────
-- 200  Scope expert read access to their own couples only
--      Audit 2026-08-05, finding CRITICAL #4
-- ─────────────────────────────────────────────────────────────────────────────
-- Run in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/kphfmbqqafrvuzmiotsz/sql/new
--
-- The problem: 056 wrote `public.is_expert()` into the read policies of
-- journey_messages, journey_user_channels and journey_notifications.
-- is_expert() (043:45) returns true for ANY profile with role IN
-- ('expert','admin') — it takes no couple argument. So every coach could read
-- every couple's intimate messages straight off the REST API with their own
-- token. is_expert_for_couple(uuid) (043:62) is the correct, couple-scoped
-- helper and is already used by 10 other policies.
--
-- BLAST RADIUS: none in the UI. Every application read of these three tables
-- goes through a service-role client (verified across the repo 2026-08-06),
-- which bypasses RLS. The coach dashboard resolves its clients through
-- expert_couples → couple_members in lib/experts/queries.ts and is unaffected.
-- These policies gate direct PostgREST access with a user's own JWT — which is
-- exactly the vulnerability being closed.
--
-- MAPPING (verified against the migrations, not assumed):
--   journey_messages has a XOR: scheduled_item_id OR channel_user_id (056).
--     · per-item  → journey_scheduled_items.assignment_id
--                   → journey_assignments (035)
--     · channel   → channel_user_id is a user id → couple_members
--   journey_assignments ALSO has a XOR: user_id OR couple_id (035:196).
--     A solo assignment carries couple_id = NULL, so scoping on
--     is_expert_for_couple(a.couple_id) alone would silently drop every solo
--     journey. Both branches are handled below.
--   journey_user_channels is keyed by user_id → couple_members.
--   journey_notifications: recipient_user_id → couple_members. Rows with
--     recipient_kind 'expert_pool'/'admin_pool' carry recipient_user_id = NULL
--     and cannot be tied to a couple; their payload contains a `preview`
--     excerpt of the user's message, so they become admin-only (decision
--     confirmed with Itzik 2026-08-06).


-- ── Helper: is the current user an expert for this USER's couple? ────────────
-- Mirrors is_expert_for_couple(uuid) (043:62) but starts from a user id, for
-- the surfaces that reference a person rather than a couple. Same SECURITY
-- DEFINER + fixed search_path as its sibling.
CREATE OR REPLACE FUNCTION public.is_expert_for_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.couple_members cm
    JOIN public.expert_couples ec ON ec.couple_id = cm.couple_id
    WHERE cm.user_id  = p_user_id
      AND ec.expert_id = auth.uid()
      AND ec.is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_expert_for_user(uuid) IS
  'True when the calling user is an active expert on a couple that p_user_id belongs to. Audit 2026-08-05 CRITICAL #4.';


-- ── journey_user_channels ────────────────────────────────────────────────────
DROP POLICY IF EXISTS journey_user_channels_read ON public.journey_user_channels;

CREATE POLICY journey_user_channels_read ON public.journey_user_channels
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR public.is_expert_for_user(user_id)
  );


-- ── journey_messages ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS journey_messages_read ON public.journey_messages;

CREATE POLICY journey_messages_read ON public.journey_messages
  FOR SELECT USING (
    -- Author always sees their own message.
    author_user_id = auth.uid()
    OR public.is_admin()

    -- General channel: the channel owner (solo by design, per Itzik #7).
    OR (channel_user_id IS NOT NULL AND channel_user_id = auth.uid())

    -- General channel: an expert assigned to that user's couple.
    OR (channel_user_id IS NOT NULL AND public.is_expert_for_user(channel_user_id))

    -- Per-item: anyone who can see the underlying scheduled item. Private rows
    -- stay author-only (covered above). Unchanged from 056.
    OR (
      scheduled_item_id IS NOT NULL
      AND is_private = false
      AND EXISTS (
        SELECT 1
        FROM public.journey_scheduled_items s
        JOIN public.journey_assignments a ON a.id = s.assignment_id
        WHERE s.id = journey_messages.scheduled_item_id
          AND (
            a.user_id = auth.uid()
            OR a.couple_id IN (
              SELECT couple_id FROM public.couple_members WHERE user_id = auth.uid()
            )
          )
      )
    )

    -- Per-item: an expert assigned to that item's couple. Private rows stay
    -- visible to the assigned expert — that is the clinician's existing
    -- visibility, now narrowed from "every expert" to "this couple's expert".
    -- Both arms of the journey_assignments XOR are handled: couple-scoped
    -- assignments via couple_id, solo assignments via the owner's membership.
    OR (
      scheduled_item_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.journey_scheduled_items s
        JOIN public.journey_assignments a ON a.id = s.assignment_id
        WHERE s.id = journey_messages.scheduled_item_id
          AND (
            (a.couple_id IS NOT NULL AND public.is_expert_for_couple(a.couple_id))
            OR (a.user_id IS NOT NULL AND public.is_expert_for_user(a.user_id))
          )
      )
    )
  );


-- ── journey_notifications ────────────────────────────────────────────────────
DROP POLICY IF EXISTS journey_notifications_read ON public.journey_notifications;

CREATE POLICY journey_notifications_read ON public.journey_notifications
  FOR SELECT USING (
    (recipient_user_id IS NOT NULL AND recipient_user_id = auth.uid())
    OR public.is_admin()
    -- Expert: only for recipients in one of their own couples. Pool rows
    -- (recipient_user_id IS NULL) are admin-only — they cannot be tied to a
    -- couple and their payload carries a preview of the user's message.
    OR (recipient_user_id IS NOT NULL AND public.is_expert_for_user(recipient_user_id))
  );
