-- 127_cms_texts_setup_landing_revised.sql
-- =============================================================================
-- Work-order 2026-06-15, part C — REVISED concept: /my/setup is a non-blocking
-- landing (shown until the assessment is done), not a gate. Connecting a partner
-- is never mandatory.
--
-- Reword the onboarding card copy from the "two mandatory steps" framing (set in
-- 126) to an assessment-centric, non-blocking voice, and add the three
-- partner-invite presentation strings (optional tag / optional desc / disabled
-- desc) used by the new partnerMode rendering.
--
-- Brand voice: no "כלים", addresses "אתם/שלכם", no rule-of-three.
-- page 'my-hub', section 'onboarding'. ON CONFLICT DO UPDATE = re-assert (idempotent).
-- =============================================================================

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('myHub.onboarding.title', 'my-hub', 'onboarding',
   'צעד אחרון לפני שמתחילים', 'One last step before we begin', false),
  ('myHub.onboarding.subtitle', 'my-hub', 'onboarding',
   'נשאר להשלים את האבחון — וכל המסע ייפתח לפניכם.',
   'Just the assessment left — and your whole journey opens.', false),
  ('myHub.onboarding.footer', 'my-hub', 'onboarding',
   'אפשר להמשיך לכל מקום בכל רגע — העמוד הזה ילווה אתכם עד שתשלימו את האבחון.',
   'Feel free to go anywhere anytime — this page stays with you until the assessment is done.',
   false),
  ('myHub.onboarding.item1.optionalTag', 'my-hub', 'onboarding',
   'לא חובה', 'Optional', false),
  ('myHub.onboarding.item1.optionalDesc', 'my-hub', 'onboarding',
   'אפשר לצרף את בן/בת הזוג ולגלות יחד עוד על הזוגיות שלכם.',
   'You can add your partner and discover more about your relationship together.', false),
  ('myHub.onboarding.item1.disabledDesc', 'my-hub', 'onboarding',
   'זמין כשתצטרפו לליווי — אז תוכלו לצרף את בן/בת הזוג לתמונה משותפת.',
   'Available once you join the program — then you can add your partner for a shared picture.', false)
ON CONFLICT (key) DO UPDATE
  SET he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text;

COMMIT;
