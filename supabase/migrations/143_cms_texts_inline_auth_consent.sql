-- ───────────────────────────────────────────────────────────────────────────
-- 143_cms_texts_inline_auth_consent.sql
--
-- Seed the consent-checkbox copy for the journey inline signup
-- (components/journey/InlineAuthStep.tsx) so it is editable from the admin.
-- Same bucket as the rest of journeyAssessment.inlineAuth.* — page='journey',
-- section='inlineAuth' — which the journey CmsTextProvider already loads.
-- Plain text (is_rich=false). Defaults mirror the next-intl JSON fallback
-- (messages/{he,en}.json → journeyAssessment.inlineAuth.*).
-- Idempotent; the DO UPDATE sets is_rich too (per the cms_texts seed contract).
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.inlineAuth.termsPrefix', 'journey', 'inlineAuth',
   'קראתי ואני מאשר/ת את ', 'I have read and accept the ', false),
  ('journeyAssessment.inlineAuth.termsLink', 'journey', 'inlineAuth',
   'תנאי השימוש', 'terms of use', false),
  ('journeyAssessment.inlineAuth.termsAnd', 'journey', 'inlineAuth',
   ' ו', ' and ', false),
  ('journeyAssessment.inlineAuth.privacyLink', 'journey', 'inlineAuth',
   'מדיניות הפרטיות', 'privacy policy', false),
  ('journeyAssessment.inlineAuth.termsSuffix', 'journey', 'inlineAuth',
   ' של מיאושי.', ' of Mioshy.', false),
  ('journeyAssessment.inlineAuth.marketingConsent', 'journey', 'inlineAuth',
   'אני מאשר/ת קבלת דיוור והודעות ממיאושי ומהמומחים (אפשר לבטל בכל עת).',
   'I agree to receive updates and messages from Mioshy and its experts (you can opt out anytime).', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text,
      is_rich = EXCLUDED.is_rich;
