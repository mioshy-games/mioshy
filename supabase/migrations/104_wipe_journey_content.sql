-- ============================================================
-- Migration 104 — wipe journey content for fresh upload
-- ============================================================
-- Itzik 2026-06-01: clean slate for re-uploading the Mioshy
-- curriculum from scratch via /dashboard/journey/items.
--
-- WHAT GETS DELETED
--   • journey_item_responses        — user replies on items
--   • journey_item_completions      — completion timestamps
--   • journey_item_feedback         — 4-button feedback
--   • journey_user_delivered_items  — cadence-dedup table
--   • journey_messages WHERE scheduled_item_id IS NOT NULL
--                                   — per-item threads only.
--                                     General-channel messages
--                                     (channel_user_id) are KEPT.
--   • journey_scheduled_items       — scheduled drops
--   • journey_assignments           — content-level assignments
--   • journey_match_rules           — auto-match rules
--   • journey_items                 — the items themselves
--
-- WHAT STAYS
--   • journey_programs              — top-level container (kept)
--   • journey_categories            — 5 priority domains (kept)
--   • journey_user_priorities       — users' ranking choices (kept)
--   • journeys                      — user journey rows (kept)
--   • journey_responses             — assessment answers (kept)
--   • profiles / auth.users         — accounts (kept)
--   • test_user_invitations         — admin grants (kept)
--
-- Runs in a single transaction. If any step fails the whole thing
-- rolls back. Order respects foreign keys: leaf tables first, then
-- the parent journey_items last.
-- ============================================================

BEGIN;

-- 1. Per-item user data — these tables FK to scheduled_items, items,
--    and to auth.users. Killing the rows first means the cascades
--    don't have to do extra work.
DELETE FROM public.journey_item_responses;
DELETE FROM public.journey_item_completions;
DELETE FROM public.journey_item_feedback;

-- 2. Cadence dedup — keeps track of which items each user already
--    received. After re-upload with fresh ids, this stale list would
--    block legitimate deliveries.
DELETE FROM public.journey_user_delivered_items;

-- 3. Per-item message threads. General-channel messages
--    (channel_user_id IS NOT NULL, scheduled_item_id IS NULL) stay
--    untouched so the expert chat history with users survives.
DELETE FROM public.journey_messages
WHERE scheduled_item_id IS NOT NULL;

-- 4. Scheduled items — the materialised drops linking items to
--    users via assignments. Will be re-materialised by the cadence
--    engine once new items + new assignments exist.
DELETE FROM public.journey_scheduled_items;

-- 5. Assignments — content-level rows that say "this item / category
--    / program is active for this owner". With items gone, these are
--    orphaned anyway; clean them so re-uploads start fresh.
DELETE FROM public.journey_assignments;

-- 6. Match rules — content-level auto-matching. Tied to items via
--    matched_by_rule_id on scheduled_items (already cleared above).
DELETE FROM public.journey_match_rules;

-- 7. The items themselves — last because everything above pointed
--    at them via FKs.
DELETE FROM public.journey_items;

-- 8. Diagnostic — confirm the tables are empty (counts surface in
--    the editor's notice channel; if any non-zero appears the txn
--    rolls back via the assertion).
DO $$
DECLARE
  v_items       BIGINT;
  v_scheduled   BIGINT;
  v_completions BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_items       FROM public.journey_items;
  SELECT COUNT(*) INTO v_scheduled   FROM public.journey_scheduled_items;
  SELECT COUNT(*) INTO v_completions FROM public.journey_item_completions;

  RAISE NOTICE 'After-wipe counts → items=%, scheduled=%, completions=%',
    v_items, v_scheduled, v_completions;

  IF v_items <> 0 OR v_scheduled <> 0 OR v_completions <> 0 THEN
    RAISE EXCEPTION 'Wipe failed — non-zero leftover rows';
  END IF;
END;
$$;

COMMIT;
