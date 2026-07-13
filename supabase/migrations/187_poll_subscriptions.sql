-- 187_poll_subscriptions.sql
--
-- Daily-poll subscription state (§6): a registered user can subscribe /
-- unsubscribe from the daily question. Separate table (Itzik's call — NOT an
-- ALTER on profiles). One row per user. Service-role only.
--
-- Idempotent; safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.poll_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE,
  subscribed  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS poll_subscriptions_subscribed_idx
  ON public.poll_subscriptions (subscribed);

ALTER TABLE public.poll_subscriptions ENABLE ROW LEVEL SECURITY;

COMMIT;
