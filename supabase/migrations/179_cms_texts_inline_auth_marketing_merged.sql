-- ───────────────────────────────────────────────────────────────────────────
-- 179_cms_texts_inline_auth_marketing_merged.sql
--
-- Journey inline signup (components/journey/InlineAuthStep.tsx): the separate
-- email + WhatsApp opt-in checkboxes were merged into ONE marketing checkbox
-- (Itzik decision, 2026-07-07). Checking it consents to both channels; the
-- signup action still writes both DB columns (the merge is UI-only).
--
-- This migration rewrites the surviving key's copy to the approved combined
-- wording. The now-unused whatsappConsent key is left in place (harmless — no
-- surface renders it anymore) to keep migration 178 idempotent.
-- Same bucket as 143/178 — page='journey', section='inlineAuth'. Plain text.
-- HE copy is Itzik's FINAL verbatim-approved wording (2026-07-08); EN is a
-- faithful translation. Checking the box still writes both marketing_consent
-- and whatsapp_opt_in (no logic change) — this migration is copy-only.
-- Idempotent; the DO UPDATE sets is_rich too (per the cms_texts seed contract).
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('journeyAssessment.inlineAuth.marketingConsent', 'journey', 'inlineAuth',
   'מאשר לקבל טיפים ותוכן שיווקי מהמומחים של מיאושי במייל ובוואטסאפ.',
   'I agree to receive tips and marketing content from Mioshy''s experts by email and WhatsApp.', false)
ON CONFLICT (key) DO UPDATE
  SET page    = EXCLUDED.page,
      section = EXCLUDED.section,
      he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text,
      is_rich = EXCLUDED.is_rich;
