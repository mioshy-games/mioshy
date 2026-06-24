-- ───────────────────────────────────────────────────────────────────────────
-- 142_marathon_enrollments.sql
--
-- 7-day couples WhatsApp marathon — per-lead enrollment state + per-day send
-- log. A marathon lead (leads.source='marathon-7day') is enrolled on signup;
-- day 1 is the NEXT calendar day (Israel time), and a daily cron sends day N on
-- (started_on + N-1) at the weekday-dependent slot.
--
-- service-role only (RLS on, no policies) — same lock-down as whatsapp_messages.
-- Numbered 142 to clear the pending 139/140/141 on other branches/PRs.
-- Idempotent.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.marathon_enrollments (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references public.leads(id) on delete set null,
  phone           text not null,                 -- raw mobile; normalised at send time
  language        text not null default 'he',
  started_on      date not null,                 -- calendar date of DAY 1 (Israel)
  status          text not null default 'active'
                    check (status in ('active', 'completed', 'stopped')),
  welcome_sent_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One active enrollment per phone — re-signup while active is a no-op.
create unique index if not exists marathon_enrollments_active_phone_idx
  on public.marathon_enrollments (phone)
  where status = 'active';
create index if not exists marathon_enrollments_status_idx
  on public.marathon_enrollments (status, started_on);

create table if not exists public.marathon_day_sends (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.marathon_enrollments(id) on delete cascade,
  day           int  not null check (day between 1 and 7),
  sent_at       timestamptz not null default now(),
  wa_message_id text,
  status        text not null default 'sent' check (status in ('sent', 'failed')),
  unique (enrollment_id, day)                    -- idempotency: one row per day
);
create index if not exists marathon_day_sends_enrollment_idx
  on public.marathon_day_sends (enrollment_id);

alter table public.marathon_enrollments enable row level security;
alter table public.marathon_day_sends   enable row level security;
-- No policies → only service_role (which bypasses RLS) reads/writes.

-- updated_at touch on enrollments (mirror whatsapp_messages pattern).
create or replace function public.touch_marathon_enrollments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_touch_marathon_enrollments on public.marathon_enrollments;
create trigger trg_touch_marathon_enrollments
  before update on public.marathon_enrollments
  for each row execute function public.touch_marathon_enrollments_updated_at();

notify pgrst, 'reload schema';
