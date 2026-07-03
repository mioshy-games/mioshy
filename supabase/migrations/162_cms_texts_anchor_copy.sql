-- ============================================================
-- 162_cms_texts_anchor_copy.sql  (Task 32 — value-anchor copy, Itzik 2026-07-03)
--
-- Aligns the CMS with the new code fallback for the package-selector value
-- anchor (components/journey/AnalysisSummary.tsx, journeyAssessment.results.*).
-- Approved copy, verbatim from docs/stage1-fixes-checklist-2026-07-02.md
-- (section 27, line 180). Obeys the voice rules (no em-dash / "!" / emoji;
-- extended rule: no technical hyphen structures). The "500 ₪" carries a NBSP so
-- it never breaks across lines, matching the code fallback.
--
-- Upsert (not DO NOTHING): these keys may not exist yet, and where they do we
-- want the approved copy to win. is_rich is set on conflict per the seed
-- contract (re-runs enforce it). Run manually in the Supabase SQL editor.
-- ============================================================

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.results.anchorLead', 'journey-assessment', 'results',
    $t$פגישת ייעוץ אחת מתחילה ב-500 ₪ ויכולה להגיע לאלפי שקלים.$t$, $t$A single counselling session starts at ₪500 and can reach thousands.$t$, false),
  ('journeyAssessment.results.anchorBold', 'journey-assessment', 'results',
    $t$איתנו תקבלו ליווי צמוד ותוכנית מובנית, עם פרק אחד בשבוע שבו תבצעו משימות ותעצימו את הזוגיות שלכם מיום ליום.$t$, $t$With us you get close guidance and a structured plan, one chapter a week to strengthen your relationship day by day.$t$, false)
ON CONFLICT (key) DO UPDATE SET
  he_text = EXCLUDED.he_text,
  en_text = EXCLUDED.en_text,
  is_rich = EXCLUDED.is_rich;

COMMIT;
