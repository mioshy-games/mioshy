-- ───────────────────────────────────────────────────────────────────────────
-- 134_cms_texts_assessment_offer.sql
--
-- CRM-managed copy for the quick-assessment offer shown at three touch points
-- (in-game from round 6, right after login, return-after-24h). All strings live
-- in cms_texts under the "marketing" category so they're editable without a
-- deploy. cms_texts is public-readable (SELECT USING(true)), so the offer
-- components read these directly client-side.
--
-- Keys (flat, as requested): assessment_offer_{ingame|login|return24h}_{title,
-- body,cta,dismiss}. Brand voice: אתם/שלכם, no "כלים", no rule-of-three.
-- Idempotent: ON CONFLICT DO UPDATE re-asserts the defaults on re-run.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  -- In-game (round 6+)
  ('assessment_offer_ingame_title',  'marketing', 'assessment_offer',
   'סקרנים לדעת מה באמת קורה ביניכם?',
   'Curious what''s really going on between you?', false),
  ('assessment_offer_ingame_body',   'marketing', 'assessment_offer',
   '11 שאלות קצרות, ואתם מקבלים תמונה אישית של הזוגיות שלכם — ולאן היא יכולה להמשיך.',
   '11 short questions and you get a personal picture of your relationship — and where it can go next.', false),
  ('assessment_offer_ingame_cta',    'marketing', 'assessment_offer',
   'קחו את האבחון', 'Take the assessment', false),
  ('assessment_offer_ingame_dismiss','marketing', 'assessment_offer',
   'אחר כך', 'Later', false),

  -- Right after login
  ('assessment_offer_login_title',   'marketing', 'assessment_offer',
   'טוב לראות אתכם שוב', 'Good to see you again', false),
  ('assessment_offer_login_body',    'marketing', 'assessment_offer',
   'פחות משלוש דקות, ואתם יודעים איפה הזוגיות שלכם עומדת היום — עם המלצות אישיות שלכם בלבד.',
   'Under three minutes and you''ll know where your relationship stands today — with recommendations just for you.', false),
  ('assessment_offer_login_cta',     'marketing', 'assessment_offer',
   'מתחילים באבחון', 'Start the assessment', false),
  ('assessment_offer_login_dismiss', 'marketing', 'assessment_offer',
   'בפעם אחרת', 'Another time', false),

  -- Return after 24h
  ('assessment_offer_return24h_title',  'marketing', 'assessment_offer',
   'חזרתם — בואו נעמיק קצת', 'You''re back — let''s go a little deeper', false),
  ('assessment_offer_return24h_body',   'marketing', 'assessment_offer',
   'האבחון המהיר מחכה לכם: 11 שאלות, והכיוון לזוגיות טובה יותר נפתח.',
   'The quick assessment is waiting: 11 questions, and the path to a better relationship opens up.', false),
  ('assessment_offer_return24h_cta',    'marketing', 'assessment_offer',
   'לאבחון', 'To the assessment', false),
  ('assessment_offer_return24h_dismiss','marketing', 'assessment_offer',
   'לא עכשיו', 'Not now', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text;
