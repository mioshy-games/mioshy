-- 190_cms_texts_results_teaser_cta.sql
--
-- Seed the locked-teaser CTA copy on the short-assessment results screen
-- (components/journey/AnalysisSummary.tsx, .ar-teaser-cta — the message + link
-- below the second-weakest category card). Namespace journeyAssessment.results.*,
-- same bucket as migrations 152 / 183.
--
-- The component carries these as bilingual inline fallbacks (rc()), so the page
-- renders correctly before this runs; seeding makes them editable in the admin
-- CMS and lets an admin edit override the fallback. Additive: new keys only,
-- ON CONFLICT DO NOTHING.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.results.teaserMsg', 'journey-assessment', 'results',
    'רוצים לגלות את הפרטים המלאים - איך לשפר את הזוגיות ולהחזיר לה את התשוקה והכיף?',
    'Want to discover the full details - how to improve your relationship and bring back the passion and fun?', false),
  ('journeyAssessment.results.catsMoreLink', 'journey-assessment', 'results',
    'להצטרפות לליווי', 'Join the coaching', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
