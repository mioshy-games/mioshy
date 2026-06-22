-- ───────────────────────────────────────────────────────────────────────────
-- 141_whatsapp_last_inbound.sql
--
-- Stage 1 of the WhatsApp-admin-outbound integration (see
-- docs/whatsapp-admin-integration-spec.md §4a). Adds the 24h service-window
-- signal: the timestamp of the user's most recent inbound WhatsApp message.
--
-- WhatsApp only allows free-text replies within 24h of the customer's last
-- inbound message; outside that window only an approved template may be sent.
-- The webhook (app/api/whatsapp/webhook/route.ts) stamps this column on every
-- inbound message (matched by mobile suffix, like the existing opt-out path),
-- so admin screens can read the window state with a single cheap profiles read.
--
-- Idempotent. Numbered 141 to avoid colliding with the pending 139/140 on the
-- header-CMS and security branches (game tip is 138).
-- ───────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists whatsapp_last_inbound_at timestamptz;

comment on column public.profiles.whatsapp_last_inbound_at is
  'Timestamp of the user''s most recent inbound WhatsApp message. Drives the 24h service-window state in admin compose/panels. Updated by the WhatsApp webhook.';

notify pgrst, 'reload schema';
