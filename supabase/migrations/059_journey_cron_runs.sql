-- ============================================================
-- 059_journey_cron_runs.sql
-- Slice 9 - observability log for the v3 cron family.
--
-- Each cron writes one row on completion (success OR failure). The
-- /dashboard/journey/health page reads recent rows to render the
-- status table; the staleness check (last run > 1.5× expected
-- interval) flags drift without us hard-coding a heartbeat schedule.
--
-- Append-only; no updates after insert. The application layer never
-- reads beyond the last 30 days, so a periodic prune (manual for now)
-- keeps the table small.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.journey_cron_runs (
  id              uuid        primary key default gen_random_uuid(),
  job_name        text        not null,
  started_at      timestamptz not null,
  finished_at     timestamptz not null default now(),
  ok              boolean     not null,
  rows_processed  int         not null default 0,
  error_text      text,
  payload         jsonb       not null default '{}'::jsonb
);

alter table public.journey_cron_runs
  drop constraint if exists journey_cron_runs_job_name_check;
alter table public.journey_cron_runs
  add constraint journey_cron_runs_job_name_check
  check (job_name in (
    'cadence_advance',
    'notify_unlocks',
    'grace_watcher',
    'scores_recompute'
  ));

-- Recent-runs scan + per-job last_run lookup.
create index if not exists journey_cron_runs_job_recent_idx
  on public.journey_cron_runs (job_name, finished_at desc);

create index if not exists journey_cron_runs_failures_idx
  on public.journey_cron_runs (job_name, finished_at desc)
  where ok = false;

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.journey_cron_runs enable row level security;

-- Service-role writes (every cron uses the admin client). Admins read
-- via the dashboard health page; non-admins never see this table.
drop policy if exists journey_cron_runs_read on public.journey_cron_runs;
create policy journey_cron_runs_read on public.journey_cron_runs
  for select using (public.is_admin());

comment on table public.journey_cron_runs is
  'Observability log for v3 cron jobs. One row per run, append-only. /dashboard/journey/health reads recent rows.';
comment on column public.journey_cron_runs.payload is
  'Per-job extra detail (e.g. {scanned, delivered, skipped, errors[]}). Schema is loose by design.';

commit;

select pg_notify('pgrst', 'reload schema');
