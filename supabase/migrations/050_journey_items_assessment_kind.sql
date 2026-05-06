-- ============================================================
-- 050 - journey_items: support multiple assessments alongside content
-- ============================================================
-- Purpose:
--   Phase 3 of the redesign: clinicians want to attach NEW assessments
--   to clients (in addition to the original onboarding questionnaire).
--   When a client takes one, their answers feed back into the same
--   `journey_item_responses` workflow that the clinician inbox already
--   surfaces (Phase 2C).
--
-- Design choice:
--   - We do NOT introduce a new `journey_assessments` table. Instead
--     we add a `kind` discriminator to `journey_items`.
--   - 'content' = the existing kind (article / exercise / video etc.)
--   - 'assessment' = a structured set of questions the user answers
--   - 'reflection' = a single-question prompt (open-ended)
--   - The questions live in a JSONB column on the same row.
--   - User responses keep flowing through `journey_item_responses` -
--     the textarea is replaced with a structured form on the client,
--     but the underlying row shape is identical.
--
--   This keeps the rail / WorkArea / clinician inbox / response
--   visibility (Phase 2A-F) working with zero changes for assessment
--   items: from the system's perspective, an assessment is just an
--   item the user "completes" by submitting a response.
--
-- Hard rules:
--   - Backwards compatible: every new column is nullable / has a
--     'content' default. Existing rows behave exactly as before.
--   - No RLS changes. The existing journey_items policies cover the
--     new kinds because they only check ownership / membership, not
--     content type.
-- ============================================================

begin;

-- 1. The discriminator
alter table public.journey_items
  add column if not exists kind text not null default 'content'
    check (kind in ('content', 'assessment', 'reflection'));

create index if not exists journey_items_kind_idx
  on public.journey_items (kind)
  where kind != 'content';

-- 2. Structured payload for assessment / reflection items
-- Shape (Hebrew + English, owner / partner / both):
--   {
--     "version": 1,
--     "questions": [
--       {
--         "id":           "q1",
--         "kind":         "single_choice" | "multiple_choice" | "scale" | "open_text" | "ranking",
--         "prompt_he":    "באיזו תדירות אתם מרגישים מקושרים?",
--         "prompt_en":    "How often do you feel connected?",
--         "required":     true,
--         "options":      [{ "key": "rarely", "label_he": "לעיתים רחוקות", "label_en": "Rarely" }],
--         "scale_min":    1,
--         "scale_max":    7,
--         "scale_min_label_he": "כלל לא",
--         "scale_max_label_he": "מאוד מקושר",
--         "audience":     "both" | "owner" | "partner"
--       }
--     ],
--     "intro_he":  "...",
--     "intro_en":  "...",
--     "outro_he":  "...",
--     "outro_en":  "..."
--   }
--
-- Validation lives in the client+server code; the column is plain
-- jsonb so we can iterate fast.
alter table public.journey_items
  add column if not exists assessment_payload jsonb;

-- 3. A response shape hint on journey_item_responses - for non-textarea
-- assessments the client serializes the structured answer here.
-- The existing `response_text` keeps the prose for reflection items
-- and content-feedback items.
alter table public.journey_item_responses
  add column if not exists structured_answer jsonb;

comment on column public.journey_items.kind is
  'Discriminator: ''content'' (default), ''assessment'' (structured questionnaire), ''reflection'' (open-ended prompt). Migration 050.';
comment on column public.journey_items.assessment_payload is
  'When kind=''assessment'' or ''reflection'', the question schema in JSONB. Null for content items.';
comment on column public.journey_item_responses.structured_answer is
  'For assessment items: serialized structured answer. For content items: null (response_text holds the prose).';

commit;

select pg_notify('pgrst', 'reload schema');
