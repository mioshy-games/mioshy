-- ============================================================================
--  Mioshy — verify + force a real renewal charge for dog1@gmail.com
--  Project: kphfmbqqafrvuzmiotsz (Supabase SQL Editor)
--  Run STEP by STEP. Read STEP 1 output before running STEP 2.
-- ============================================================================
-- How the renewals cron (/api/billing/renewals/run, daily 06:00 UTC) decides:
--   1. subscriptions.status IN ('active','past_due')
--   2. subscriptions.next_billing_date <= now()
--   3. profiles.is_test_user = false      <-- test users are SKIPPED, no charge
--   4. linked customer_payment_methods row, status='active', valid token
--   On success: charges plan_amount via Cardcom, writes subscription_charges
--   row (status='succeeded'), advances next_billing_date by +3 months
--   (quarterly), and issues a uxellent invoice.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 1 — VERIFY current state (run this first, read every column)
-- ─────────────────────────────────────────────────────────────────────────
select
  p.id                       as user_id,
  p.email,
  p.is_test_user,            -- ⚠ must be FALSE or the cron skips the charge
  s.id                       as subscription_id,
  s.status,                  -- must be 'active' or 'past_due'
  s.plan,                    -- expect 'quarterly'
  s.plan_amount,             -- expect 1
  s.currency,
  s.coin_id,
  s.current_period_end,      -- charge period anchor (asmachta keyed on this date)
  s.next_billing_date,       -- must be <= now() to be picked up
  s.failed_attempts,
  s.grace_until,
  s.payment_method_id,
  pm.status                  as pm_status,    -- must be 'active'
  pm.card_brand,
  pm.expiry_mmyy,
  (pm.token_enc is not null) as has_saved_token  -- must be TRUE (real card on file)
from profiles p
join subscriptions s                   on s.user_id = p.id
left join customer_payment_methods pm  on pm.id = s.payment_method_id
where p.email = 'dog1@gmail.com';

-- Interpreting STEP 1:
--   • is_test_user = true        → cron will SKIP. STEP 2 flips it to false.
--   • pm_status <> 'active' OR has_saved_token = false
--                                → NO real card saved. The cron will throw
--                                  "No active payment method", mark the sub
--                                  past_due, and NOT charge. You'd need to
--                                  re-run the real checkout to save a token
--                                  before a charge can succeed.
--   • next_billing_date in future → STEP 2 pulls it into the past.


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 2 — FORCE the subscription to be due now + allow a REAL charge
--           (only run after STEP 1 confirms an active saved token exists)
-- ─────────────────────────────────────────────────────────────────────────
update profiles
   set is_test_user = false
 where email = 'dog1@gmail.com';

update subscriptions
   set status            = 'active',
       next_billing_date = now() - interval '1 minute',
       failed_attempts   = 0,
       grace_until       = null
 where email = 'dog1@gmail.com';

-- Confirm the writes landed:
select email, is_test_user
  from profiles where email = 'dog1@gmail.com';
select email, status, next_billing_date, current_period_end
  from subscriptions where email = 'dog1@gmail.com';


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 3 — trigger the cron manually (run in your terminal, in the repo dir).
--           GET is aliased to POST, so this works:
-- ─────────────────────────────────────────────────────────────────────────
--   set -a; source .env.local; set +a
--   curl -i "https://mioshy.com/api/billing/renewals/run" \
--        -H "Authorization: Bearer $CARDCOM_BILLING_CRON_SECRET"
--
--   Expect JSON: {"processed":1,"results":[{"sub_id":"...","status":"charged"}]}
--   (or wait for the 06:00 UTC scheduled run)


-- ─────────────────────────────────────────────────────────────────────────
-- STEP 4 — VERIFY the charge succeeded
-- ─────────────────────────────────────────────────────────────────────────
select
  s.status,                -- back to 'active'
  s.next_billing_date,     -- should now be ~ +3 months from before
  s.current_period_end,
  s.invoice_url
from subscriptions s
where s.email = 'dog1@gmail.com';

select
  c.created_at,
  c.amount,
  c.currency,
  c.status,                -- 'succeeded' = real charge went through
  c.uniq_asmachta,
  c.invoice_url,
  c.billing_period_start,
  c.billing_period_end
from subscription_charges c
join subscriptions s on s.id = c.subscription_id
where s.email = 'dog1@gmail.com'
order by c.created_at desc
limit 5;


-- ─────────────────────────────────────────────────────────────────────────
-- (OPTIONAL) STEP 5 — restore test-user status when you're done testing
-- ─────────────────────────────────────────────────────────────────────────
-- update profiles set is_test_user = true where email = 'dog1@gmail.com';
