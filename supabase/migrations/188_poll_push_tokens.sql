-- 188_poll_push_tokens.sql
--
-- Push-notification tokens (§4 / §12): stored now so turning the poll into an
-- app with "new daily question" push later is a data-ready, not a rebuild.
-- Skeleton only — no push sending yet, no couple-pairing (§11 deferred).
-- Service-role only. Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.poll_push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  token       text NOT NULL,
  platform    text,                       -- 'web' | 'ios' | 'android'
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS poll_push_tokens_token_uidx
  ON public.poll_push_tokens (token);
CREATE INDEX IF NOT EXISTS poll_push_tokens_user_idx
  ON public.poll_push_tokens (user_id);

ALTER TABLE public.poll_push_tokens ENABLE ROW LEVEL SECURITY;

COMMIT;
