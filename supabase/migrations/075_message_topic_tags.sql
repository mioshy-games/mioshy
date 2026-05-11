-- 075_message_topic_tags.sql
--
-- Layer-3 follow-up — admin expert-message tracker.
--
-- Adds a `topic_tags TEXT[]` column to both message tables so admins
-- can filter and aggregate expert messages by topic. Tags are
-- stamped from the source library row when a coach inserts from
-- their saved library or a starter template.
--
-- Idempotent. Defaults are empty arrays so pre-existing rows show
-- as "untagged" in the admin UI without backfill.

BEGIN;

ALTER TABLE public.journey_messages
  ADD COLUMN IF NOT EXISTS topic_tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.journey_couple_channel_messages
  ADD COLUMN IF NOT EXISTS topic_tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS journey_messages_topic_tags_idx
  ON public.journey_messages USING gin (topic_tags);

CREATE INDEX IF NOT EXISTS journey_couple_channel_messages_topic_tags_idx
  ON public.journey_couple_channel_messages USING gin (topic_tags);

COMMENT ON COLUMN public.journey_messages.topic_tags IS
  'Layer-3 admin tracker — tags carried from the source library row when a coach inserts from saved replies. Drives /dashboard/journey/expert-messages filters.';

COMMENT ON COLUMN public.journey_couple_channel_messages.topic_tags IS
  'Layer-3 admin tracker — tags carried from the source library row when a coach inserts from saved couple-message templates.';

COMMIT;

NOTIFY pgrst, 'reload schema';
