-- ───────────────────────────────────────────────────────────────────────────
-- 178_cms_texts_inline_auth_whatsapp.sql
--
-- Journey inline signup (components/journey/InlineAuthStep.tsx) consent copy:
--   1) Update the email marketing-consent line to the approved wording.
--   2) Add the new WhatsApp opt-in line.
-- Same bucket as migration 143 — page='journey', section='inlineAuth' — which
-- the journey CmsTextProvider already loads. Plain text (is_rich=false).
-- Defaults mirror the next-intl JSON fallback (messages/{he,en}.json).
-- HE copy is Itzik's verbatim-approved wording; EN is a faithful translation.
-- Idempotent; the DO UPDATE sets is_rich too (per the cms_texts seed contract).
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.inlineAuth.marketingConsent', 'journey', 'inlineAuth',
   'אשמח לקבל במייל טיפים ותוכן לזוגיות ממיאושי. ההסרה בלחיצה, בכל רגע.',
   'I''d be happy to receive relationship tips and content from Mioshy by email. Unsubscribe anytime, in one click.', false),
  ('journeyAssessment.inlineAuth.whatsappConsent', 'journey', 'inlineAuth',
   'אשמח לקבל תזכורות קצרות גם בוואטסאפ, לא יותר מפעם בשבוע.',
   'I''d be happy to also get short reminders on WhatsApp, no more than once a week.', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text,
      is_rich = EXCLUDED.is_rich;
