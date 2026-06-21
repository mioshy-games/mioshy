-- 138 — Meta (Facebook) attribution fields on checkout_sessions.
--
-- The Conversions API `Purchase` event fires from the Cardcom indicator
-- webhook, which runs from Cardcom's IP with NO access to the buyer's browser.
-- So the Meta browser cookies (_fbp / _fbc) and the user-agent are captured at
-- checkout-create time (a real browser request) and stored here for the
-- indicator to read back, raising Event Match Quality + enabling dedup.
--
-- Privacy (Itzik 2026-06-21): we deliberately do NOT store client IP here. The
-- IP is used only in-memory by /api/billing/checkout/create for the
-- InitiateCheckout CAPI call (that request already has it); the later Purchase
-- CAPI relies on fbp/fbc + hashed email/phone instead. fbp/fbc are Meta's own
-- first-party cookies (not raw PII); the event_id for dedup is derived
-- deterministically from the session id, so no extra column is needed for it.

ALTER TABLE checkout_sessions
  ADD COLUMN IF NOT EXISTS fbp               text,
  ADD COLUMN IF NOT EXISTS fbc               text,
  ADD COLUMN IF NOT EXISTS client_user_agent text;

COMMENT ON COLUMN checkout_sessions.fbp IS
  'Meta _fbp cookie captured at checkout-create; for the Purchase CAPI event. Not PII.';
COMMENT ON COLUMN checkout_sessions.fbc IS
  'Meta _fbc cookie captured at checkout-create; for the Purchase CAPI event. Not PII.';
COMMENT ON COLUMN checkout_sessions.client_user_agent IS
  'Browser UA captured at checkout-create; raises Meta CAPI match quality. (No client IP is stored — by design.)';
