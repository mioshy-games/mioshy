-- ============================================================
-- 049 — Journey response clinician fields (Phase 2B)
-- ============================================================
-- Purpose: extend public.journey_item_responses so a clinician can
-- triage and reply to user responses without a separate table. The
-- user-facing ResponseBox keeps using the existing columns; this
-- migration only adds nullable fields for the clinician workflow.
--
-- Hard rules:
--   - Backwards compatible: every new column is nullable, no defaults
--     that change existing rows.
--   - No RLS changes here; service-role / admin RLS already permits
--     reading and updating these rows. The user-facing UI never
--     reads `clinician_*` columns.
--   - Phase 2B does NOT yet build the clinician inbox. It only
--     guarantees that when we DO build it (Phase 2C), the schema is
--     ready.
-- ============================================================

alter table public.journey_item_responses
  add column if not exists clinician_status text
    check (clinician_status in ('open', 'resolved', 'concerning')),
  add column if not exists clinician_id uuid
    references auth.users(id) on delete set null,
  add column if not exists clinician_reply_text text,
  add column if not exists clinician_replied_at timestamptz,
  add column if not exists updated_at timestamptz default now();

-- Open-status index — daily clinician inbox query: "what hasn't been
-- triaged yet?". Partial index keeps it small.
create index if not exists journey_item_responses_clinician_open_idx
  on public.journey_item_responses (created_at desc)
  where clinician_status is null or clinician_status = 'open';

-- Generic recency index for the clinician's "all recent" view.
create index if not exists journey_item_responses_recent_idx
  on public.journey_item_responses (created_at desc);

-- Touch updated_at on every UPDATE so the inbox can sort by latest activity.
-- Reuses the project-wide tg_set_updated_at() helper from migration 029.
drop trigger if exists journey_item_responses_set_updated_at on public.journey_item_responses;
create trigger journey_item_responses_set_updated_at
  before update on public.journey_item_responses
  for each row execute procedure public.tg_set_updated_at();
