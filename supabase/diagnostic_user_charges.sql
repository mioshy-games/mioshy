-- diagnostic_user_charges.sql
-- =============================================================================
-- READ-ONLY diagnostic — בודק את החיובים של שני משתמשים ספציפיים.
-- אין כאן UPDATE/INSERT/DELETE/ALTER — בטוח להרצה ב-Supabase SQL Editor.
--
-- המזהים מוטמעים ישירות (בלי \set). אפשר להריץ הכל ביחד, או כל בלוק בנפרד.
-- להחלפת משתמשים — ערוך את הרשימה בכל WHERE.
--   ef62c1c2-ce40-44de-ab3f-bd930f423bfc  (Yitzhak Barlev / pay1@gmail.com)
--   dd9781bd-2c77-493a-8ba8-3304e0016b45  (pay1 / pay2@gmail.com)
-- =============================================================================

-- ── 1) פרופיל + auth ────────────────────────────────────────────────────────
SELECT
  u.id AS user_id, u.email, p.full_name, p.phone,
  u.created_at AS signed_up_at, u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.id IN (
  'ef62c1c2-ce40-44de-ab3f-bd930f423bfc',
  'dd9781bd-2c77-493a-8ba8-3304e0016b45'
)
ORDER BY u.created_at;

-- ── 2) מנויים ───────────────────────────────────────────────────────────────
SELECT
  s.user_id, s.id AS subscription_id, s.plan, s.status,
  s.current_period_end, s.created_at
FROM public.subscriptions s
WHERE s.user_id IN (
  'ef62c1c2-ce40-44de-ab3f-bd930f423bfc',
  'dd9781bd-2c77-493a-8ba8-3304e0016b45'
)
ORDER BY s.user_id, s.created_at DESC;

-- ── 3) אמצעי תשלום (בלי לחשוף את הטוקן המוצפן) ──────────────────────────────
SELECT
  cpm.user_id, cpm.provider, cpm.card_brand, cpm.last4,
  cpm.expiry_mmyy, cpm.status, cpm.created_at
FROM public.customer_payment_methods cpm
WHERE cpm.user_id IN (
  'ef62c1c2-ce40-44de-ab3f-bd930f423bfc',
  'dd9781bd-2c77-493a-8ba8-3304e0016b45'
)
ORDER BY cpm.user_id, cpm.created_at DESC;

-- ── 4) כל החיובים (initial + חידושים) ──────────────────────────────────────
SELECT
  sc.user_id, sc.created_at,
  sc.status,                         -- created / succeeded / failed
  sc.amount, sc.currency,
  sc.billing_period_start, sc.billing_period_end,
  sc.uniq_asmachta,                  -- אסמכתת Cardcom
  sc.invoice_url, sc.subscription_id
FROM public.subscription_charges sc
WHERE sc.user_id IN (
  'ef62c1c2-ce40-44de-ab3f-bd930f423bfc',
  'dd9781bd-2c77-493a-8ba8-3304e0016b45'
)
ORDER BY sc.user_id, sc.created_at DESC;

-- ── 5) סיכום לכל משתמש ──────────────────────────────────────────────────────
SELECT
  sc.user_id,
  COUNT(*)                                            AS charges_total,
  COUNT(*) FILTER (WHERE sc.status = 'succeeded')     AS succeeded,
  COUNT(*) FILTER (WHERE sc.status = 'failed')        AS failed,
  COUNT(*) FILTER (WHERE sc.status = 'created')       AS pending,
  COALESCE(SUM(sc.amount) FILTER (WHERE sc.status = 'succeeded'), 0) AS total_charged_succeeded,
  MIN(sc.created_at)                                  AS first_charge,
  MAX(sc.created_at)                                  AS last_charge
FROM public.subscription_charges sc
WHERE sc.user_id IN (
  'ef62c1c2-ce40-44de-ab3f-bd930f423bfc',
  'dd9781bd-2c77-493a-8ba8-3304e0016b45'
)
GROUP BY sc.user_id
ORDER BY sc.user_id;
