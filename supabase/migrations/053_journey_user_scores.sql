-- ============================================================
-- 053 - journey_user_scores
-- ============================================================
-- Phase 5 - adaptive foundation. Per-user computed scores plus
-- edge-case flags, refreshed by lib/dashboard/user-scoring.ts.
--
-- Design intent (read this before changing the schema):
--   1. The scores are DERIVED data. Truncating the table at any
--      time is safe - running the recompute job rebuilds it from
--      journey_item_responses + journey_scheduled_items + completions.
--   2. Numbers are 0..1 normalised so the recommendations layer
--      doesn't hard-code thresholds against absolute counts that
--      change as content grows.
--   3. `flags` is an open-ended text[] (same pattern as response
--      tags). New flags get added by editing user-scoring.ts and
--      recommendations.ts; no schema change needed.
--   4. RLS is service-role-only WRITE (the recompute job uses
--      service-role). Read is restricted to the user themselves
--      OR experts assigned to the user's couple. We currently
--      surface scores ONLY in the dashboard, but the policy is
--      conservative on purpose so a future client surface can
--      gate against the user's own row without code changes.
--
-- Privacy:
--   The scores themselves are derived stats. They never include raw
--   response text. We do NOT compute or store anything that would
--   constitute a clinical assessment - the scores are operational
--   signals (responsiveness, completion rate) used by the clinician
--   triage UI. The clinician makes the clinical judgements.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.journey_user_scores (
  user_id          uuid        primary key references auth.users(id) on delete cascade,
  couple_id        uuid        references public.couples(id) on delete set null,

  -- Normalised scores in [0..1]. NULL means "not enough data yet".
  engagement_depth   numeric(4,3) check (engagement_depth   between 0 and 1),
  response_velocity  numeric(4,3) check (response_velocity  between 0 and 1),
  conflict_signal    numeric(4,3) check (conflict_signal    between 0 and 1),
  consistency        numeric(4,3) check (consistency        between 0 and 1),

  -- Raw aggregates kept for explainability - the recs layer cites
  -- these in human-readable rationales.
  total_items                integer not null default 0,
  total_completed_items      integer not null default 0,
  total_responses            integer not null default 0,
  total_replies_received     integer not null default 0,
  avg_response_chars         integer not null default 0,
  avg_days_to_respond        numeric(6,2) not null default 0,
  active_days_last_30        integer not null default 0,
  crisis_keyword_count       integer not null default 0,
  concerning_status_count    integer not null default 0,

  -- Edge-case flags. See lib/dashboard/user-scoring.ts for the
  -- (deterministic) rules that produce each. Examples today:
  --   'stuck' / 'disengaging' / 'overreactive' / 'non_responsive' / 'crisis'
  flags          text[]       not null default '{}',

  computed_at    timestamptz  not null default now()
);

create index if not exists journey_user_scores_couple_idx
  on public.journey_user_scores (couple_id);
create index if not exists journey_user_scores_flags_gin
  on public.journey_user_scores using gin (flags);
create index if not exists journey_user_scores_computed_idx
  on public.journey_user_scores (computed_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.journey_user_scores enable row level security;

drop policy if exists "journey_user_scores: service_role full access"
  on public.journey_user_scores;
create policy "journey_user_scores: service_role full access"
  on public.journey_user_scores for all
  to service_role using (true) with check (true);

-- A user may read their OWN scores row (for a future "your engagement"
-- surface inside /my; not used yet but the policy is in place).
drop policy if exists "journey_user_scores: user reads own"
  on public.journey_user_scores;
create policy "journey_user_scores: user reads own"
  on public.journey_user_scores for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.journey_user_scores is
  'Derived per-user adaptive signals computed by lib/dashboard/user-scoring.ts. Recomputed by a scheduled job; safe to truncate.';
comment on column public.journey_user_scores.flags is
  'Open-ended edge-case flags. Source of truth: lib/dashboard/user-scoring.ts.';

commit;

select pg_notify('pgrst', 'reload schema');
