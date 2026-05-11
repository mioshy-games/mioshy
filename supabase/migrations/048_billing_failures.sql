-- ============================================================
-- 048 - Mioshy billing failures (issuer-side: app.uxellent.com)
-- ============================================================
-- Purpose:
--   Persist EVERY post-payment failure when Mioshy calls the external
--   billing API (`/api/billing/create-document` on app.uxellent.com).
--   We currently only `console.error` such failures, which means a
--   transient network blip ⇒ a paying user with no invoice and no
--   record anywhere. This table is the source of truth for the daily
--   repair job and for monitoring/alerts.
--
-- Invariants:
--   - Service-role-only writes (mioshy API routes use the service key).
--   - Authenticated users may read their OWN failures so support can
--     show "we know about this" in-app if we ever want to.
--   - `error_code` is a STABLE short string for grouping in alerts
--     (e.g. 'network_error', 'http_502', 'invalid_json',
--     'provider_error', 'retry_exhausted').
--   - `payload` stores the request body we sent (PII-light: email,
--     amount - no card data ever).
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.mioshy_billing_failures (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        references auth.users(id) on delete set null,
  subscription_id uuid        references public.subscriptions(id) on delete set null,
  charge_id       uuid        references public.subscription_charges(id) on delete set null,
  deal_number     text,
  error_message   text        not null,
  error_code      text        not null default 'unknown',
  payload         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists mioshy_billing_failures_user_idx
  on public.mioshy_billing_failures(user_id);
create index if not exists mioshy_billing_failures_subscription_idx
  on public.mioshy_billing_failures(subscription_id);
create index if not exists mioshy_billing_failures_charge_idx
  on public.mioshy_billing_failures(charge_id);
create index if not exists mioshy_billing_failures_deal_idx
  on public.mioshy_billing_failures(deal_number);
create index if not exists mioshy_billing_failures_code_idx
  on public.mioshy_billing_failures(error_code);
create index if not exists mioshy_billing_failures_created_idx
  on public.mioshy_billing_failures(created_at desc);

alter table public.mioshy_billing_failures enable row level security;

drop policy if exists "mioshy_billing_failures: service_role full access"
  on public.mioshy_billing_failures;
create policy "mioshy_billing_failures: service_role full access"
  on public.mioshy_billing_failures for all
  to service_role using (true) with check (true);

drop policy if exists "mioshy_billing_failures: user reads own"
  on public.mioshy_billing_failures;
create policy "mioshy_billing_failures: user reads own"
  on public.mioshy_billing_failures for select
  to authenticated using (user_id = auth.uid());

comment on table public.mioshy_billing_failures is
  'Post-payment failures when calling the external billing API. Read by the daily repair cron and by alerting.';
comment on column public.mioshy_billing_failures.error_code is
  'Stable short code for alert grouping (network_error, http_5xx, invalid_json, provider_error, retry_exhausted, etc.).';
comment on column public.mioshy_billing_failures.payload is
  'Request body sent to the issuer (no card data - only email/amount/plan).';
