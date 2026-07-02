-- ============================================================
-- qa-trial-promo-date-shift.sql
-- QA helpers for the 7-day trial + promo_mode (tasks 20/21) test plan.
--
-- ⚠️ Every statement is scoped to ONE test account by email. Set :EMAIL first.
-- Use a dedicated QA account, NEVER a real customer. All writes are reversible
-- (read-backs + a reset block at the end). Run in the Supabase SQL editor.
-- ============================================================

-- ── 0. Pick the test account ────────────────────────────────────────────────
-- Replace the email everywhere below (SQL editor has no \set; just edit inline).
-- Find the user + their latest journey + subscription:
select u.id as user_id, u.email,
       j.id as journey_id, j.status as journey_status, j.offer_expires_at,
       s.id as sub_id, s.status as sub_status, s.trial_ends_at,
       s.next_billing_date, s.plan_amount, s.intro_amount, s.intro_charges_remaining
from auth.users u
left join public.journeys j on j.user_id = u.id
left join public.subscriptions s on s.user_id = u.id
where u.email = 'QA_EMAIL_HERE'
order by j.started_at desc nulls last, s.created_at desc nulls last;

-- ── 1. Personal window — IN WINDOW (offer valid ~47h) ───────────────────────
-- Expect: checkout/create-trial applies the intro price; results page shows it.
update public.journeys
  set offer_expires_at = now() + interval '47 hours'
  where user_id = (select id from auth.users where email = 'QA_EMAIL_HERE')
    and offer_expires_at is not null;  -- keep it scoped to the stamped journey

-- ── 2. Personal window — EXPIRED (offer passed 1h ago) ──────────────────────
-- Expect: checkout sends the FULL price; results page shows regular price.
update public.journeys
  set offer_expires_at = now() - interval '1 hour'
  where user_id = (select id from auth.users where email = 'QA_EMAIL_HERE')
    and offer_expires_at is not null;

-- ── 3. Trial day for chip / days-6-7 escalation ─────────────────────────────
-- Day 5 (~2d left): chip "יום 5 מתוך 7", no escalation yet.
update public.subscriptions
  set trial_ends_at = now() + interval '2 days'
  where user_id = (select id from auth.users where email = 'QA_EMAIL_HERE')
    and status = 'trialing';
-- Day 6 (~1d left): escalation line should appear on /my.
--   set trial_ends_at = now() + interval '1 day'  (edit the interval above)

-- ── 4. Day-7 charge DUE (the critical test 5) ───────────────────────────────
-- Make the trialing sub due NOW so the renewals cron charges it. To prove the
-- lock SURVIVES window expiry, run step 2 (expire the window) FIRST, then this:
update public.subscriptions
  set trial_ends_at     = now() - interval '1 minute',
      next_billing_date = now() - interval '1 minute'
  where user_id = (select id from auth.users where email = 'QA_EMAIL_HERE')
    and status = 'trialing';
-- Then trigger the cron (Bearer CARDCOM_BILLING_CRON_SECRET):
--   GET  <preview>/api/billing/renewals/run   (Authorization: Bearer <secret>)
-- Expect: it charges intro_amount (NOT plan_amount) because the snapshot holds
-- the lock — independent of offer_expires_at. Verify subscription_charges.amount.

-- ── 5. Read-back after any step ─────────────────────────────────────────────
select s.status, s.trial_ends_at, s.next_billing_date,
       s.plan_amount, s.intro_amount, s.intro_charges_remaining,
       j.offer_expires_at,
       (select ss.promo_mode from public.site_settings ss where ss.id = 1) as promo_mode
from public.subscriptions s
left join public.journeys j on j.user_id = s.user_id
where s.user_id = (select id from auth.users where email = 'QA_EMAIL_HERE')
order by s.created_at desc limit 1;

select uniq_asmachta, amount, currency, status, created_at
from public.subscription_charges
where user_id = (select id from auth.users where email = 'QA_EMAIL_HERE')
order by created_at desc limit 5;

-- ── 6. RESET the QA account (re-run trials cleanly) ─────────────────────────
-- Clears the trial + redemption + window so the account can trial again.
-- (Does NOT delete the auth user.)
-- delete from public.trial_redemptions
--   where user_id = (select id from auth.users where email = 'QA_EMAIL_HERE');
-- update public.subscriptions set status = 'cancelled', next_billing_date = null,
--        trial_ends_at = null
--   where user_id = (select id from auth.users where email = 'QA_EMAIL_HERE');
-- update public.journeys set offer_expires_at = null
--   where user_id = (select id from auth.users where email = 'QA_EMAIL_HERE');
