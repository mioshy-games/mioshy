-- 183_cms_texts_results_improvements.sql
--
-- Seed the new/changed copy for the short-assessment results improvements
-- (components/journey/AnalysisSummary.tsx, 2026-07-12). Namespace
-- journeyAssessment.results.*, same style/bucket as migration 152.
--
-- The component carries these strings as bilingual inline fallbacks, so the page
-- renders correctly even before this runs; once seeded, an admin edit overrides.
-- Additive: new keys only, ON CONFLICT DO NOTHING (does NOT overwrite the old
-- `results.eyebrow` — the code now reads the new `results.eyebrowShort` key).
--
-- ⚠️ strip2 numbers are a PLACEHOLDER until Itzik approves real stats.

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.results.eyebrowShort', 'journey-assessment', 'results',
    'תוצאות האבחון הקצר שלכם', 'Your short assessment results', false),
  ('journeyAssessment.results.h1Ready', 'journey-assessment', 'results',
    'תוצאות האבחון שלך מוכנות', 'Your assessment results are ready', false),
  ('journeyAssessment.results.strip1', 'journey-assessment', 'results',
    'מאז 2021', 'Since 2021', false),
  ('journeyAssessment.results.strip2', 'journey-assessment', 'results',
    'שיפרנו ל-90% מהזוגות שלנו את הזוגיות, בעשרות אחוזים בכל חודש.',
    'We improved the relationship for 90% of our couples, by tens of percent every month.', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
