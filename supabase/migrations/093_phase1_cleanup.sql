-- ═════════════════════════════════════════════════════════════════
-- 093_phase1_cleanup.sql
-- ═════════════════════════════════════════════════════════════════
-- Phase 1 of the journey content delivery fix.
--
-- Context (2026-05-24):
--   - auto-assign was creating program-kind assignments that pre-
--     materialized all 275 active items with offset=0 → users saw
--     "everything open" on first login.
--   - Diagnostic run (v6) found 3 real program assignments tied to
--     2 active paying users + 1 completion (real test data) and
--     2 untouched program assignments from expert_couples_seed.sql.
--
-- This migration:
--   A. Pre-flight verification with hard guards.
--   B. Adds default_interval_days (Hybrid interval cadence column,
--      NULL = preserve current day-of-week behavior).
--   C. Surgically deletes program assignments owned by users with an
--      ACTIVE journey subscription — leaves the seed fixture intact
--      (it has its own teardown: DELETE FROM auth.users WHERE email
--      LIKE '%@mioshy.test').
--   D. Resets journey_first_session_completed_at for those users so
--      they re-enter the JourneyFirstSession flow after P1.1 lands.
--   E. Post-flight verification (rolls back on any unexpected state).
--
-- Cascade chain (verified via 035 + 056):
--   journey_assignments
--     → journey_scheduled_items   (ON DELETE CASCADE, 035:230)
--         → journey_item_completions (ON DELETE CASCADE, 035:258)
--         → journey_item_responses   (ON DELETE CASCADE, 035:277)
--         → journey_messages         (ON DELETE CASCADE, 056:81)
--         → journey_user_delivered_items (ON DELETE SET NULL, 055:234)
--         → journey_pending_pushes       (ON DELETE SET NULL, 055:271)
--
-- Idempotent: re-running affects 0 rows.
-- ═════════════════════════════════════════════════════════════════

begin;

-- ───────────────────────────────────────────────────────────────
-- PART A — Pre-flight verification (read-only; aborts on surprise)
-- ───────────────────────────────────────────────────────────────
do $$
declare
  v_target_count          int;
  v_seed_preserved        int;
  v_scheduled_count       int;
  v_completions_count     int;
  v_responses_count       int;
  v_delivered_count       int;
  v_first_session_count   int;
begin
  select count(*) into v_target_count
  from   public.journey_assignments a
  where  a.source_kind = 'program' and a.is_active = true
    and  a.user_id is not null
    and  exists (
      select 1 from public.subscriptions s
      where  s.user_id = a.user_id
        and  s.product = 'journey'
        and  s.status  = 'active'
    );

  select count(*) into v_seed_preserved
  from   public.journey_assignments a
  where  a.source_kind = 'program' and a.is_active = true
    and  (
      a.user_id is null
      or not exists (
        select 1 from public.subscriptions s
        where  s.user_id = a.user_id
          and  s.product = 'journey'
          and  s.status  = 'active'
      )
    );

  select count(*) into v_scheduled_count
  from   public.journey_scheduled_items s
  join   public.journey_assignments a on a.id = s.assignment_id
  where  a.source_kind = 'program' and a.is_active = true
    and  a.user_id is not null
    and  exists (
      select 1 from public.subscriptions sub
      where  sub.user_id = a.user_id
        and  sub.product = 'journey'
        and  sub.status  = 'active'
    );

  select count(*) into v_completions_count
  from   public.journey_item_completions c
  join   public.journey_scheduled_items s on s.id = c.scheduled_item_id
  join   public.journey_assignments a on a.id = s.assignment_id
  where  a.source_kind = 'program' and a.is_active = true
    and  a.user_id is not null
    and  exists (
      select 1 from public.subscriptions sub
      where  sub.user_id = a.user_id
        and  sub.product = 'journey'
        and  sub.status  = 'active'
    );

  select count(*) into v_responses_count
  from   public.journey_item_responses r
  join   public.journey_scheduled_items s on s.id = r.scheduled_item_id
  join   public.journey_assignments a on a.id = s.assignment_id
  where  a.source_kind = 'program' and a.is_active = true
    and  a.user_id is not null
    and  exists (
      select 1 from public.subscriptions sub
      where  sub.user_id = a.user_id
        and  sub.product = 'journey'
        and  sub.status  = 'active'
    );

  select count(*) into v_delivered_count
  from   public.journey_user_delivered_items d
  join   public.journey_scheduled_items s on s.id = d.scheduled_item_id
  join   public.journey_assignments a on a.id = s.assignment_id
  where  a.source_kind = 'program' and a.is_active = true
    and  a.user_id is not null
    and  exists (
      select 1 from public.subscriptions sub
      where  sub.user_id = a.user_id
        and  sub.product = 'journey'
        and  sub.status  = 'active'
    );

  select count(*) into v_first_session_count
  from   public.profiles p
  where  p.journey_first_session_completed_at is not null
    and  exists (
      select 1 from public.subscriptions s
      where  s.user_id = p.id
        and  s.product = 'journey'
        and  s.status  = 'active'
    );

  raise notice '═══ PRE-FLIGHT VERIFICATION (v2 surgical) ═══';
  raise notice '  REAL program assignments to delete:        %', v_target_count;
  raise notice '  SEED program assignments PRESERVED:        %', v_seed_preserved;
  raise notice '  Scheduled_items cascade-deleted:           %', v_scheduled_count;
  raise notice '  Completions cascade-deleted (real test):   %', v_completions_count;
  raise notice '  Responses cascade-deleted:                 %', v_responses_count;
  raise notice '  Delivered_items FK SET NULL (kept):        %', v_delivered_count;
  raise notice '  Profiles first_session to reset:           %', v_first_session_count;
  raise notice '═══════════════════════════════════════════';

  if v_responses_count > 0 then
    raise exception 'ABORT — % responses on TARGET assignments. Manual review.', v_responses_count;
  end if;
  if v_completions_count > 5 then
    raise exception 'ABORT — % completions on TARGET (expected ≤5, real test data only). Manual review.', v_completions_count;
  end if;
  if v_target_count > 5 then
    raise exception 'ABORT — % target assignments (expected ≤3). Manual review.', v_target_count;
  end if;
  if v_first_session_count > 5 then
    raise exception 'ABORT — % first_session resets (expected ≤2). Manual review.', v_first_session_count;
  end if;
end$$;

-- ───────────────────────────────────────────────────────────────
-- PART B — Schema: Hybrid interval cadence column
-- ───────────────────────────────────────────────────────────────
alter table public.journey_settings
  add column if not exists default_interval_days int null
    check (default_interval_days is null
           or default_interval_days between 1 and 30);

comment on column public.journey_settings.default_interval_days is
  'Hybrid interval mode (added by migration 093). '
  'NULL: cadence engine uses default_delivery_days (day-of-week mode, '
  'Monday by default per migration 055). '
  'Set (1..30): engine delivers when MAX(delivered_at) + interval <= now. '
  'Admin opts in via Phase 3 settings UI.';

-- ───────────────────────────────────────────────────────────────
-- PART C — Surgical delete: real-user program assignments only
-- ───────────────────────────────────────────────────────────────
delete from public.journey_assignments
where  id in (
  select a.id
  from   public.journey_assignments a
  where  a.source_kind = 'program' and a.is_active = true
    and  a.user_id is not null
    and  exists (
      select 1 from public.subscriptions s
      where  s.user_id = a.user_id
        and  s.product = 'journey'
        and  s.status  = 'active'
    )
);

-- ───────────────────────────────────────────────────────────────
-- PART D — Reset first_session for the affected paying users
-- ───────────────────────────────────────────────────────────────
update public.profiles p
set    journey_first_session_completed_at = null
where  p.journey_first_session_completed_at is not null
  and  exists (
    select 1
    from   public.subscriptions s
    where  s.user_id = p.id
      and  s.product = 'journey'
      and  s.status  = 'active'
  );

-- ───────────────────────────────────────────────────────────────
-- PART E — Post-flight verification
-- ───────────────────────────────────────────────────────────────
do $$
declare
  v_remaining_target           int;
  v_orphan_scheduled           int;
  v_remaining_first_session    int;
  v_seed_intact                int;
  v_default_interval_exists    int;
begin
  select count(*) into v_remaining_target
  from   public.journey_assignments a
  where  a.source_kind = 'program' and a.is_active = true
    and  a.user_id is not null
    and  exists (
      select 1 from public.subscriptions s
      where  s.user_id = a.user_id and s.product = 'journey' and s.status = 'active'
    );

  select count(*) into v_orphan_scheduled
  from   public.journey_scheduled_items s
  where  not exists (
    select 1 from public.journey_assignments a where a.id = s.assignment_id
  );

  select count(*) into v_remaining_first_session
  from   public.profiles p
  where  p.journey_first_session_completed_at is not null
    and  exists (
      select 1 from public.subscriptions s
      where  s.user_id = p.id and s.product = 'journey' and s.status = 'active'
    );

  select count(*) into v_seed_intact
  from   public.journey_assignments a
  where  a.source_kind = 'program' and a.is_active = true
    and  (
      a.user_id is null
      or not exists (
        select 1 from public.subscriptions s
        where  s.user_id = a.user_id and s.product = 'journey' and s.status = 'active'
      )
    );

  select count(*) into v_default_interval_exists
  from   information_schema.columns
  where  table_schema = 'public'
    and  table_name   = 'journey_settings'
    and  column_name  = 'default_interval_days';

  raise notice '═══ POST-FLIGHT VERIFICATION ═══';
  raise notice '  Remaining target assignments:          % (expected 0)', v_remaining_target;
  raise notice '  Orphan scheduled_items:                % (expected 0)', v_orphan_scheduled;
  raise notice '  Active subs still with first_session:  % (expected 0)', v_remaining_first_session;
  raise notice '  Seed assignments intact:               % (expected unchanged)', v_seed_intact;
  raise notice '  default_interval_days column exists:   % (expected 1)', v_default_interval_exists;
  raise notice '═══════════════════════════════════';

  if v_remaining_target > 0 then
    raise exception 'POST-FLIGHT FAILED — % target assignments still active. Rolling back.', v_remaining_target;
  end if;
  if v_orphan_scheduled > 0 then
    raise exception 'POST-FLIGHT FAILED — % orphan scheduled_items found. Rolling back.', v_orphan_scheduled;
  end if;
  if v_default_interval_exists != 1 then
    raise exception 'POST-FLIGHT FAILED — default_interval_days column not created. Rolling back.';
  end if;
end$$;

commit;

notify pgrst, 'reload schema';
