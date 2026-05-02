-- ============================================================
-- 055_journey_per_partner_cadence.sql
-- Slice 1 of the v3 per-partner content delivery system.
--
-- Adds the infrastructure the cadence engine (slice 3) and per-partner
-- resolver (slice 4) will read against:
--
--   1. journey_settings — singleton row with platform-wide defaults
--      for cadence, random rate, delivery days, priority weights, and
--      auto-skip threshold. Group rows (in 054) and profile rows (in
--      this migration) can override.
--   2. profiles cadence overrides — journey_delivery_days,
--      journey_delivery_local_hour, journey_paused_at. NULL means
--      "use journey_settings default".
--   3. profiles.expert_specialties text[] — empty for now (Itzik #6).
--   4. journey_categories.assessment_priority_key — links a DB category
--      row to one of the five q_priorities keys in journey/questionnaire.json.
--      Replaces lib/journey/priorities.ts as the source of truth.
--   5. Seed of the five priority categories with assessment_priority_key
--      set so the assessment <-> category linkage works end-to-end.
--   6. journey_user_priorities — per-user ranking + weights. Cadence
--      engine reads this; reactive re-prioritization (slice 3) will
--      regenerate the queue plan when this row is updated.
--   7. journey_user_delivered_items — strict dedup table. Every
--      delivery (cadence / expert_push / group / random) inserts here
--      so we never deliver the same item twice to the same user.
--   8. journey_pending_pushes — admin pushes wait here until the
--      recipient's next delivery slot fires (slice 8 wires the engine).
--   9. journey_scheduled_items new columns — seen_at, responded_at,
--      skipped_at, source. Slice 6 (threaded messaging) sets
--      responded_at on first user message; slice 3 sets skipped_at
--      when the engine finds a slot fired with no response.
--
-- All writes route through the admin (service-role) client. RLS is
-- SELECT-only here, mirroring migration 035.
-- ============================================================

begin;

create extension if not exists pgcrypto;


-- ============================================================
-- SECTION 1 - JOURNEY SETTINGS (singleton)
-- One row, id = 1, holds platform-wide defaults. Mirrors the
-- between_us_settings pattern from migration 029.
-- ============================================================

create table if not exists public.journey_settings (
  id                              integer     primary key default 1,

  -- Cadence defaults (Itzik update A: 1/week curated, 0/week random)
  default_curated_per_week        int         not null default 1
                                              check (default_curated_per_week >= 0 and default_curated_per_week <= 14),
  default_random_per_week         int         not null default 0
                                              check (default_random_per_week  >= 0 and default_random_per_week  <= 14),

  -- Default delivery days. Postgres extract(dow) convention: 0=Sun..6=Sat.
  -- Default = Monday only (1).
  default_delivery_days           int[]       not null default array[1],
  default_delivery_local_hour     int         not null default 9
                                              check (default_delivery_local_hour between 0 and 23),

  -- Weighted-interleave defaults across ranking slots #1..#N.
  -- Itzik #5: 50/25/15/7/3 across the 5 priority slots.
  default_priority_weights        numeric[]   not null default array[0.50, 0.25, 0.15, 0.07, 0.03]::numeric[],

  -- Auto-skip threshold per Update B: if the user's next slot fires
  -- and they haven't responded to the previous item within this many
  -- days, the previous item is marked skipped. Default 14 days.
  auto_skip_after_days            int         not null default 14
                                              check (auto_skip_after_days between 1 and 365),

  updated_at                      timestamptz not null default now(),
  updated_by                      uuid        references auth.users(id) on delete set null,

  constraint journey_settings_singleton check (id = 1)
);

-- Validate weight values + count: each weight in [0..1], at least one slot.
-- PostgreSQL forbids subqueries inside CHECK, so we use the array
-- comparison operator `ALL` which is fully expression-only and does
-- the same thing element-wise.
alter table public.journey_settings
  drop constraint if exists journey_settings_weights_shape_check;
alter table public.journey_settings
  add constraint journey_settings_weights_shape_check
  check (
    array_length(default_priority_weights, 1) >= 1
    and 0 <= ALL(default_priority_weights)
    and 1 >= ALL(default_priority_weights)
  );

-- Seed the singleton row.
insert into public.journey_settings (id) values (1)
on conflict (id) do nothing;


-- ============================================================
-- SECTION 2 - PROFILE CADENCE OVERRIDES + EXPERT SPECIALTIES
-- Per-user override columns. NULL means "use journey_settings default".
-- ============================================================

alter table public.profiles
  add column if not exists journey_delivery_days        int[],
  add column if not exists journey_delivery_local_hour  int
    check (journey_delivery_local_hour is null or journey_delivery_local_hour between 0 and 23),
  add column if not exists journey_paused_at            timestamptz,
  add column if not exists expert_specialties           text[]      not null default '{}';


-- ============================================================
-- SECTION 3 - JOURNEY_CATEGORIES priority key + seed
-- The five priority categories from journey/questionnaire.json's
-- q_priorities.categories[] are seeded here with assessment_priority_key
-- matching their slug. The cadence engine and ranking surfaces use
-- this column to resolve a priority key (e.g. "communication") to the
-- DB category row.
--
-- Future categories that aren't part of the ranking leave this column
-- NULL. We enforce uniqueness on non-NULL values so a key like
-- "communication" can only point at one category at a time.
-- ============================================================

alter table public.journey_categories
  add column if not exists assessment_priority_key text;

create unique index if not exists journey_categories_priority_key_uq
  on public.journey_categories (assessment_priority_key)
  where assessment_priority_key is not null;

-- Seed the five priority categories (program_id NULL = standalone).
-- Idempotent: ON CONFLICT (slug) DO UPDATE so re-running keeps labels
-- in sync with this migration. Once admin starts editing labels via
-- the dashboard UI, we'll switch to ON CONFLICT DO NOTHING.
insert into public.journey_categories (
  slug, name_he, name_en, description_he, description_en,
  sort_order, is_active, assessment_priority_key
)
values
  (
    'communication',
    'תקשורת זוגית',
    'Couple Communication',
    'איך אנחנו מדברים, מקשיבים ופותרים אי-הסכמות',
    'How we talk, listen, and resolve disagreements',
    1, true, 'communication'
  ),
  (
    'intimacy',
    'מיניות ואינטימיות',
    'Sexuality & Intimacy',
    'החיים המיניים, המגע, הקרבה הפיזית והרצון',
    'Sex life, touch, physical closeness, desire',
    2, true, 'intimacy'
  ),
  (
    'emotional_connection',
    'אהבה וחיבור רגשי',
    'Love & Emotional Connection',
    'תחושת קרבה, ביטויי אהבה, פתיחות רגשית',
    'Closeness, expressions of love, emotional openness',
    3, true, 'emotional_connection'
  ),
  (
    'friendship',
    'חברות ושותפות יומיומית',
    'Friendship & Daily Partnership',
    'כיף, חוויות משותפות, שגרה והתנהלות יומיומית',
    'Fun, shared experiences, daily routine',
    4, true, 'friendship'
  ),
  (
    'family',
    'משפחה, הורות ולחצים חיצוניים',
    'Family, Parenting & External Pressures',
    'ילדים, משפחות מוצא, עבודה, כסף ולחצים מבחוץ',
    'Kids, in-laws, work, money, outside pressures',
    5, true, 'family'
  )
on conflict (slug) where program_id is null do update set
  name_he                  = excluded.name_he,
  name_en                  = excluded.name_en,
  description_he           = excluded.description_he,
  description_en           = excluded.description_en,
  sort_order               = excluded.sort_order,
  assessment_priority_key  = excluded.assessment_priority_key,
  is_active                = true;


-- ============================================================
-- SECTION 4 - PER-USER PRIORITY RANKING
-- Stores each user's ordered category preference plus the weight
-- vector used by the cadence engine. The engine reads this row when
-- generating the next slot; reactive re-prioritization (slice 3)
-- regenerates the queue plan on UPDATE.
--
-- ranking[]: ordered category UUIDs (length = number of priority cats).
-- weights[]: same length as ranking; sum should be ~1 but isn't enforced
--            so admin can experiment with non-normalized weights.
-- ============================================================

create table if not exists public.journey_user_priorities (
  user_id     uuid        primary key references auth.users(id) on delete cascade,
  ranking     uuid[]      not null,
  weights     numeric[]   not null,
  source      text        not null default 'assessment',
  updated_at  timestamptz not null default now()
);

alter table public.journey_user_priorities
  drop constraint if exists journey_user_priorities_source_check;
alter table public.journey_user_priorities
  add constraint journey_user_priorities_source_check
  check (source in ('assessment','user_edit','admin_override'));

alter table public.journey_user_priorities
  drop constraint if exists journey_user_priorities_lengths_match;
alter table public.journey_user_priorities
  add constraint journey_user_priorities_lengths_match
  check (array_length(ranking, 1) = array_length(weights, 1));


-- ============================================================
-- SECTION 5 - DELIVERY DEDUP TABLE
-- Strict invariant: an item is delivered to a given user at most once
-- across ALL sources (cadence, expert push, group, random). Cadence
-- engine inserts here in the same transaction as journey_scheduled_items.
-- ============================================================

create table if not exists public.journey_user_delivered_items (
  user_id            uuid        not null references auth.users(id) on delete cascade,
  item_id            uuid        not null references public.journey_items(id) on delete cascade,
  scheduled_item_id  uuid        references public.journey_scheduled_items(id) on delete set null,
  source             text        not null,
  delivered_at       timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.journey_user_delivered_items
  drop constraint if exists journey_user_delivered_items_source_check;
alter table public.journey_user_delivered_items
  add constraint journey_user_delivered_items_source_check
  check (source in ('cadence','expert_push','group','random','admin_manual'));

create index if not exists journey_user_delivered_items_user_time_idx
  on public.journey_user_delivered_items (user_id, delivered_at desc);

create index if not exists journey_user_delivered_items_item_idx
  on public.journey_user_delivered_items (item_id);


-- ============================================================
-- SECTION 6 - PENDING EXPERT PUSHES
-- Admin pushes land here and wait for the recipient's next delivery
-- slot. Per Itzik #8: a push to a couple writes TWO rows (one per
-- partner). Cadence engine drains pending rows in created_at order
-- on each slot fire and stamps consumed_at + scheduled_item_id when
-- it materializes them.
-- ============================================================

create table if not exists public.journey_pending_pushes (
  id                  uuid        primary key default gen_random_uuid(),
  recipient_user_id   uuid        not null references auth.users(id) on delete cascade,
  item_id             uuid        not null references public.journey_items(id) on delete cascade,
  pushed_by           uuid        not null references auth.users(id) on delete restrict,
  reason_note         text,
  group_id            uuid        references public.journey_groups(id) on delete set null,
  created_at          timestamptz not null default now(),
  consumed_at         timestamptz,
  scheduled_item_id   uuid        references public.journey_scheduled_items(id) on delete set null
);

create index if not exists journey_pending_pushes_recipient_pending_idx
  on public.journey_pending_pushes (recipient_user_id, created_at)
  where consumed_at is null;

create index if not exists journey_pending_pushes_item_idx
  on public.journey_pending_pushes (item_id);


-- ============================================================
-- SECTION 7 - SCHEDULED_ITEMS ENGAGEMENT COLUMNS
-- Adds the granular state Update B needs: seen_at (first open),
-- responded_at (first user message in the per-item thread - set by
-- the threaded messaging layer in slice 6), skipped_at (cadence
-- engine sets when the user's next slot fires past auto_skip_after_days
-- without a response), source (origin of the schedule).
-- ============================================================

alter table public.journey_scheduled_items
  add column if not exists seen_at        timestamptz,
  add column if not exists responded_at   timestamptz,
  add column if not exists skipped_at     timestamptz,
  add column if not exists source         text not null default 'cadence';

alter table public.journey_scheduled_items
  drop constraint if exists journey_scheduled_items_source_check;
alter table public.journey_scheduled_items
  add constraint journey_scheduled_items_source_check
  check (source in ('cadence','expert_push','group','random','admin_manual','program','category','item'));

create index if not exists journey_scheduled_items_skipped_idx
  on public.journey_scheduled_items (skipped_at)
  where skipped_at is not null;

create index if not exists journey_scheduled_items_no_response_idx
  on public.journey_scheduled_items (assignment_id, unlock_at)
  where responded_at is null and skipped_at is null;


-- ============================================================
-- SECTION 8 - UPDATED_AT TRIGGERS
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'journey_settings_set_updated_at') then
    create trigger journey_settings_set_updated_at
      before update on public.journey_settings
      for each row execute function public.tg_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'journey_user_priorities_set_updated_at') then
    create trigger journey_user_priorities_set_updated_at
      before update on public.journey_user_priorities
      for each row execute function public.tg_set_updated_at();
  end if;
end $$;


-- ============================================================
-- SECTION 9 - ROW LEVEL SECURITY (SELECT only)
-- ============================================================

alter table public.journey_settings              enable row level security;
alter table public.journey_user_priorities       enable row level security;
alter table public.journey_user_delivered_items  enable row level security;
alter table public.journey_pending_pushes        enable row level security;

-- Settings: readable by any signed-in user (clients render personalized
-- defaults). Admin reads via service-role.
drop policy if exists journey_settings_read on public.journey_settings;
create policy journey_settings_read on public.journey_settings
  for select to authenticated using (true);

-- User priorities: a user reads their own row; admin reads all.
drop policy if exists journey_user_priorities_read on public.journey_user_priorities;
create policy journey_user_priorities_read on public.journey_user_priorities
  for select using (user_id = auth.uid() or public.is_admin());

-- Delivered items: a user reads their own; admin reads all.
drop policy if exists journey_user_delivered_items_read on public.journey_user_delivered_items;
create policy journey_user_delivered_items_read on public.journey_user_delivered_items
  for select using (user_id = auth.uid() or public.is_admin());

-- Pending pushes: a user reads pushes targeted at them; admin reads all.
-- (Users won't surface this in UI, but the policy is conservative.)
drop policy if exists journey_pending_pushes_read on public.journey_pending_pushes;
create policy journey_pending_pushes_read on public.journey_pending_pushes
  for select using (recipient_user_id = auth.uid() or public.is_admin());


comment on table public.journey_settings is
  'Singleton (id=1) holding platform-wide defaults for cadence, random rate, delivery days, priority weights, and auto-skip threshold.';
comment on column public.journey_categories.assessment_priority_key is
  'Stable English slug linking a category to one of the five q_priorities keys in journey/questionnaire.json. Replaces lib/journey/priorities.ts PRIORITY_KEYS as the source of truth.';
comment on column public.journey_scheduled_items.source is
  'Why this item was scheduled: cadence (engine pick), expert_push, group, random, admin_manual, or legacy program/category/item materialization.';
comment on column public.journey_scheduled_items.responded_at is
  'First user message timestamp in the per-item thread (Update B: completion = >=1 response). Slice 6 wires this on insert.';

commit;

select pg_notify('pgrst', 'reload schema');
