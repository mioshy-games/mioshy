-- ============================================================
-- 058_cadence_assignment_kind.sql
-- Slice 3 of the v3 per-partner content delivery system.
--
-- The cadence engine (lib/journey-content/cadence-engine.ts) needs a
-- per-user "container" assignment to attach its scheduled_items rows
-- to (journey_scheduled_items.assignment_id is NOT NULL by design).
-- Rather than coining a new table, we reuse journey_assignments with
-- a new source_kind value:
--
--   * source_kind = 'cadence'
--   * source_id   = the user's own auth.users.id (a stable sentinel
--                   that satisfies the existing NOT NULL constraint
--                   without coupling cadence to any catalog row)
--   * user_id     = the same auth.users.id (couple_id NULL — cadence
--                   is per-partner from day one, even if the user is
--                   in a couple; the per-partner resolver in slice 4
--                   makes that visible on /my/journey)
--   * anchor_date = assessment completion timestamp
--   * origin      = 'trigger' / origin_ref = 'assessment_complete:<userId>'
--
-- This migration extends the source_kind CHECK and adds a partial
-- unique index so a user can have at most one ACTIVE cadence
-- assignment at a time (idempotency: the trigger and the cron both
-- look it up via this constraint).
-- ============================================================

begin;

alter table public.journey_assignments
  drop constraint if exists journey_assignments_source_kind_check;
alter table public.journey_assignments
  add constraint journey_assignments_source_kind_check
  check (source_kind in ('program','category','item','cadence'));

-- One active cadence assignment per user. The lookup query in
-- cadence-engine.ts hits this index on every materialize.
create unique index if not exists journey_assignments_cadence_user_uq
  on public.journey_assignments (user_id)
  where source_kind = 'cadence' and is_active = true and user_id is not null;

-- Useful for the cron: scan eligible cadence assignments cheaply.
create index if not exists journey_assignments_cadence_active_idx
  on public.journey_assignments (created_at)
  where source_kind = 'cadence' and is_active = true;

comment on constraint journey_assignments_source_kind_check on public.journey_assignments is
  'program | category | item (legacy v2) or cadence (v3 per-user engine container)';

commit;

select pg_notify('pgrst', 'reload schema');
