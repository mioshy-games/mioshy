-- ============================================================
-- 051 — journey_user_messages: free-text channel from user to clinician
-- ============================================================
-- Phase 4 of the redesign. The user can leave a note for their
-- clinician from the dashboard (JourneyExpertMessage component).
-- The clinician sees these in /dashboard/my-clients/[coupleId]
-- alongside the journey-item Inbox.
--
-- This is NOT a chat. There is no thread, no DMs, no real-time. The
-- clinician reads + acts via the existing intervention surfaces. We
-- intentionally omit a "reply" column for now to keep the UX
-- one-way (user → clinician). Replies happen via journey content
-- the clinician assigns.
--
-- Hard rules:
--   - RLS enforces ownership: a user can only INSERT/SELECT their
--     own messages; service-role can read all (for the admin Inbox).
--   - Triage status mirrors journey_item_responses for consistency.
--   - We never display these messages to a partner — they're solo.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.journey_user_messages (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  -- Optional couple context — useful for the admin Inbox grouping.
  couple_id       uuid        references public.couples(id) on delete set null,
  message_text    text        not null
                  check (length(trim(message_text)) > 0
                         and length(message_text) <= 4000),
  -- Clinician triage workflow — mirrors journey_item_responses.
  clinician_status      text default null
                        check (clinician_status in ('open', 'resolved', 'concerning')),
  clinician_id          uuid references auth.users(id) on delete set null,
  clinician_replied_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists journey_user_messages_user_idx
  on public.journey_user_messages (user_id, created_at desc);
create index if not exists journey_user_messages_couple_idx
  on public.journey_user_messages (couple_id, created_at desc);
create index if not exists journey_user_messages_open_idx
  on public.journey_user_messages (created_at desc)
  where clinician_status is null or clinician_status = 'open';

-- Touch updated_at on every UPDATE.
drop trigger if exists journey_user_messages_set_updated_at
  on public.journey_user_messages;
create trigger journey_user_messages_set_updated_at
  before update on public.journey_user_messages
  for each row execute procedure public.tg_set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.journey_user_messages enable row level security;

-- Service-role (admin / scheduled jobs) — full access
drop policy if exists "journey_user_messages: service_role full access"
  on public.journey_user_messages;
create policy "journey_user_messages: service_role full access"
  on public.journey_user_messages for all
  to service_role using (true) with check (true);

-- User can INSERT their own messages
drop policy if exists "journey_user_messages: user inserts own"
  on public.journey_user_messages;
create policy "journey_user_messages: user inserts own"
  on public.journey_user_messages for insert
  to authenticated
  with check (user_id = auth.uid());

-- User can SELECT their own messages (so they can see their history
-- if we add that view later — currently the UI is fire-and-forget)
drop policy if exists "journey_user_messages: user reads own"
  on public.journey_user_messages;
create policy "journey_user_messages: user reads own"
  on public.journey_user_messages for select
  to authenticated
  using (user_id = auth.uid());

commit;

select pg_notify('pgrst', 'reload schema');
