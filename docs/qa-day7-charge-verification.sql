-- ============================================================
-- qa-day7-charge-verification.sql   (Task 35(ב) — Itzik 2026-07-03)
--
-- Live canary: the QA trial sub created 2026-07-03 12:22 UTC stays deliberately
-- uncancelled so the renewals cron makes its FIRST REAL charge (37 ₪) when the
-- trial ends. Run this AFTER the charge fires to confirm it happened correctly.
--
-- ⚠️ TIMING: trial_ends_at / next_billing_date = 2026-07-10 12:22 UTC. The cron
-- runs daily at 06:00 UTC (vercel.json). So the 07-10 06:00 run is NOT yet due
-- (12:22 > 06:00); the charge fires on the **2026-07-11 06:00 UTC** run.
-- → Run this query on 2026-07-11 (after ~06:15 UTC / 09:15 Israel).
--
-- Expected from the dry-run:
--   billAmount 37 ₪ (intro promo; intro_charges_remaining 1 → use_intro=true)
--   uniqAsmachta = m:21da31165956:20260710
--   is_test_user = false (so it charges for real)
-- ============================================================

-- 1) Subscription — should have flipped trialing → active, period advanced a
--    month, intro burned (1 → 0), trial_ends_at unchanged.
--    BEFORE the charge: status='trialing', current_period_end=2026-07-10 12:22,
--    intro_charges_remaining=1.
--    AFTER:  status='active', current_period_end≈2026-08-10 12:22,
--    next_billing_date≈2026-08-10, intro_charges_remaining=0.
select id, status, plan, plan_amount, intro_amount, intro_charges_remaining,
       trial_ends_at, current_period_end, next_billing_date, failed_attempts,
       grace_until, invoice_url
from public.subscriptions
where id = '4d2116d8-f31d-4e32-a29b-43da8d5bc3e4';

-- 2) The charge row — the proof of the real 37 ₪ charge. Idempotency anchor is
--    the asmachta. Expect exactly ONE row, status='succeeded', amount=37.
select id, subscription_id, amount, currency, status, uniq_asmachta,
       billing_period_start, billing_period_end, invoice_url, created_at, updated_at
from public.subscription_charges
where uniq_asmachta = 'm:21da31165956:20260710';

-- 3) Same, scoped by subscription_id (belt-and-suspenders — catches an asmachta
--    drift if periodStart differed by a day).
select id, amount, currency, status, uniq_asmachta, created_at
from public.subscription_charges
where subscription_id = '4d2116d8-f31d-4e32-a29b-43da8d5bc3e4'
order by created_at desc;

-- 4) Failure signal — if the charge FAILED, the sub goes past_due + an admin
--    alert is queued. A row here means the charge did not succeed.
select idempotency_key, processed, error, created_at
from public.billing_events
where idempotency_key ilike '%21da3116%'
   or created_at >= '2026-07-11 00:00:00+00'
order by created_at desc
limit 20;

-- PASS when: (1) status='active' + intro_charges_remaining=0, (2) one
-- subscription_charges row status='succeeded' amount=37 with an invoice_url,
-- and no trial_first_charge_failed alert.
