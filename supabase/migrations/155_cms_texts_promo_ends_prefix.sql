-- 155_cms_texts_promo_ends_prefix.sql
-- CMS-editable eyebrow for the paywall promo-expiry countdown
-- (components/journey/PromoExpiryCountdown, rendered on /journey/assessment).
-- Seeding it here makes the label appear in the admin CMS editor for the
-- 'journey-assessment' page / 'analysis' section, so admin can fully edit it
-- (e.g. "המבצע מוגבל בזמן"). The component keeps a code fallback, so the timer
-- works even before this runs; the seed only unlocks admin editing.
--
-- Additive; new key only. ON CONFLICT DO NOTHING so it never clobbers an
-- admin edit on re-run. Run manually (no runner), like other cms_texts seeds.

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.analysis.promoEndsPrefix', 'journey-assessment', 'analysis', 'המבצע מוגבל בזמן', 'Limited-time offer', false)
ON CONFLICT (key) DO NOTHING;
