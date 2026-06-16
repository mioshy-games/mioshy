-- 126_cms_texts_setup_gate.sql
-- =============================================================================
-- Work-order 2026-06-15, part C — "complete your setup" gate (/my/setup).
--
-- C.2/C.1 — new gate-page chrome + reframe the (now blocking) onboarding card:
--   · appShell.setup.pageTitle / .lead  — the /my/setup page header + intro.
--   · myHub.onboarding.subtitle / .footer — reworded from "non-blocking
--     reminder" to "blocking gate" voice (the card is now the gate body).
--   · myHub.onboarding.item2.desc — drop the word "כלים" → "צעדים" (brand voice,
--     same change made on /journey/assessment in part B).
--
-- C.3 — appShell.lessons.nextAssessmentNotice: the "next assessment in 8 weeks"
--   message shown under "האבחונים שלכם". {date} is substituted at render time
--   with a per-user computed date (assessment/join date + 8 weeks) — never
--   hardcoded.
--
-- app-shell keys were seeded in 098; myHub keys live under page 'my-hub'
-- (the onboarding.* group was previously messages-only, so these INSERT it into
-- cms_texts for the first time, making the gate copy admin-editable).
--
-- ON CONFLICT (key) DO UPDATE: this migration sets a deliberate, current copy
-- set, so a re-run re-asserts it. Idempotent.
-- =============================================================================

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('appShell.setup.pageTitle', 'app-shell', 'setup',
   'השלמת הצטרפות', 'Complete setup', false),
  ('appShell.setup.lead', 'app-shell', 'setup',
   'רגע לפני שנצא לדרך — נסגור את שני הצעדים האחרונים, והמסע המלא שלכם נפתח.',
   'Just before we set off — let''s close the last two steps, and your full journey opens.',
   false),
  ('appShell.lessons.nextAssessmentNotice', 'app-shell', 'lessons',
   'בעוד 8 שבועות, בתאריך {date}, נשלח אליכם אבחון נוסף ותגובות המומחים שלנו — לפי ההיכרות איתכם, כדי לראות את ההתקדמות שלכם ולדייק את היעדים.',
   'In 8 weeks, on {date}, we''ll send you another assessment and our experts'' responses — based on getting to know you, to see your progress and sharpen your goals.',
   false),
  ('myHub.onboarding.subtitle', 'my-hub', 'onboarding',
   'שני צעדים קטנים נשארו, ואז המסע המלא נפתח לפניכם.',
   'Two small steps remain, and then your full journey opens.', false),
  ('myHub.onboarding.footer', 'my-hub', 'onboarding',
   'ברגע ששני הצעדים יושלמו, נמשיך יחד אל המסע.',
   'Once both steps are done, we''ll continue together into your journey.', false),
  ('myHub.onboarding.item2.desc', 'my-hub', 'onboarding',
   'עוד כ-2 דקות — לתמונה מדויקת יותר ולצעדים שמותאמים בדיוק אליכם.',
   'About 2 more minutes — for a sharper picture and steps tailored to you.', false)
ON CONFLICT (key) DO UPDATE
  SET he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text;

COMMIT;
