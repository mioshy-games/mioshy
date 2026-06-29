-- 151_cms_texts_upsell_bullets.sql
--
-- NoJourneyUpsell expanded from 2 to 5 bullets + shortened body. cms_texts
-- live values win over messages/*.json, so the JSON edits in this branch must
-- be mirrored here for prod. All five bullets + the body are the single shared
-- copy rendered on the /my/lessons blocked-partner takeover, the /my/lessons
-- no-journey upsell, and the /my/expert gate (see getNoJourneyUpsellCopy).
--
--   • appShell.today.upsellBody    — UPDATE (shortened copy)
--   • appShell.today.upsellBullet1 — UPDATE (final copy, new order)
--   • appShell.today.upsellBullet2 — UPDATE (final copy, new order)
--   • appShell.today.upsellBullet3 — UPSERT (row already exists from 100;
--                                    refreshed to the new copy)
--   • appShell.today.upsellBullet4 — INSERT (new key)
--   • appShell.today.upsellBullet5 — INSERT (new key)
--
-- Additive: UPDATE existing rows, INSERT new keys. No schema change. The
-- bullet3/4/5 INSERT uses ON CONFLICT (key) DO UPDATE so it is safe to re-run
-- and so the pre-existing upsellBullet3 row (seeded in 100) is refreshed
-- rather than colliding. is_rich is set on DO UPDATE per repo convention.

BEGIN;

UPDATE public.cms_texts
SET he_text = 'כל מה שצריך כדי לבנות זוגיות טובה יותר מחכה לכם במקום אחד. מתחילים באבחון קצר של כ-3 דקות, וכל 8 שבועות נבדוק יחד כמה התקדמתם. אפשר לעצור בכל עת.',
    en_text = 'Everything you need to build a stronger relationship is in one place. You start with a short 3-minute assessment, and every 8 weeks we check together how far you''ve come. You can stop anytime.'
WHERE key = 'appShell.today.upsellBody';

UPDATE public.cms_texts
SET he_text = 'פרק חדש כל שבוע',
    en_text = 'A new chapter every week'
WHERE key = 'appShell.today.upsellBullet1';

UPDATE public.cms_texts
SET he_text = 'פעילות זוגית חדשה כל שבוע',
    en_text = 'A new couple activity every week'
WHERE key = 'appShell.today.upsellBullet2';

INSERT INTO public.cms_texts (key, page, section, he_text, en_text, is_rich) VALUES
  ('appShell.today.upsellBullet3', 'app-shell', 'today',
    'מומחה זוגיות פרטי בצ''אט', 'A private relationship expert in chat', false),
  ('appShell.today.upsellBullet4', 'app-shell', 'today',
    'גישה חופשית לכל משחקי הסקס של מיאושי', 'Free access to all of Mioshy''s sex games', false),
  ('appShell.today.upsellBullet5', 'app-shell', 'today',
    'גישה חופשית לכל משחקי הזוגות אונליין', 'Free access to all the online couples games', false)
ON CONFLICT (key) DO UPDATE
  SET he_text = EXCLUDED.he_text,
      en_text = EXCLUDED.en_text,
      is_rich = EXCLUDED.is_rich;

COMMIT;
