-- 158_cms_texts_trial_cta.sql
-- CMS-editable label for the 7-day-trial CTA (A3). The trial CTA replaces the
-- paid "subscribe" button on every subscription surface (JourneyCheckoutButton,
-- SubscriptionModal, PaywallGateModal, PricingCheckout) when a trial is enabled
-- for that package. Each surface reads this key via fetchCmsTextMap with an
-- in-code fallback, so the button works before this runs; the seed only unlocks
-- admin editing (page 'marketing', section 'trial').
--
-- Additive; new key only. ON CONFLICT DO NOTHING so a re-run never clobbers an
-- admin edit. Run manually (no runner), like other cms_texts seeds.

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('trial_cta_label', 'marketing', 'trial', 'נסה 7 ימים חינם', 'Try 7 days free', false)
ON CONFLICT (key) DO NOTHING;
