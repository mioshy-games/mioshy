-- 186_customer_payment_methods_card_owner.sql
--
-- Cardcom 60000004 fix (2026-07-13): the Israeli acquirer requires the
-- cardholder's name + identity number (ת.ז.) echoed on the day-7 token charge
-- (v11 CardOwnerInformation). Those values are captured on the Cardcom payment
-- page during the J2 trial tokenization (v11 GetLpResult → CardOwnerName /
-- CardOwnerIdentityNumber) and stored here so the renewals cron can send them.
--
--   card_owner_name    — cardholder full name, stored in the clear (also used as
--                        the invoice name, since profiles.full_name is usually NULL).
--   card_owner_id_enc  — identity number (ת.ז.), sensitive PII → encrypted with
--                        the same AES-256-GCM scheme as token_enc (lib/tokenCrypto).
--
-- Idempotent: safe to re-run.

ALTER TABLE public.customer_payment_methods
  ADD COLUMN IF NOT EXISTS card_owner_name   text,
  ADD COLUMN IF NOT EXISTS card_owner_id_enc text;

COMMENT ON COLUMN public.customer_payment_methods.card_owner_name IS
  'Cardholder full name from Cardcom (CardOwnerName). Sent as CardOwnerInformation.FullName on v11 token charges; also used as invoice name.';
COMMENT ON COLUMN public.customer_payment_methods.card_owner_id_enc IS
  'Cardholder identity number (ת.ז., CardOwnerIdentityNumber), AES-256-GCM encrypted like token_enc. Decrypted to CardOwnerInformation.IdentityNumber on v11 token charges.';
