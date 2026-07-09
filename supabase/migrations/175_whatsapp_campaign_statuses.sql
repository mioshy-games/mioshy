-- ───────────────────────────────────────────────────────────────────────────
-- 175_whatsapp_campaign_statuses.sql
--
-- Safe-test mode (Itzik 2026-07-06): the automated WhatsApp campaigns
-- (coach_welcome, intro_price_expiry_reminder) run their full logic in prod,
-- but WHATSAPP_MODE=allowlist actually sends only to WHATSAPP_ALLOWLIST. Every
-- other eligible recipient is journalled as a "would_send" row (with the reason)
-- instead of being messaged. Throttled/blocked recipients journal as "skipped".
--
-- whatsapp_messages.status had a CHECK that didn't allow those, so extend it.
-- The whatsapp_messages table is the journal (per the spec), so no new table.
-- Idempotency for the two campaigns is enforced by the app querying this log
-- for an existing (template_name, recipient_user_id) row.
--
-- Idempotent (drop + re-add the constraint under a stable name).
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN (
    'queued','sent','delivered','read','failed','received',
    'would_send','skipped'
  ));

-- Fast idempotency + throttle lookups: recent outbound rows per recipient.
CREATE INDEX IF NOT EXISTS whatsapp_messages_recipient_template_idx
  ON public.whatsapp_messages (recipient_user_id, template_name);
