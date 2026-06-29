-- 150_cms_texts_share_and_upsell_copy.sql
--
-- Copy refresh for three already-seeded cms_texts rows (live values win
-- over messages/*.json, so the JSON edits in this branch are not enough on
-- their own — these rows must be updated too):
--
--   • appShell.share.body      — /my/share lede (ShareHero). Games are now
--                                open to the partner, not "eventually".
--   • appShell.share.copyLabel — the primary copy button now copies the bare
--                                pair code, so the label reads "העתקת הקוד".
--   • appShell.today.upsellBody    — NoJourneyUpsell body (final copy).
--   • appShell.today.upsellBullet1 — NoJourneyUpsell bullet 1 (final copy).
--   • appShell.today.upsellBullet2 — NoJourneyUpsell bullet 2 (final copy).
--
-- The NoJourneyUpsell body + these two bullets are now the single shared copy
-- rendered on the /my/lessons blocked-partner takeover, the /my/lessons
-- no-journey upsell, and the /my/expert gate (see getNoJourneyUpsellCopy).
-- upsellBullet3 is no longer rendered (left in place, harmless).
--
-- Additive: UPDATEs the he_text/en_text of existing rows only (no new keys,
-- no schema change). Keys were seeded in 098 (share.*) and 100 (today.*).
-- These overwrite any prior admin edit on exactly these rows — that is the
-- intent here (we want the new product copy live).

BEGIN;

UPDATE public.cms_texts
SET he_text = 'הם יקבלו בדיוק את מה שיש לכם. כל הפרקים והצ''אט עם המומחה, וגם כל המשחקים פתוחים להם בלי תוספת תשלום. רק לבני הזוג שלכם.',
    en_text = 'They get exactly what you have. All the chapters, the chat with your expert, and every game open to them at no extra cost. Just for your partner.'
WHERE key = 'appShell.share.body';

UPDATE public.cms_texts
SET he_text = 'העתקת הקוד',
    en_text = 'Copy code'
WHERE key = 'appShell.share.copyLabel';

UPDATE public.cms_texts
SET he_text = 'כל שבוע פרק חדש עם משימות שהמומחים שלנו לזוגיות הכינו במיוחד עבורכם, והם פה ללוות אתכם בצ''אט לאורך כל המסע. מתחילים באבחון קצר של כ-3 דקות, וכל 8 שבועות נבדוק יחד כמה התקדמתם. אפשר לעצור בכל עת.',
    en_text = 'Every week a new chapter with tasks our relationship experts prepared especially for you, and they''re here to guide you in chat throughout the journey. You start with a short 3-minute assessment, and every 8 weeks we check together how far you''ve come. You can stop anytime.'
WHERE key = 'appShell.today.upsellBody';

UPDATE public.cms_texts
SET he_text = 'גישה חופשית לכל משחקי הסקס של מיאושי.',
    en_text = 'Free access to all of Mioshy''s sex games.'
WHERE key = 'appShell.today.upsellBullet1';

UPDATE public.cms_texts
SET he_text = 'גישה חופשית לכל משחקי הזוגות אונליין.',
    en_text = 'Free access to all the online couples games.'
WHERE key = 'appShell.today.upsellBullet2';

COMMIT;
