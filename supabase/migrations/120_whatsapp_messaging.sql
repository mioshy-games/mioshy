-- 097_whatsapp_messaging.sql
-- WhatsApp Cloud API integration: opt-in tracking on profiles + outbound/inbound message log.
-- Idempotent. See docs/whatsapp-integration-spec.md.

-- 1) Opt-in columns on profiles -------------------------------------------------
alter table public.profiles
  add column if not exists whatsapp_opt_in        boolean     not null default false,
  add column if not exists whatsapp_opt_in_at      timestamptz,
  add column if not exists whatsapp_opt_in_source  text,
  add column if not exists whatsapp_opt_out_at     timestamptz;

comment on column public.profiles.whatsapp_opt_in is
  'User consented to receive WhatsApp utility messages (reminders, invites).';
comment on column public.profiles.whatsapp_opt_in_source is
  'Where consent was captured, e.g. signup-form, profile-complete, crm.';

-- 2) Message log / status tracking ---------------------------------------------
create table if not exists public.whatsapp_messages (
  id                uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references auth.users(id) on delete set null,
  to_phone          text,
  direction         text not null default 'outbound'
                       check (direction in ('outbound', 'inbound')),
  template_name     text,
  category          text,                 -- utility | authentication | marketing | service
  wa_message_id     text,                 -- Meta wamid (for status correlation)
  status            text not null default 'queued'
                       check (status in ('queued','sent','delivered','read','failed','received')),
  error             jsonb,
  payload           jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists whatsapp_messages_wamid_idx
  on public.whatsapp_messages (wa_message_id);
create index if not exists whatsapp_messages_recipient_idx
  on public.whatsapp_messages (recipient_user_id);
create index if not exists whatsapp_messages_status_idx
  on public.whatsapp_messages (status);
create index if not exists whatsapp_messages_created_idx
  on public.whatsapp_messages (created_at desc);

-- 3) RLS: lock down — only service role writes/reads. ---------------------------
alter table public.whatsapp_messages enable row level security;
-- No policies for anon/authenticated => only service_role (which bypasses RLS) can access.

-- 4) updated_at touch trigger ---------------------------------------------------
create or replace function public.touch_whatsapp_messages_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_whatsapp_messages on public.whatsapp_messages;
create trigger trg_touch_whatsapp_messages
  before update on public.whatsapp_messages
  for each row execute function public.touch_whatsapp_messages_updated_at();

-- Refresh PostgREST schema cache (see migration 064 pattern).
notify pgrst, 'reload schema';
