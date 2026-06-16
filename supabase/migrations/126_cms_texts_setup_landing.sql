-- 126_cms_texts_setup_landing.sql
-- =============================================================================
-- Work-order 2026-06-15, part C — CMS strings for the non-blocking /my/setup
-- landing. Consolidated, final values only.
--
-- This supersedes the earlier split (a "setup gate" seed + a "revised landing"
-- override that re-edited the same keys). Neither ran in production, so they are
-- merged here into one clean seed with no self-overwrite and no duplicates.
--
-- Two surfaces:
--   · app-shell — the /my/setup page header (setup.pageTitle/lead) and the
--     "next assessment in 8 weeks" notice on /my/lessons ({date} is substituted
--     per-user at render; never hardcoded).
--   · my-hub / onboarding — the OnboardingReminderCard body: assessment-centric,
--     non-blocking copy, plus the three partner-invite presentation strings
--     (optionalTag / optionalDesc / disabledDesc) for partnerMode task /
--     optional / disabled. Connecting a partner is never mandatory.
--
-- Brand voice: no "כלים", addresses "אתם/שלכם", no rule-of-three.
-- Part B strings (5-days-a-week + "מעבר לדשבורד שלי") live in 125 — no overlap.
-- ON CONFLICT (key) DO UPDATE = idempotent; asserts these final values.
-- =============================================================================

BEGIN;

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  -- ── /my/setup page chrome (app-shell) ──────────────────────────────────────
  ('appShell.setup.pageTitle', 'app-shell', 'setup',
   'השלמת הצטרפות', 'Complete setup', false),
  ('appShell.setup.lead', 'app-shell', 'setup',
   'רגע לפני שנצא לדרך — נשלים את האבחון, וזה כל מה שצריך.',
   'Just before we set off — finish the assessment, and that''s all it takes.',
   false),

  -- ── C.3 next-assessment notice on /my/lessons (app-shell) ──────────────────
  ('appShell.lessons.nextAssessmentNotice', 'app-shell', 'lessons',
   'בעוד 8 שבועות, בתאריך {date}, נשלח אליכם אבחון נוסף ותגובות המומחים שלנו — לפי ההיכרות איתכם, כדי לראות את ההתקדמות שלכם ולדייק את היעדים.',
   'In 8 weeks, on {date}, we''ll send you another assessment and our experts'' responses — based on getting to know you, to see your progress and sharpen your goals.',
   false),

  -- ── OnboardingReminderCard body (my-hub / onboarding) ──────────────────────
  ('myHub.onboarding.title', 'my-hub', 'onboarding',
   'צעד אחרון לפני שמתחילים', 'One last step before we begin', false),
  ('myHub.onboarding.subtitle', 'my-hub', 'onboarding',
   'נשאר להשלים את האבחון — וכל המסע ייפתח לפניכם.',
   'Just the assessment left — and your whole journey opens.', false),
  ('myHub.onboarding.footer', 'my-hub', 'onboarding',
   'אפשר להמשיך לכל מקום בכל רגע — העמוד הזה ילווה אתכם עד שתשלימו את האבחון.',
   'Feel free to go anywhere anytime — this page stays with you until the assessment is done.',
   false),
  ('myHub.onboarding.item2.desc', 'my-hub', 'onboarding',
   'עוד כ-2 דקות — לתמונה מדויקת יותר ולצעדים שמותאמים בדיוק אליכם.',
   'About 2 more minutes — for a sharper picture and steps tailored to you.', false),

  -- partner-invite presentation (never mandatory) — task / optional / disabled
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
