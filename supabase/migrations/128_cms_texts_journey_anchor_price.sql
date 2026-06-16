-- 128_cms_texts_journey_anchor_price.sql
-- =============================================================================
-- QA 2026-06-16 (item 1) — struck-through anchor price for the journey/coaching
-- (ליווי) offer: show the original "127 ₪" crossed out beside the current
-- "57 / week" everywhere the journey price is presented.
--
-- Two CMS-driven price surfaces get a new key (both platforms):
--   · journeyAssessment.analysis.anchorPrice — the post-assessment OfferCard
--     price summary (AnalysisSummary). Shown in $ in English, matching that
--     surface's currency.
--   · homeV2.journeyStages.stage3OriginalPrice — the homepage/pricing stage-3
--     (journey) price block (JourneyStages), mirroring the existing
--     stage2OriginalPrice. That surface shows ₪ even in English.
--
-- Admin-editable; ON CONFLICT DO UPDATE so a re-run re-asserts the values.
-- =============================================================================

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.analysis.anchorPrice', 'journey-assessment', 'analysis',
   '127 ₪', '$38', false),
  ('homeV2.journeyStages.stage3OriginalPrice', 'homepage', 'journeystages',
   '127 ₪', '₪127', false)
ON CONFLICT (key) DO UPDATE
  SET he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text;

COMMIT;
