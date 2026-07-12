-- ───────────────────────────────────────────────────────────────────────────
-- 182_cms_texts_reconsent_popup.sql
--
-- Seed the re-consent popup copy (components/journey/ReconsentPrompt.tsx) so it
-- is editable from the admin CMS. Same bucket/style as migration 143
-- (page='journey'); plain text (is_rich=false). Defaults mirror the next-intl
-- JSON fallback (messages/{he,en}.json → journeyAssessment.reconsent.*), which
-- is what actually renders on the results page (it is not wrapped in a
-- CmsTextProvider today — same as the inlineAuth keys).
--
-- Idempotent; the DO UPDATE sets is_rich too (per the cms_texts seed contract).
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.reconsent.title', 'journey', 'reconsent',
   'כנראה שכחתם לסמן דיוור', 'Looks like you forgot to opt in', false),
  ('journeyAssessment.reconsent.bodyA', 'journey', 'reconsent',
   'בלי זה לא נוכל לשלוח לכם תוכן זוגי שיעזור לכם.',
   'Without it we can''t send you couples content that helps you.', false),
  ('journeyAssessment.reconsent.bodyB', 'journey', 'reconsent',
   'מדי פעם נשלח משהו שאסור לכם לפספס על הזוגיות שלכם, כזה שיכול להכניס לכם פלפל לזוגיות.',
   'Every now and then we''ll send something you shouldn''t miss about your relationship — the kind that adds some spice.', false),
  ('journeyAssessment.reconsent.consent', 'journey', 'reconsent',
   'מאשר לקבל טיפים ותוכן שיווקי מהמומחים של מיאושי במייל ובוואטסאפ.',
   'I agree to receive tips and marketing content from Mioshy''s experts by email and WhatsApp.', false),
  ('journeyAssessment.reconsent.cta', 'journey', 'reconsent',
   'אשמח, שלחו לי', 'Yes, send me', false),
  ('journeyAssessment.reconsent.later', 'journey', 'reconsent',
   'אולי בפעם אחרת', 'Maybe another time', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text,
      is_rich = EXCLUDED.is_rich;
