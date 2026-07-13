-- 187_trial_validation_charges.sql
--
-- Trial tokenization model change (2026-07-13): the 7-day trial now mints its
-- token via a real ₪1 charge (Operation="ChargeAndCreateToken") instead of J2
-- validation, then refunds the ₪1 immediately (CancelOnly). This table is the
-- ledger of those ₪1 validation charges + their refund status, so the
-- refund-repair cron can retry any refund that didn't go through on the first
-- pass. A refund failure must NEVER revoke the trial — the user keeps access and
-- the cron keeps retrying until the ₪1 is reversed.
--
-- Also seeds the CMS disclosure copy shown on the trial signup surfaces.

BEGIN;

CREATE TABLE IF NOT EXISTS public.trial_validation_charges (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  checkout_session_id uuid,
  subscription_id     uuid,
  deal_id             text NOT NULL,            -- Cardcom TranzactionId of the ₪1 charge
  amount              numeric NOT NULL DEFAULT 1,
  currency            text NOT NULL DEFAULT 'ILS',
  refund_status       text NOT NULL DEFAULT 'pending',  -- pending | refunded | failed
  refund_deal_id      text,                     -- Cardcom NewTranzactionId of the refund
  attempts            integer NOT NULL DEFAULT 0,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  refunded_at         timestamptz
);

-- Cron scans for outstanding refunds by status; dedupe/lookup by deal.
CREATE INDEX IF NOT EXISTS trial_validation_charges_refund_status_idx
  ON public.trial_validation_charges (refund_status);
CREATE INDEX IF NOT EXISTS trial_validation_charges_deal_id_idx
  ON public.trial_validation_charges (deal_id);

-- Service-role only (billing routes + cron). No anon/authenticated policies.
ALTER TABLE public.trial_validation_charges ENABLE ROW LEVEL SECURITY;

-- ── CMS disclosure copy (shown on every trial signup surface via useTrialOffer)
-- {price} is interpolated client-side with the post-trial amount. Same
-- namespace/convention as the sibling `trial_cta_label` (mig 158).
INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('trial_charge_disclosure', 'marketing', 'trial',
    'לאימות הכרטיס נבצע חיוב זמני של ₪1 שיוחזר מיד. בתום 7 ימים יחויב {price} ₪, וניתן לבטל בכל עת.',
    'To verify your card we''ll make a temporary ₪1 charge, refunded immediately. After 7 days you''ll be charged ₪{price}; cancel anytime.',
    false)
ON CONFLICT (key) DO UPDATE
  SET he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text,
      is_rich = EXCLUDED.is_rich;

COMMIT;
