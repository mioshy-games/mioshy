-- ───────────────────────────────────────────────────────────────────────────
-- 135_cms_texts_lead_modal.sql
--
-- CRM-manages every string of the lead-capture modal (SubscriptionModal,
-- mode=lead) under the "marketing" category, so copy is editable without a
-- deploy. The component reads these client-side (cms_texts is public-readable)
-- and falls back per-field to the same in-code defaults seeded here.
--
-- Trap 1 (next-intl markup): the terms line is split into _pre + _link; the <a>
-- lives in JSX around the link text — NO markup inside any CMS value.
-- Defaults are identical to the current modal text. Idempotent (ON CONFLICT).
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('lead_modal_title',              'marketing', 'lead_modal',
   'לפני שממשיכים', 'Before you continue', false),
  ('lead_modal_subtitle',           'marketing', 'lead_modal',
   'שתי דקות, ואתם בדרך להמשך המשחק', 'Two minutes, and you''re back in the game', false),

  ('lead_modal_label_name',         'marketing', 'lead_modal',
   'שם מלא', 'Full name', false),
  ('lead_modal_ph_name',            'marketing', 'lead_modal',
   'שמך המלא', 'Your full name', false),

  ('lead_modal_label_phone',        'marketing', 'lead_modal',
   'טלפון נייד', 'Mobile', false),
  ('lead_modal_ph_phone',           'marketing', 'lead_modal',
   'מספר הטלפון שלכם', 'Your mobile number', false),

  ('lead_modal_label_email',        'marketing', 'lead_modal',
   'אימייל', 'Email', false),
  ('lead_modal_ph_email',           'marketing', 'lead_modal',
   'you@example.com', 'you@example.com', false),

  ('lead_modal_label_password',     'marketing', 'lead_modal',
   'סיסמה', 'Password', false),
  ('lead_modal_ph_password',        'marketing', 'lead_modal',
   'לפחות 8 תווים', 'At least 8 characters', false),
  ('lead_modal_password_show',      'marketing', 'lead_modal',
   'הצג', 'Show', false),

  ('lead_modal_consent_marketing',  'marketing', 'lead_modal',
   'אני מסכים/ה לקבל עדכונים ומבצעים ממיאושי',
   'I agree to receive updates and offers from Mioshy', false),
  ('lead_modal_consent_terms_pre',  'marketing', 'lead_modal',
   'קראתי ואני מאשר/ת את', 'I have read and accept the', false),
  ('lead_modal_consent_terms_link', 'marketing', 'lead_modal',
   'תנאי השימוש ומדיניות הפרטיות', 'Terms of Service and Privacy Policy', false),

  ('lead_modal_submit',             'marketing', 'lead_modal',
   'המשך למשחק', 'Keep playing', false),

  ('lead_modal_have_account',       'marketing', 'lead_modal',
   'כבר יש לכם חשבון?', 'Already have an account?', false),
  ('lead_modal_login_link',         'marketing', 'lead_modal',
   'להתחברות', 'Sign in', false),

  ('lead_modal_close_aria',         'marketing', 'lead_modal',
   'סגירה', 'Close', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text;
