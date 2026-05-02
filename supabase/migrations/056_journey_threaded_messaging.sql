-- ============================================================
-- 056_journey_threaded_messaging.sql
-- Slice 6 of the v3 per-partner content delivery system.
--
-- Introduces a unified threaded-message model. Two surfaces share
-- one storage table:
--
--   * Per-item threads — every delivered scheduled_item is a prompt
--     that expects a response (Update B). The thread under the item
--     holds the user's response(s), the expert pool's reply/replies,
--     and reactions on each message.
--
--   * General expert channel — one persistent two-way thread per
--     user, independent of any item. The user can ask anything;
--     experts in the pool can respond. Each user has their own
--     channel; partners cannot see each other's general thread by
--     default (per Itzik #7).
--
-- DESIGN NOTES:
--
--   1. journey_messages.scheduled_item_id XOR channel_user_id —
--      every row belongs to exactly one surface (CHECK constraint).
--   2. is_private defaults differ by surface:
--        per-item:  default FALSE — partners CAN see each other's
--                   responses (matches existing journey_item_responses
--                   semantics; per-row override still allowed).
--        general:   default TRUE  — general-channel posts are solo
--                   by design; partner cannot see them. The defaults
--                   are enforced at the application layer (the trigger
--                   below validates author against owner).
--   3. reactions stored as `{":heart:": ["uid-1","uid-2"], ...}` so
--      the toggleReaction server action just appends/removes the
--      author_user_id. Avoids per-reaction rows for v1.
--   4. Coexistence with legacy tables (slice 6 ships dual-write):
--        - journey_item_responses — still authoritative for the
--          existing clinician inbox queries until a future slice
--          migrates them. journey_messages.legacy_response_id links
--          back when a journey_messages row was created from a
--          legacy response.
--        - journey_user_messages — same pattern via legacy_user_message_id.
--      New posts write to BOTH tables; the dashboard inbox keeps
--      working unchanged. Slice 6 back-fill below imports every
--      historical row into journey_messages so the new thread UI
--      shows complete history from day one.
--   5. journey_notifications log — minimal "ping" table (slice 10
--      builds the proper inbox; here we just record the events so the
--      data is there when the inbox lands).
-- ============================================================

begin;

create extension if not exists pgcrypto;


-- ============================================================
-- SECTION 1 — General-channel container (one row per user)
-- Lazily created the first time a user posts in their channel OR
-- the first time an expert replies to them. Holds last_message_at
-- so the dashboard can surface "who has unread chatter" without
-- aggregating over journey_messages on every read.
-- ============================================================

create table if not exists public.journey_user_channels (
  user_id          uuid        primary key references auth.users(id) on delete cascade,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists journey_user_channels_recent_idx
  on public.journey_user_channels (last_message_at desc nulls last);


-- ============================================================
-- SECTION 2 — Unified messages table
-- ============================================================

create table if not exists public.journey_messages (
  id                       uuid        primary key default gen_random_uuid(),
  -- Surface (XOR enforced below)
  scheduled_item_id        uuid        references public.journey_scheduled_items(id) on delete cascade,
  channel_user_id          uuid        references public.journey_user_channels(user_id) on delete cascade,
  -- Author. Nullable ONLY for legacy back-filled expert replies that
  -- predate clinician_id capture (migration 049 added that column;
  -- earlier clinician_reply_text rows have no recorded author). For
  -- every new insert from server actions, author_user_id MUST be set
  -- — enforced by the partial CHECK below.
  author_user_id           uuid        references auth.users(id) on delete set null,
  author_kind              text        not null,
  -- Content
  body                     text        not null
                                       check (length(trim(body)) > 0
                                              and length(body) <= 4000),
  reactions                jsonb       not null default '{}'::jsonb,
  is_private               boolean     not null default false,
  -- Optional links back into the legacy tables — only set on rows
  -- created via the dual-write path. Stable so we can reconcile if
  -- the clinician dashboard ever updates a legacy row out-of-band.
  legacy_response_id       uuid        references public.journey_item_responses(id) on delete set null,
  legacy_user_message_id   uuid        references public.journey_user_messages(id) on delete set null,
  created_at               timestamptz not null default now(),
  edited_at                timestamptz
);

alter table public.journey_messages
  drop constraint if exists journey_messages_surface_xor;
alter table public.journey_messages
  add constraint journey_messages_surface_xor
  check ((scheduled_item_id is not null) <> (channel_user_id is not null));

alter table public.journey_messages
  drop constraint if exists journey_messages_author_kind_check;
alter table public.journey_messages
  add constraint journey_messages_author_kind_check
  check (author_kind in ('user', 'expert'));

-- Author may only be NULL on legacy back-filled rows (i.e. pre-migration-049
-- expert replies). New inserts from server actions always carry an author.
alter table public.journey_messages
  drop constraint if exists journey_messages_author_required_check;
alter table public.journey_messages
  add constraint journey_messages_author_required_check
  check (
    author_user_id is not null
    or legacy_response_id is not null
    or legacy_user_message_id is not null
  );

create index if not exists journey_messages_item_idx
  on public.journey_messages (scheduled_item_id, created_at)
  where scheduled_item_id is not null;

create index if not exists journey_messages_channel_idx
  on public.journey_messages (channel_user_id, created_at)
  where channel_user_id is not null;

create index if not exists journey_messages_author_idx
  on public.journey_messages (author_user_id, created_at desc);

-- One mirror message per (legacy row, author_kind) — for legacy
-- responses we may have BOTH a user mirror (from response_text) and
-- an expert mirror (from clinician_reply_text). Splitting the index
-- by author_kind keeps both back-fills idempotent: re-running
-- doesn't create duplicates of either.
create unique index if not exists journey_messages_legacy_response_user_uq
  on public.journey_messages (legacy_response_id)
  where legacy_response_id is not null and author_kind = 'user';

create unique index if not exists journey_messages_legacy_response_expert_uq
  on public.journey_messages (legacy_response_id)
  where legacy_response_id is not null and author_kind = 'expert';

create unique index if not exists journey_messages_legacy_user_message_uq
  on public.journey_messages (legacy_user_message_id)
  where legacy_user_message_id is not null and author_kind = 'user';

-- updated_at trigger reuse
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'journey_user_channels_set_updated_at') then
    create trigger journey_user_channels_set_updated_at
      before update on public.journey_user_channels
      for each row execute function public.tg_set_updated_at();
  end if;
end $$;


-- ============================================================
-- SECTION 3 — Notification log
-- A minimal append-only log of "something happened that should
-- ping someone". Slice 10 builds the proper in-app inbox + email
-- delivery; this table just preserves the events so the inbox can
-- read history. The application-layer helper writes one row per
-- notification.
-- ============================================================

create table if not exists public.journey_notifications (
  id              uuid        primary key default gen_random_uuid(),
  recipient_kind  text        not null,
  -- When recipient_kind = 'user', recipient_user_id is the target.
  -- When recipient_kind = 'expert_pool', recipient_user_id is NULL
  -- (the email helper fans out to a configured pool address).
  recipient_user_id uuid      references auth.users(id) on delete cascade,
  kind            text        not null,
  payload         jsonb       not null default '{}'::jsonb,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.journey_notifications
  drop constraint if exists journey_notifications_recipient_kind_check;
alter table public.journey_notifications
  add constraint journey_notifications_recipient_kind_check
  check (recipient_kind in ('user', 'expert_pool'));

alter table public.journey_notifications
  drop constraint if exists journey_notifications_kind_check;
alter table public.journey_notifications
  add constraint journey_notifications_kind_check
  check (kind in (
    'item_message_user_posted',     -- user posted in a per-item thread
    'item_message_expert_replied',  -- expert replied in a per-item thread
    'channel_message_user_posted',  -- user posted in their general channel
    'channel_message_expert_replied' -- expert replied in a general channel
  ));

-- Recipient-scoped recent lookup
create index if not exists journey_notifications_recipient_recent_idx
  on public.journey_notifications (recipient_user_id, created_at desc)
  where recipient_user_id is not null;

create index if not exists journey_notifications_pool_recent_idx
  on public.journey_notifications (created_at desc)
  where recipient_kind = 'expert_pool';

create index if not exists journey_notifications_unread_idx
  on public.journey_notifications (recipient_user_id, created_at desc)
  where read_at is null and recipient_user_id is not null;


-- ============================================================
-- SECTION 4 — RLS
-- Same pattern as 035: SELECT-only policies; writes flow through
-- the service-role admin client in server actions.
-- ============================================================

alter table public.journey_user_channels enable row level security;
alter table public.journey_messages       enable row level security;
alter table public.journey_notifications  enable row level security;

-- Channels — a user reads their own row; experts/admins read all.
drop policy if exists journey_user_channels_read on public.journey_user_channels;
create policy journey_user_channels_read on public.journey_user_channels
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_expert()
  );

-- Messages — visibility splits by surface:
--   * channel rows: only the channel owner + experts/admins (general
--     channel is solo per Itzik #7).
--   * per-item rows: owner-scope (same path as journey_item_responses
--     in migration 035 §9); private rows are author-only or expert/admin.
drop policy if exists journey_messages_read on public.journey_messages;
create policy journey_messages_read on public.journey_messages
  for select using (
    -- Author always sees own
    author_user_id = auth.uid()
    or public.is_admin()
    or public.is_expert()
    -- General channel: only the channel owner
    or (channel_user_id is not null and channel_user_id = auth.uid())
    -- Per-item: visible to anyone who can see the underlying scheduled
    -- item, EXCEPT private rows which are author-only (covered above).
    or (
      scheduled_item_id is not null
      and is_private = false
      and exists (
        select 1
        from public.journey_scheduled_items s
        join public.journey_assignments a on a.id = s.assignment_id
        where s.id = scheduled_item_id
          and (
            a.user_id = auth.uid()
            or a.couple_id in (
              select couple_id from public.couple_members where user_id = auth.uid()
            )
          )
      )
    )
  );

-- Notifications — recipient-only reads, plus admin/expert visibility.
drop policy if exists journey_notifications_read on public.journey_notifications;
create policy journey_notifications_read on public.journey_notifications
  for select using (
    (recipient_user_id is not null and recipient_user_id = auth.uid())
    or public.is_admin()
    or public.is_expert()
  );


-- ============================================================
-- SECTION 5 — BACK-FILL
-- Idempotent via the partial unique indexes on legacy_*_id. Re-runs
-- skip rows that already have a journey_messages mirror.
-- ============================================================

-- 5a. Back-fill journey_item_responses → journey_messages (user side).
insert into public.journey_messages (
  scheduled_item_id, channel_user_id,
  author_user_id, author_kind,
  body, is_private, legacy_response_id, created_at
)
select
  r.scheduled_item_id, null,
  r.user_id, 'user',
  r.response_text, coalesce(r.is_private, false), r.id, r.created_at
from public.journey_item_responses r
left join public.journey_messages m
  on m.legacy_response_id = r.id and m.author_kind = 'user'
where m.id is null;

-- 5b. Back-fill clinician_reply_text rows as paired expert messages.
-- One expert message per legacy response that has a reply (the
-- legacy schema only allows one reply per response; new model
-- supports many — future expert messages on the same item just go
-- direct to journey_messages).
-- author_user_id is left NULL when the legacy clinician_id is missing
-- (rows that pre-date migration 049 didn't capture it). The
-- author_required_check above permits NULL on legacy back-filled rows.
insert into public.journey_messages (
  scheduled_item_id, channel_user_id,
  author_user_id, author_kind,
  body, is_private, legacy_response_id, created_at
)
select
  r.scheduled_item_id, null,
  r.clinician_id, 'expert',
  r.clinician_reply_text, false, r.id,
  coalesce(r.clinician_replied_at, r.created_at)
from public.journey_item_responses r
left join public.journey_messages m
  on m.legacy_response_id = r.id and m.author_kind = 'expert'
where r.clinician_reply_text is not null
  and length(trim(r.clinician_reply_text)) > 0
  and m.id is null;

-- 5c. Back-fill journey_user_messages → journey_user_channels rows.
-- One channel per distinct user with at least one message.
insert into public.journey_user_channels (user_id, last_message_at)
select um.user_id, max(um.created_at)
from public.journey_user_messages um
left join public.journey_user_channels c on c.user_id = um.user_id
where c.user_id is null
group by um.user_id
on conflict (user_id) do nothing;

-- 5d. Back-fill journey_user_messages → journey_messages (user side).
-- The general channel's general expert reply column doesn't exist on
-- the legacy table (it was fire-and-forget per migration 051 header);
-- there's no expert side to back-fill.
insert into public.journey_messages (
  scheduled_item_id, channel_user_id,
  author_user_id, author_kind,
  body, is_private, legacy_user_message_id, created_at
)
select
  null, um.user_id,
  um.user_id, 'user',
  um.message_text, true, um.id, um.created_at
from public.journey_user_messages um
left join public.journey_messages m
  on m.legacy_user_message_id = um.id and m.author_kind = 'user'
where m.id is null;


-- ============================================================
-- SECTION 6 — Invariant maintenance: keep journey_user_channels
-- last_message_at fresh on every new journey_messages insert.
-- ============================================================

create or replace function public.tg_journey_messages_touch_channel()
returns trigger
language plpgsql
as $$
begin
  if new.channel_user_id is not null then
    insert into public.journey_user_channels (user_id, last_message_at)
    values (new.channel_user_id, new.created_at)
    on conflict (user_id) do update
      set last_message_at = greatest(
        public.journey_user_channels.last_message_at,
        excluded.last_message_at
      );
  end if;
  return new;
end;
$$;

drop trigger if exists journey_messages_touch_channel on public.journey_messages;
create trigger journey_messages_touch_channel
  after insert on public.journey_messages
  for each row execute function public.tg_journey_messages_touch_channel();


comment on table public.journey_user_channels is
  'One row per user holding general-expert-channel metadata. Lazily created on first message.';
comment on table public.journey_messages is
  'Unified threaded messages for both per-item threads (scheduled_item_id) and the general expert channel (channel_user_id). Slice 6.';
comment on column public.journey_messages.legacy_response_id is
  'Back-link to journey_item_responses for slice 6 dual-write reconciliation. Drops in a future slice when the clinician inbox migrates.';
comment on column public.journey_messages.reactions is
  'Per-emoji array of user ids: { ":heart:": ["uid-1","uid-2"], ":thumbsup:": [...] }. Server action toggleReaction adds/removes the current user.';
comment on table public.journey_notifications is
  'Append-only notification log. Slice 10 builds the proper in-app inbox UI; for now this preserves the events so they can be replayed.';

commit;

select pg_notify('pgrst', 'reload schema');
