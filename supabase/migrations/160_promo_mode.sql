-- ============================================================
-- 160_promo_mode.sql  (Task 20 — dual urgency mechanism)
--
-- Admin-selectable urgency mode + the per-user 48h personal offer window.
-- Additive; changes no behaviour until the checkout gate (code) reads it.
--   • site_settings.promo_mode — one of off | personal_window | campaign_timer.
--     Default 'personal_window' (the new default per the 2026-07-02 decision).
--   • journeys.offer_expires_at — stamped now+48h when the SHORT assessment
--     completes (app/api/journey/answer). The intro price is server-enforced at
--     checkout only while now < offer_expires_at; the lock is snapshotted onto
--     the subscription at signup, so the day-7 charge honours it.
-- ============================================================

begin;

alter table public.site_settings
  add column if not exists promo_mode text not null default 'personal_window';

-- CHECK as a separate, idempotent step (add only if missing).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'site_settings_promo_mode_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_promo_mode_check
      check (promo_mode in ('off', 'personal_window', 'campaign_timer'));
  end if;
end $$;

comment on column public.site_settings.promo_mode is
  'Urgency mode (task 20): off | personal_window (per-user 48h intro window, '
  'server-enforced at checkout) | campaign_timer (existing global promo timer). '
  'One active at a time.';

alter table public.journeys
  add column if not exists offer_expires_at timestamptz;

comment on column public.journeys.offer_expires_at is
  'Personal 48h intro-offer deadline, stamped on SHORT-assessment completion. '
  'In promo_mode=personal_window the intro discount applies at checkout only '
  'while now < offer_expires_at (server-enforced). NULL = no personal window.';

-- Cron/lookup helper for the personal-window query at checkout.
create index if not exists journeys_offer_expires_idx
  on public.journeys (user_id, offer_expires_at)
  where offer_expires_at is not null;

commit;

select pg_notify('pgrst', 'reload schema');
