-- ============================================================
-- 054_journey_subtopics_and_cohorts.sql
-- Slice 1 of the v3 per-partner content delivery system.
--
-- This migration introduces three new things on top of the v2
-- programs/categories/items model from migration 035:
--
--   1. journey_subtopics - a tier between category and item, so the
--      hierarchy becomes Category -> Subtopic -> Item. Items may also
--      hang directly off a category (subtopic_id NULL).
--   2. journey_items extensions - content_type, est_minutes, tags,
--      prereq_item_ids; plus the new subtopic_id FK. The cadence
--      engine (slice 3) reads tags to find 'discovery' items for the
--      random pool. content_type/est_minutes are admin-facing metadata.
--   3. journey_groups + members + bound subtopics - cohort
--      infrastructure for slice 7 (group-bound subtopics, replace vs
--      interleave with the personalized queue). Tables exist now so
--      slice 7 only adds engine awareness, not schema churn.
--
-- Mutations route through the admin (service-role) client per the
-- project's @supabase/ssr pattern. RLS is SELECT-only here; writes
-- happen via supabase-admin in admin server actions.
--
-- Cross-references:
--   * Migration 035 created journey_categories / journey_items.
--   * Migration 029 created the public.tg_set_updated_at() trigger fn
--     and the couples / couple_members tables we don't reference here.
--   * Migration 001 created public.is_admin().
-- ============================================================

begin;

create extension if not exists pgcrypto;


-- ============================================================
-- SECTION 1 - SUBTOPICS
-- A subtopic groups items within a category. Items can either belong
-- to a subtopic or hang directly off the category (legacy + simple
-- categories where subdivision is overkill). Slug is unique per
-- (category_id, slug) so admins can use natural slugs.
-- ============================================================

create table if not exists public.journey_subtopics (
  id              uuid        primary key default gen_random_uuid(),
  category_id     uuid        not null references public.journey_categories(id) on delete restrict,
  slug            text        not null,
  name_he         text        not null,
  name_en         text,
  description_he  text,
  description_en  text,
  sort_order      int         not null default 0,
  is_active       boolean     not null default true,
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists journey_subtopics_category_slug_key
  on public.journey_subtopics (category_id, slug);

create index if not exists journey_subtopics_category_sort_idx
  on public.journey_subtopics (category_id, sort_order)
  where is_active;


-- ============================================================
-- SECTION 2 - JOURNEY_ITEMS EXTENSIONS
-- The catalog gets a subtopic FK plus four metadata fields the v3
-- engine and admin UI need:
--
--   * subtopic_id          - optional. Items either belong to a subtopic
--                            inside their category, or hang directly off
--                            the category (subtopic_id NULL).
--   * content_type         - admin-facing classifier (article / exercise /
--                            video / prompt / challenge). Doesn't change
--                            engine logic; drives icons + filters in admin.
--   * est_minutes          - rough time-to-complete shown to users.
--   * tags                 - free-form text array; the cadence engine reads
--                            tag = 'discovery' for the random pool.
--   * prereq_item_ids      - items that must be delivered first; cadence
--                            engine respects this when picking the next item.
--
-- Note: the existing items.kind column (added in 050) discriminates
-- content / assessment / reflection. content_type is a SECOND axis -
-- presentational, not behavioural. They're orthogonal.
-- ============================================================

alter table public.journey_items
  add column if not exists subtopic_id     uuid       references public.journey_subtopics(id) on delete set null,
  add column if not exists content_type    text       not null default 'article',
  add column if not exists est_minutes     int,
  add column if not exists tags            text[]     not null default '{}',
  add column if not exists prereq_item_ids uuid[]     not null default '{}';

alter table public.journey_items
  drop constraint if exists journey_items_content_type_check;
alter table public.journey_items
  add constraint journey_items_content_type_check
  check (content_type in ('article','exercise','video','prompt','challenge'));

-- Subtopic must belong to the same category as the item - enforced via
-- a trigger because cross-row CHECK constraints aren't supported.
create or replace function public.tg_journey_items_subtopic_consistency()
returns trigger
language plpgsql
as $$
declare
  v_subtopic_category uuid;
begin
  if new.subtopic_id is null then
    return new;
  end if;
  select category_id into v_subtopic_category
    from public.journey_subtopics
   where id = new.subtopic_id;
  if v_subtopic_category is null then
    raise exception 'journey_items.subtopic_id % does not exist', new.subtopic_id;
  end if;
  if v_subtopic_category <> new.category_id then
    raise exception 'journey_items.subtopic_id % belongs to category %, but item.category_id is %',
      new.subtopic_id, v_subtopic_category, new.category_id;
  end if;
  return new;
end;
$$;

drop trigger if exists journey_items_subtopic_consistency on public.journey_items;
create trigger journey_items_subtopic_consistency
  before insert or update of category_id, subtopic_id on public.journey_items
  for each row
  execute function public.tg_journey_items_subtopic_consistency();

create index if not exists journey_items_subtopic_idx
  on public.journey_items (subtopic_id, sort_order)
  where subtopic_id is not null;

create index if not exists journey_items_tags_gin
  on public.journey_items using gin (tags);

create index if not exists journey_items_prereqs_gin
  on public.journey_items using gin (prereq_item_ids);


-- ============================================================
-- SECTION 3 - GROUPS
-- A group is an admin-curated cohort of users (members) bound to one
-- or more subtopics. Per binding, the group can either REPLACE the
-- personalized queue for that subtopic or INTERLEAVE its items with
-- the personalized picks (mode column on the binding).
--
-- Group cadence overrides (curated_per_week_override etc.) are NULL
-- by default - meaning "use the platform default from journey_settings"
-- (added in migration 055). Non-NULL values shadow the platform setting
-- for members of this group.
--
-- Membership is stored as users only (per Itzik #9). The admin UI
-- expands "add this couple" into two membership rows.
-- ============================================================

create table if not exists public.journey_groups (
  id                            uuid        primary key default gen_random_uuid(),
  slug                          text        not null,
  label_he                      text        not null,
  label_en                      text,
  description_he                text,
  description_en                text,
  curated_per_week_override     int         check (curated_per_week_override is null or curated_per_week_override >= 0),
  random_per_week_override      int         check (random_per_week_override  is null or random_per_week_override  >= 0),
  priority_weights_override     numeric[]   check (priority_weights_override is null or array_length(priority_weights_override, 1) >= 1),
  is_active                     boolean     not null default true,
  created_by                    uuid        references auth.users(id) on delete set null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create unique index if not exists journey_groups_slug_key
  on public.journey_groups (slug);

create index if not exists journey_groups_active_idx
  on public.journey_groups (is_active);

create table if not exists public.journey_group_members (
  group_id   uuid        not null references public.journey_groups(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  added_by   uuid        references auth.users(id) on delete set null,
  added_at   timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists journey_group_members_user_idx
  on public.journey_group_members (user_id);

create table if not exists public.journey_group_subtopics (
  group_id    uuid        not null references public.journey_groups(id) on delete cascade,
  subtopic_id uuid        not null references public.journey_subtopics(id) on delete cascade,
  mode        text        not null,
  sort_weight int         not null default 0,
  created_at  timestamptz not null default now(),
  primary key (group_id, subtopic_id)
);

alter table public.journey_group_subtopics
  drop constraint if exists journey_group_subtopics_mode_check;
alter table public.journey_group_subtopics
  add constraint journey_group_subtopics_mode_check
  check (mode in ('replace','interleave'));


-- ============================================================
-- SECTION 4 - UPDATED_AT TRIGGERS
-- Reuse public.tg_set_updated_at() defined in migration 029.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'journey_subtopics_set_updated_at') then
    create trigger journey_subtopics_set_updated_at
      before update on public.journey_subtopics
      for each row execute function public.tg_set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'journey_groups_set_updated_at') then
    create trigger journey_groups_set_updated_at
      before update on public.journey_groups
      for each row execute function public.tg_set_updated_at();
  end if;
end $$;


-- ============================================================
-- SECTION 5 - ROW LEVEL SECURITY (SELECT only)
-- Same pattern as migration 035: writes via service-role admin client,
-- no INSERT/UPDATE/DELETE policies. SELECT scoped per table.
-- ============================================================

alter table public.journey_subtopics       enable row level security;
alter table public.journey_groups          enable row level security;
alter table public.journey_group_members   enable row level security;
alter table public.journey_group_subtopics enable row level security;

-- Subtopics: readable by anyone signed in if active, plus admins.
drop policy if exists journey_subtopics_read on public.journey_subtopics;
create policy journey_subtopics_read on public.journey_subtopics
  for select using (is_active or public.is_admin());

-- Groups: members see their groups, admins see all.
drop policy if exists journey_groups_read on public.journey_groups;
create policy journey_groups_read on public.journey_groups
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.journey_group_members m
      where m.group_id = journey_groups.id and m.user_id = auth.uid()
    )
  );

-- Group members: a user sees their own membership rows; admin sees all.
drop policy if exists journey_group_members_read on public.journey_group_members;
create policy journey_group_members_read on public.journey_group_members
  for select using (
    user_id = auth.uid() or public.is_admin()
  );

-- Group ↔ subtopic bindings: visible to anyone who can see the group.
drop policy if exists journey_group_subtopics_read on public.journey_group_subtopics;
create policy journey_group_subtopics_read on public.journey_group_subtopics
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.journey_group_members m
      where m.group_id = journey_group_subtopics.group_id and m.user_id = auth.uid()
    )
  );


comment on table public.journey_subtopics is
  'Tier between journey_categories and journey_items in the v3 hierarchy. Items may also hang directly off a category (subtopic_id NULL).';
comment on column public.journey_items.tags is
  'Free-form text tags. Cadence engine reads tag = ''discovery'' for the random/discovery pool.';
comment on column public.journey_items.prereq_item_ids is
  'Items that must be delivered before this one. Cadence engine respects this when picking the next item.';
comment on table public.journey_groups is
  'Admin-curated user cohorts bound to subtopics. Group cadence overrides shadow the platform defaults for members.';
comment on column public.journey_group_subtopics.mode is
  'replace: group items REPLACE the personalized queue picks for this subtopic. interleave: merge with personalized picks.';

commit;

select pg_notify('pgrst', 'reload schema');
