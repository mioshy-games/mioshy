-- ============================================================
-- 165_gender_to_short_and_entry_copy.sql  (Itzik 2026-07-05)
--
-- Two coupled decisions:
--  (1) Move q_gender into the SHORT assessment, as the FIRST question. It maps
--      to profiles.gender (backfilled on signup for anon journeys) and doesn't
--      drive the diagnostic. With q_priorities already in short, the short set
--      becomes 14 questions.
--  (2) Restore the DYNAMIC "{N} שאלות" entry copy everywhere (the vars code is
--      in prod now, so 161's hardcoded "12" is no longer needed), and set the
--      interim duration to "כ-3 דקות" across every surface. getShortQuestionCount
--      then renders 14 automatically after (1).
--
-- Run manually in the Supabase SQL editor (journey_questions + cms_texts).
-- ============================================================

BEGIN;

-- (1) q_gender → short, first. position < the current short minimum (0) so it
-- sorts ahead of every other short question.
UPDATE public.journey_questions
  SET phase = 'short', position = -1, updated_at = now()
  WHERE slug = 'q_gender';

-- (2) Entry copy — dynamic {N}, duration "כ-3 דקות".

-- couples-assessment hero trust chip (revert 161's concrete "12 · כ-2 דקות").
UPDATE public.cms_texts
  SET he_text = $t${N} שאלות · כ-3 דקות · בלי כרטיס אשראי$t$
  WHERE key = 'couplesAssessment.hero.trust';

-- couples-assessment FAQ "כמה זמן" (revert 161's concrete version).
UPDATE public.cms_texts
  SET he_text = $t$<p>{N} שאלות קצרות, כ-3 דקות. בלי שאלונים מתישים.</p>$t$
  WHERE key = 'couplesAssessment.faq.item2A';

-- couples-assessment "what" body: "כ-2 דקות" → "כ-3 דקות" (surgical).
UPDATE public.cms_texts
  SET he_text = replace(he_text, 'כ-2 דקות', 'כ-3 דקות')
  WHERE key = 'couplesAssessment.what.body';

-- Assessment intro duration.
UPDATE public.cms_texts
  SET he_text = $t$האבחון לוקח כ-3 דקות. אחר כך, צעד קצר אחת לשבוע, בקצב שלכם.$t$
  WHERE key = 'journeyAssessment.intro.durationBody';

-- My-hub onboarding "complete the full assessment" line (em-dash → comma too).
UPDATE public.cms_texts
  SET he_text = $t$עוד כ-3 דקות, לתמונה מדויקת יותר ולצעדים שמותאמים בדיוק אליכם.$t$
  WHERE key = 'myHub.onboarding.item2.desc';

COMMIT;
