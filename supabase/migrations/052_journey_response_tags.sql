-- ============================================================
-- 052 - journey_item_responses.tags + journey_user_messages.tags
-- ============================================================
-- Phase 4. Adds a `tags text[]` column to both response surfaces.
-- The tags are computed deterministically on insert/update by the
-- application code (lib/dashboard/auto-tag.ts) - no LLM yet, just
-- heuristics over text length, keywords, and structured-answer
-- shape.
--
-- Why a column and not a join table:
--   - We will surface the tags in the clinician inbox alongside
--     each response. Inline arrays are fine for a small set
--     (<10 tags per response is the realistic bound).
--   - GIN index lets us filter "where 'short' = ANY(tags)" cheaply
--     for the CRM "stuck/urgent/new" tabs.
--
-- Tag taxonomy (initial):
--   short          - fewer than 25 characters
--   long           - more than 600 characters
--   no_text        - submitted with empty text (structured-only)
--   contains_url   - text contains http(s) URL
--   crisis_keyword - text matches one of a small banned-words list
--                    (the clinician should triage these promptly).
--                    NOTE: this is NOT a clinical triage replacement.
--                    It's a soft prompt for the clinician.
--   q_assessment   - submitted with structured_answer (kind='assessment')
--   private        - was marked private at submission time
--
-- More tags will be added by editing auto-tag.ts; the column is
-- open-ended. RLS and existing policies are unchanged - tags are
-- treated as part of the response row.
-- ============================================================

begin;

alter table public.journey_item_responses
  add column if not exists tags text[] not null default '{}';

create index if not exists journey_item_responses_tags_gin
  on public.journey_item_responses using gin (tags);

alter table public.journey_user_messages
  add column if not exists tags text[] not null default '{}';

create index if not exists journey_user_messages_tags_gin
  on public.journey_user_messages using gin (tags);

comment on column public.journey_item_responses.tags is
  'Deterministic auto-tags computed by the app at write-time. See lib/dashboard/auto-tag.ts.';
comment on column public.journey_user_messages.tags is
  'Deterministic auto-tags computed by the app at write-time. See lib/dashboard/auto-tag.ts.';

commit;

select pg_notify('pgrst', 'reload schema');
