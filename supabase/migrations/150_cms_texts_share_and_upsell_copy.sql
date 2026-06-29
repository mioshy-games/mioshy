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
--   • appShell.today.upsellBody — NoJourneyUpsell body, enriched + warmer.
--
-- Additive: UPDATEs the he_text/en_text of existing rows only (no new keys,
-- no schema change). Keys were seeded in 098 (share.*) and 100 (today.*).
-- These overwrite any prior admin edit on exactly these three rows — that is
-- the intent here (we want the new product copy live).

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
SET he_text = 'כל מה שצריך כדי לבנות זוגיות טובה יותר מחכה לכם במקום אחד. מתחילים באבחון קצר שמכיר אתכם, וממשיכים עם פרקים שמותאמים בדיוק לכם וצ''אט פתוח עם מומחה זוגיות שמלווה אתכם לאורך כל הדרך. מנוי שבועי גמיש, ואתם יכולים לעצור מתי שתרצו.',
    en_text = 'Everything you need to build a stronger relationship is waiting in one place. You start with a short assessment that gets to know you, then keep going with chapters made just for you and an open chat with a relationship expert who stays with you the whole way. A flexible weekly subscription you can stop whenever you want.'
WHERE key = 'appShell.today.upsellBody';

COMMIT;
