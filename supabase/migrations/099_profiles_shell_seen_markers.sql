-- 099_profiles_shell_seen_markers.sql
--
-- Adds two "last-seen" timestamps to profiles so the AppShell can
-- clear nav badges when the user actually opens the relevant surface:
--
--   expert_messages_seen_at   — set when the user opens /my/expert.
--                               Badge for "צ׳אט עם מומחה" subtracts
--                               clinician replies that arrived BEFORE
--                               this timestamp.
--   lessons_seen_at           — set when the user opens /my/lessons.
--                               Badge for "השיעורים שלי" only counts
--                               items unlocked AFTER this timestamp.
--
-- Without these, badges sit on real counts (replies-in-last-30-days,
-- items-unlocked-in-last-24h) that never reach zero until the
-- underlying rows age out — bad UX. With them, opening the page is
-- the implicit "I've seen these" gesture and the badge clears next
-- visit / refresh.
--
-- NULL = "never seen" → the existing recency window applies (30 days
-- for expert, 24 hours for lessons). First open stamps NOW(). The
-- existing badge calculation always picks the MAX(seen_at, recency
-- cutoff) so the badge never re-appears for items already counted.
--
-- Safe to run multiple times — `IF NOT EXISTS` on every ADD COLUMN.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expert_messages_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lessons_seen_at         TIMESTAMPTZ;

-- The shell calls `update profiles set expert_messages_seen_at = now()
-- where id = auth.uid()` from the markExpertSurfaceSeen server action.
-- Existing RLS policy on profiles already lets users update their own
-- row (migration 003 / 004 set this up). No new policy needed.

COMMENT ON COLUMN public.profiles.expert_messages_seen_at IS
  'Last time the user opened /my/expert. The shell uses MAX(this, NOW()-30d) '
  'as the cutoff when counting fresh clinician replies for the nav badge.';

COMMENT ON COLUMN public.profiles.lessons_seen_at IS
  'Last time the user opened /my/lessons. The shell uses MAX(this, NOW()-24h) '
  'as the cutoff when counting fresh unlocked lessons for the nav badge.';

COMMIT;
