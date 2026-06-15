-- ============================================================
-- 116_cms_texts_journey_assessment_value_points.sql
--
-- C2.4: seed the "what's included" value-points shown on the journey
-- purchase screen (AnalysisSummary on /journey/assessment + the
-- standalone AssessmentSummary). Seeded under page='journey-assessment',
-- section='assessment' to group with the existing
-- journeyAssessment.analysis.* rows. NOTE: live editing requires a
-- <CmsTextProvider> loading page='journey-assessment' on the screen —
-- /journey/assessment does NOT currently mount one, so <CmsText> falls
-- back to the matching messages/{he,en}.json keys (the screen renders
-- either way). The components render the points regardless.
--
-- Idempotent: ON CONFLICT (key) DO NOTHING — re-running won't clobber
-- admin edits.
-- ============================================================

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.valuePoints.title', 'journey-assessment', 'assessment',
    'מה כלול', 'What''s included', false),

  ('journeyAssessment.valuePoints.point1', 'journey-assessment', 'assessment',
    'ליווי שבועי אישי עם מומחה',
    'Weekly personal guidance with an expert', false),

  ('journeyAssessment.valuePoints.point2', 'journey-assessment', 'assessment',
    'כל משחקי הזוגות אונליין',
    'All online couples games', false),

  ('journeyAssessment.valuePoints.point3', 'journey-assessment', 'assessment',
    'הסקס של מיאושי',
    'Mioshy''s Sex', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;
