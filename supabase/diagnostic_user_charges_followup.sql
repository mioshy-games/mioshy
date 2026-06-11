-- diagnostic_user_charges_followup.sql  (READ-ONLY)
-- מעמיק: למה החידוש של משתמש 2 נכשל, ומה רואים ב-billing_events.

-- ── 1) תשובת Cardcom המלאה לחיוב שנכשל (משתמש 2) ───────────────────────────
SELECT user_id, created_at, status, amount, uniq_asmachta, raw_response
FROM public.subscription_charges
WHERE user_id = 'dd9781bd-2c77-493a-8ba8-3304e0016b45'
  AND status = 'failed'
ORDER BY created_at DESC;

-- ── 2) callbacks/אירועים של Cardcom — לזהות לא-מעובדים או שגיאות ────────────
--      (payload הוא jsonb; מסננים את 50 האחרונים, מסתכלים על processed/error)
SELECT id, processed, error, created_at, payload
FROM public.billing_events
ORDER BY created_at DESC
LIMIT 50;

-- ── 3) מצב המנוי המלא (כל העמודות) — אולי יש שדות grace/retry שלא ראינו ─────
SELECT *
FROM public.subscriptions
WHERE user_id IN (
  'ef62c1c2-ce40-44de-ab3f-bd930f423bfc',
  'dd9781bd-2c77-493a-8ba8-3304e0016b45'
);
