-- 125_cms_texts_expert_days_and_dashboard.sql
-- =============================================================================
-- Work-order 2026-06-15, part B.
--
-- B.1 — Factual fix: the expert is available 5 days a week, not 7. Update every
-- CMS row that states the expert's weekly availability (he + en). These keys are
-- DB-backed (seeded in 094/100/106) so the public site renders the cms_texts
-- value, NOT the messages/*.json fallback — both have been updated for parity,
-- but this migration is what actually changes the live copy. The "מרתון זוגי 7
-- ימים" marathon copy is a DIFFERENT meaning and is deliberately untouched.
--
-- B.6 — journeyAssessment.analysis.goAccount: "מיאושי שלי" → "מעבר לדשבורד שלי"
-- (more serious wording). Seeded in 091 — do NOT edit 091; this supersedes it.
--
-- Plain UPDATE by key: a factual/brand correction that must be consistent. Safe
-- to re-run (idempotent — sets absolute values). Other admin edits to unrelated
-- keys are not touched.
-- =============================================================================

BEGIN;

-- B.1 — expert availability: 7 → 5 days a week
UPDATE public.cms_texts
SET he_text = 'מומחה זוגיות פרטי, זמין בצ׳אט 5 ימים בשבוע',
    en_text = 'Your own relationship expert, available 5 days a week'
WHERE key = 'appShell.today.upsellBullet3';

UPDATE public.cms_texts
SET he_text = 'מומחה זוגיות פרטי לצ׳אט, 5 ימים בשבוע',
    en_text = 'Private relationship expert in chat, 5 days a week'
WHERE key = 'appShell.expert.gateBullet1';

UPDATE public.cms_texts
SET he_text = 'זמין חמישה ימים בשבוע — שולחים שאלה ברגע שעולה, מקבלים מענה כשמוכנים',
    en_text = 'Available five days a week — send a question the moment it comes up, get a real reply when ready'
WHERE key = 'journeyAssessment.analysis.expertBullet1';

-- B.6 — "מיאושי שלי" → "מעבר לדשבורד שלי"
UPDATE public.cms_texts
SET he_text = 'מעבר לדשבורד שלי',
    en_text = 'Go to my dashboard'
WHERE key = 'journeyAssessment.analysis.goAccount';

COMMIT;
