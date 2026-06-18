-- ───────────────────────────────────────────────────────────────────────────
-- 136_cms_texts_assessment_offer_v2.sql
--
-- CRM copy for the two NEW quick-assessment touch points (Itzik 2026-06-18):
-- "browse2min" (2 minutes of browsing on general/couples pages) and
-- "exitintent" (intercepting the in-game exit/back). Same category "marketing",
-- public-readable, editable without a deploy. Defaults match the in-code
-- safety-net in lib/marketing/assessment-offer.ts. Idempotent (ON CONFLICT).
-- (The first three triggers were seeded in migration 134.)
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  -- 2-minute browse
  ('assessment_offer_browse2min_title',  'marketing', 'assessment_offer',
   'כבר כמה דקות איתנו 💜', 'A few minutes in 💜', false),
  ('assessment_offer_browse2min_body',   'marketing', 'assessment_offer',
   'רוצים לדעת איפה הזוגיות שלכם עומדת? 11 שאלות קצרות, ותמונה אישית שלכם.',
   'Want to know where your relationship stands? 11 short questions and a personal snapshot.', false),
  ('assessment_offer_browse2min_cta',    'marketing', 'assessment_offer',
   'קחו את האבחון', 'Take the assessment', false),
  ('assessment_offer_browse2min_dismiss','marketing', 'assessment_offer',
   'אחר כך', 'Later', false),

  -- Exit-intent (in-game)
  ('assessment_offer_exitintent_title',  'marketing', 'assessment_offer',
   'רגע לפני שאתם הולכים', 'One moment before you go', false),
  ('assessment_offer_exitintent_body',   'marketing', 'assessment_offer',
   'לפני שתצאו — 11 שאלות קצרות שיראו לכם לאן הזוגיות שלכם יכולה להמשיך.',
   'Before you leave — 11 short questions to show where your relationship can go next.', false),
  ('assessment_offer_exitintent_cta',    'marketing', 'assessment_offer',
   'כן, קחו אותי לאבחון', 'Yes, take me to the assessment', false),
  ('assessment_offer_exitintent_dismiss','marketing', 'assessment_offer',
   'המשיכו ליציאה', 'Continue to exit', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text;
