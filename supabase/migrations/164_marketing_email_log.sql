-- ============================================================
-- 164_marketing_email_log.sql  (mailing sequence — Itzik 2026-07-04)
--
-- One-row-per-(user, email) ledger so the marketing sequence sends each step
-- EXACTLY once. journey_reminder_log can't be reused for this: its unique key
-- includes scheduled_item_id, and a NULL there is distinct per row in Postgres,
-- so it would never dedupe a marketing step. Here the unique is (user_id,
-- email_kind) with a NOT NULL kind, which dedupes cleanly.
--
-- email_kind values (docs/mailing-schedule-2026-07-03.md):
--   'results_ready'   (§1, immediate)
--   'evening_proof'   (§2, first evening 20:00)
--   'deadline'        (§3ב, 12h before window expiry)
--   'day7_value_tip'  (§21, day 7)
-- (The day-5 trial reminder §ת-1 keeps its existing journey_notifications dedup.)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_kind  text NOT NULL,
  brevo_message_id text,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_kind)
);

COMMENT ON TABLE public.marketing_email_log IS
  'Idempotency ledger for the post-assessment marketing email sequence — one row '
  'per (user, email_kind). The sequence inserts a row BEFORE sending so a flaky '
  'send never double-fires; a unique-violation means "already sent".';

-- Service-role only (crons use the admin client; no user-facing reads).
ALTER TABLE public.marketing_email_log ENABLE ROW LEVEL SECURITY;

COMMIT;
