-- 192 — Five-track cycle model (docs/journey-five-track-model-spec.md).
--
-- Replaces "one item per week, one category" with "five items open at once, one
-- per category, ordered by the user's assessment ranking". A new cycle opens
-- when all five are marked done OR one month after the current cycle opened,
-- whichever comes first.
--
-- What this migration does NOT do: it does not touch journey_scheduled_items,
-- journey_assignments or the weekly cadence engine. Those keep running (§9.3 —
-- the expert stays weekly), and the cutover happens in code, not here.
--
-- Reuse, deliberately: journey_user_delivered_items stays the single global
-- "this user has already consumed this item" ledger. Its PK (user_id, item_id)
-- already doubles as the anti-repeat lock, so cycles record WHICH items opened
-- and delivered_items records THAT they opened. No second source of truth.

begin;

-- ── §2א(א): a paying customer never sits with no content ────────────────────
-- Priorities used to be written only when the assessment finished, and the
-- cadence engine rejects anyone without a row — which is why both paying
-- journey subscribers received zero items since purchase. Purchase alone must
-- now be enough, with a default order the user is invited to refine.
-- ('default' was a deliberate removal on 2026-05-24; spec §2א reverses it.)
alter table public.journey_user_priorities
  drop constraint if exists journey_user_priorities_source_check;

alter table public.journey_user_priorities
  add constraint journey_user_priorities_source_check
  check (source = any (array['assessment', 'user_edit', 'admin_override', 'default']));

-- ── Alerting on the failure that already happened ───────────────────────────
-- Both paying subscribers sat with zero content for weeks and nothing noticed.
-- /api/journey/content-health raises this kind; the CHECK has to allow it.
alter table public.journey_notifications
  drop constraint if exists journey_notifications_kind_check;

alter table public.journey_notifications
  add constraint journey_notifications_kind_check
  check (kind = any (array[
    'item_message_user_posted', 'item_message_expert_replied',
    'channel_message_user_posted', 'channel_message_expert_replied',
    'item_unlocked', 'expert_push_landed',
    'subscription_grace_started', 'subscription_blocked',
    'reminder_inactivity', 'reminder_unfollowed_reply',
    'cron_failure', 'stuck_users_digest',
    'trial_ending_soon', 'trial_first_charge_failed',
    'subscriber_without_content'
  ]));

-- ── Cycles ──────────────────────────────────────────────────────────────────
create table if not exists public.journey_cycles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  cycle_number          integer not null check (cycle_number >= 1),

  opened_at             timestamptz not null default now(),
  -- opened_at + 1 month. The cycle also ends early when all items are done.
  planned_next_open_at  timestamptz not null,
  closed_at             timestamptz,
  close_reason          text check (close_reason in ('all_completed', 'month_elapsed', 'manual')),

  -- The category order FROZEN at open time (§6): a later re-assessment must not
  -- reshuffle a cycle the user is already looking at. Array of
  -- journey_categories.id, most-important first.
  ranking_snapshot      uuid[] not null,
  -- Where that ranking came from, for support and for measuring how many users
  -- start on the default order.
  ranking_source        text not null default 'assessment'
                          check (ranking_source in ('assessment', 'user_edit', 'admin_override', 'default')),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint journey_cycles_user_number_uniq unique (user_id, cycle_number)
);

comment on table public.journey_cycles is
  'One row per user per cycle of five items. See docs/journey-five-track-model-spec.md.';
comment on column public.journey_cycles.ranking_snapshot is
  'Category order frozen at open time so a re-assessment never reorders a live cycle.';

-- A user has at most ONE open cycle at a time. Partial unique index rather than
-- a constraint so closed cycles are unrestricted.
create unique index if not exists journey_cycles_one_open_per_user
  on public.journey_cycles (user_id)
  where closed_at is null;

create index if not exists journey_cycles_due_idx
  on public.journey_cycles (planned_next_open_at)
  where closed_at is null;

-- ── Items opened inside a cycle ─────────────────────────────────────────────
create table if not exists public.journey_cycle_items (
  id            uuid primary key default gen_random_uuid(),
  cycle_id      uuid not null references public.journey_cycles(id) on delete cascade,
  item_id       uuid not null references public.journey_items(id) on delete restrict,
  category_id   uuid not null references public.journey_categories(id) on delete restrict,

  -- 1..5, position in the ranked display order (1 = weakest area first).
  rank_position smallint not null check (rank_position between 1 and 5),

  -- §2א(ב) flexible fill: normally one item per category, but when a category
  -- is empty the slot is filled from the next category in the ranking that
  -- still has content. TRUE marks such a substitute so the admin can see why a
  -- cycle is not one-per-category, and so "family is starving" is measurable.
  is_substitute boolean not null default false,
  -- The category this slot was MEANT to serve, when is_substitute is true.
  intended_category_id uuid references public.journey_categories(id) on delete set null,

  -- §9.1: one partner marking it is enough; completed_by records who.
  completed_at  timestamptz,
  completed_by  uuid references auth.users(id) on delete set null,

  created_at    timestamptz not null default now(),

  -- One slot per rank position, and an item never opens twice in one cycle.
  constraint journey_cycle_items_rank_uniq unique (cycle_id, rank_position),
  constraint journey_cycle_items_item_uniq unique (cycle_id, item_id),
  -- completed_by is meaningless without completed_at and vice versa.
  constraint journey_cycle_items_completion_pair
    check ((completed_at is null) = (completed_by is null)),
  -- A substitute must say which category it stood in for.
  constraint journey_cycle_items_substitute_intent
    check (not is_substitute or intended_category_id is not null)
);

comment on column public.journey_cycle_items.is_substitute is
  'TRUE when the intended category had no unseen content and the slot was filled from the next ranked category (spec §2א(ב)).';

create index if not exists journey_cycle_items_cycle_idx
  on public.journey_cycle_items (cycle_id, rank_position);

create index if not exists journey_cycle_items_open_idx
  on public.journey_cycle_items (cycle_id)
  where completed_at is null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Service-role only, matching journey_scheduled_items / delivered_items: every
-- read and write goes through the admin client, and the user-facing pages
-- already load their journey data server-side.
alter table public.journey_cycles enable row level security;
alter table public.journey_cycle_items enable row level security;

commit;
