-- 079_message_ai_enrichment.sql
--
-- Phase 4 — AI message enrichment. Two new columns on each message
-- table so user messages can be auto-classified by Claude Haiku at
-- write-time and surfaced in the admin tracker:
--
--   sentiment   TEXT  ('positive' | 'neutral' | 'concerning' | 'urgent')
--   auto_tags   TEXT[] — LLM-predicted topic tags
--
-- Distinction from migration 075's `topic_tags`:
--   - `topic_tags` are admin-stamped from the coach's saved-replies
--     library when a coach inserts pre-written content.
--   - `auto_tags` are LLM-predicted on user messages — no admin input
--     required. Lets the admin filter "show me all messages tagged
--     'conflict' that the AI flagged" without manual curation.
--
-- Both columns NULL/empty by default. The classifier runs as a
-- fire-and-forget after the message insert; failures don't block
-- the user. Pre-existing rows stay NULL until backfilled (separate
-- migration when desired).
--
-- Idempotent.

BEGIN;

-- journey_messages — per-item threads + general channel.
ALTER TABLE public.journey_messages
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS auto_tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.journey_messages
  DROP CONSTRAINT IF EXISTS journey_messages_sentiment_check;
ALTER TABLE public.journey_messages
  ADD CONSTRAINT journey_messages_sentiment_check
  CHECK (sentiment IS NULL OR sentiment IN ('positive','neutral','concerning','urgent'));

CREATE INDEX IF NOT EXISTS journey_messages_sentiment_idx
  ON public.journey_messages (sentiment)
  WHERE sentiment IS NOT NULL;

CREATE INDEX IF NOT EXISTS journey_messages_auto_tags_idx
  ON public.journey_messages USING gin (auto_tags);

-- journey_couple_channel_messages — same.
ALTER TABLE public.journey_couple_channel_messages
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS auto_tags TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.journey_couple_channel_messages
  DROP CONSTRAINT IF EXISTS journey_couple_channel_messages_sentiment_check;
ALTER TABLE public.journey_couple_channel_messages
  ADD CONSTRAINT journey_couple_channel_messages_sentiment_check
  CHECK (sentiment IS NULL OR sentiment IN ('positive','neutral','concerning','urgent'));

CREATE INDEX IF NOT EXISTS journey_couple_channel_messages_sentiment_idx
  ON public.journey_couple_channel_messages (sentiment)
  WHERE sentiment IS NOT NULL;

CREATE INDEX IF NOT EXISTS journey_couple_channel_messages_auto_tags_idx
  ON public.journey_couple_channel_messages USING gin (auto_tags);

COMMENT ON COLUMN public.journey_messages.sentiment IS
  'Phase 4 — Claude Haiku classification of the message tone. positive | neutral | concerning | urgent. NULL = not yet classified.';
COMMENT ON COLUMN public.journey_messages.auto_tags IS
  'Phase 4 — LLM-predicted topic tags. Distinct from topic_tags (admin-stamped from library).';
COMMENT ON COLUMN public.journey_couple_channel_messages.sentiment IS
  'Phase 4 — Claude Haiku classification. Same enum as journey_messages.';
COMMENT ON COLUMN public.journey_couple_channel_messages.auto_tags IS
  'Phase 4 — LLM-predicted topic tags. Distinct from topic_tags.';

COMMIT;

NOTIFY pgrst, 'reload schema';
