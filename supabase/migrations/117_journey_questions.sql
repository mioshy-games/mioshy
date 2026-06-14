-- 117_journey_questions.sql
-- =============================================================================
-- F1 — Assessment data-model foundation (Option B): a DEDICATED, admin-editable
-- question bank for the JOURNEY questionnaire.
--
-- Why a separate table (not reusing assessment_questions):
--   The journey uses WEIGHTED-AXIS scoring (axes:[{axis,weight}], signed/
--   fractional weights, a `domain`, and option-level `scores`), which is a
--   different scoring model from the intimacy/friendship assessments
--   (dimension-average). Keeping them apart avoids polluting the live, paid
--   intimacy/friendship CMS with mutually-exclusive nullable columns and
--   isolates all risk of in-flight journey work from that surface.
--
--   This MIRRORS THE PATTERN of assessment_questions (109) + cms_texts (082):
--     • DB is the editable source of truth; the static
--       journey/questionnaire.json remains the seed-of-record AND the runtime
--       FALLBACK (the loader, added in a SEPARATE follow-up step, reads this
--       table and falls back to the JSON when the table is empty — so nothing
--       breaks before the loader change lands).
--     • slug is the stable scoring join key (== journey_responses.question_id);
--       analysis.ts resolves a response's axes/weights by slug, so the seed
--       copies axes/domain/option-scores BYTE-FOR-BYTE and scoring is identical.
--
-- This migration creates:
--   1. public.journey_questions          — live, editable question bank
--   2. public.journey_questions_history  — audit log (mirror cms_text_history)
--      + the BEFORE-UPDATE auto-touch and audit triggers.
--
-- Seed lives in 118_journey_questions_seed.sql (re-runnable, upsert on slug).
-- Additive journey_analysis markers live in 119.
--
-- Idempotent on re-run (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- Does NOT touch assessment_questions / intimacy / friendship / games.
-- =============================================================================

BEGIN;

-- ── 1. Live table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.journey_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable per-question id (e.g. q01_knowledge_world). Equals
  -- journey_responses.question_id and is the key analysis.ts scores on, so it
  -- is GLOBALLY unique (NOT scoped by phase).
  slug        text NOT NULL,

  -- Display / scoring order. Mirrors the array index in questionnaire.json.
  position    int  NOT NULL DEFAULT 0,

  -- Which sub-questionnaire this question belongs to. ADMIN-EDITABLE: a plain
  -- column, never derived. 'short' = pre-purchase (~11 Q); 'full' = the rest.
  -- No question appears in both. The 8-week recurring re-run uses the FULL set.
  phase       text NOT NULL CHECK (phase IN ('short','full')),

  -- likert5 | forced_choice | single_choice | multi_choice | reflection |
  -- ranking. Left as free text (no CHECK) so the admin can introduce new
  -- presentation types later without a schema change.
  type        text NOT NULL DEFAULT 'likert5',

  -- One of the 5 product domains, or NULL for demographics / meta / open
  -- reflections (matches questionnaire.json `domain`).
  domain      text,

  -- SCORING CONFIG — [{axis,weight}], verbatim from questionnaire.json
  -- (signed/fractional weights preserved). Empty [] for non-diagnostic items.
  axes        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Parity with assessment_questions. Journey inverts via NEGATIVE weight
  -- (e.g. passion_context -1.0), so this stays false; kept for future use.
  reverse     boolean NOT NULL DEFAULT false,

  -- Bilingual prompt. Unifies questionnaire.json `he`/`he_prompt` into one
  -- column; the loader maps back by `type`. NULL/empty → loader falls back to
  -- the JSON for that field, so the flow never breaks.
  he_text     text,
  en_text     text,

  -- Answer choices for choice questions — [{id,he,en,scores:[{axis,weight}]}],
  -- verbatim. NULL for likert/reflection. Option `id` + `scores` are SCORING
  -- CONFIG (persisted into journey_responses.answer); never regenerate ids.
  options     jsonb,

  -- Type-specific extras that don't deserve a column each: purpose, insight,
  -- max_length (reflections), he_subline/en_subline + categories (ranking).
  meta        jsonb,

  is_active   boolean NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Scoring joins on slug alone — NOT (phase, slug).
  UNIQUE (slug)
);

COMMENT ON TABLE public.journey_questions IS
  'F1 — editable source of truth for the journey questionnaire. The public site reads this; on empty/miss the loader falls back to journey/questionnaire.json. slug == journey_responses.question_id; axes/options.scores are scoring config consumed by lib/journey/analysis.ts.';
COMMENT ON COLUMN public.journey_questions.slug IS
  'Stable global id (== journey_responses.question_id). The key analysis.ts scores on. UNIQUE.';
COMMENT ON COLUMN public.journey_questions.phase IS
  'short = pre-purchase set; full = the rest. Admin-editable plain column, never derived. Recurring 8-week re-run uses the full set.';
COMMENT ON COLUMN public.journey_questions.axes IS
  'Scoring config: [{axis,weight}] verbatim from questionnaire.json (signed/fractional weights). Empty [] = non-diagnostic.';
COMMENT ON COLUMN public.journey_questions.options IS
  'Choice options [{id,he,en,scores}] verbatim. Option id + scores are scoring config — do not regenerate ids.';

CREATE INDEX IF NOT EXISTS journey_questions_order_idx
  ON public.journey_questions (is_active, position);
CREATE INDEX IF NOT EXISTS journey_questions_phase_idx
  ON public.journey_questions (phase);


-- ── 2. Audit-trail table (mirror cms_text_history) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.journey_questions_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The row this entry belongs to. Mirrors cms_text_history (ON DELETE CASCADE).
  question_id  uuid NOT NULL REFERENCES public.journey_questions(id) ON DELETE CASCADE,

  -- Snapshot of slug so history is readable even if the row is later renamed.
  slug         text NOT NULL,

  -- Snapshot of the PREVIOUS (OLD) values so "restore this version" can write
  -- them straight back into journey_questions.
  position     int,
  phase        text,
  type         text,
  domain       text,
  axes         jsonb,
  reverse      boolean,
  he_text      text,
  en_text      text,
  options      jsonb,
  meta         jsonb,
  is_active    boolean,

  changed_at   timestamptz NOT NULL DEFAULT now(),
  changed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 'edit'    — content/scoring changed via UPDATE trigger (default)
  -- 'publish' — explicit publish action (cache revalidation marker)
  -- 'revert'  — written when an older history row is restored
  change_type  text NOT NULL CHECK (change_type IN ('edit','publish','revert'))
);

COMMENT ON TABLE public.journey_questions_history IS
  'F1 — audit log of every meaningful change to journey_questions. Snapshots the OLD row before each content/scoring UPDATE so the admin can show history and offer "restore this version". Editing a question can change scoring, so these edits are worth auditing.';

CREATE INDEX IF NOT EXISTS journey_questions_history_qid_idx
  ON public.journey_questions_history (question_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS journey_questions_history_changed_at_idx
  ON public.journey_questions_history (changed_at DESC);


-- ── 3. Auto-touch updated_at (mirror cms_texts_touch_updated_at) ─────────────
CREATE OR REPLACE FUNCTION public.journey_questions_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey_questions_touch_updated_at_trigger ON public.journey_questions;
CREATE TRIGGER journey_questions_touch_updated_at_trigger
  BEFORE UPDATE ON public.journey_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.journey_questions_touch_updated_at();


-- ── 4. Audit trigger: snapshot OLD row on a real content/scoring change ──────
CREATE OR REPLACE FUNCTION public.journey_questions_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Pinned to '' (empty) — stricter than the cms_text_history pattern's
-- `SET search_path = public`. A SECURITY DEFINER function with a writable
-- schema (public) on its path is a search-path injection vector; with '' the
-- function resolves nothing implicitly, so the fully-qualified INSERT target
-- below (public.journey_questions_history) and pg_catalog builtins are the
-- only reachable objects.
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.journey_questions_history (
    question_id, slug,
    position, phase, type, domain, axes, reverse,
    he_text, en_text, options, meta, is_active,
    changed_by, change_type
  )
  VALUES (
    OLD.id, OLD.slug,
    OLD.position, OLD.phase, OLD.type, OLD.domain, OLD.axes, OLD.reverse,
    OLD.he_text, OLD.en_text, OLD.options, OLD.meta, OLD.is_active,
    OLD.updated_by,
    'edit'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS journey_questions_log_change_trigger ON public.journey_questions;
CREATE TRIGGER journey_questions_log_change_trigger
  BEFORE UPDATE ON public.journey_questions
  FOR EACH ROW
  WHEN (
       OLD.position   IS DISTINCT FROM NEW.position
    OR OLD.phase      IS DISTINCT FROM NEW.phase
    OR OLD.type       IS DISTINCT FROM NEW.type
    OR OLD.domain     IS DISTINCT FROM NEW.domain
    OR OLD.axes       IS DISTINCT FROM NEW.axes
    OR OLD.reverse    IS DISTINCT FROM NEW.reverse
    OR OLD.he_text    IS DISTINCT FROM NEW.he_text
    OR OLD.en_text    IS DISTINCT FROM NEW.en_text
    OR OLD.options    IS DISTINCT FROM NEW.options
    OR OLD.meta       IS DISTINCT FROM NEW.meta
    OR OLD.is_active  IS DISTINCT FROM NEW.is_active
  )
  EXECUTE FUNCTION public.journey_questions_log_change();

COMMENT ON FUNCTION public.journey_questions_log_change IS
  'F1 — fires on every UPDATE to journey_questions that changes content/scoring/order. Copies the OLD row to journey_questions_history (change_type=edit). The WHEN guard means an idempotent re-seed with identical values writes no history noise.';


-- ── 5. Row-Level Security ────────────────────────────────────────────────────
-- journey_questions: MIRROR assessment_questions (109) EXACTLY —
--   RLS enabled, public/anon SELECT only. There are NO INSERT/UPDATE/DELETE
--   policies, so every write is denied to anon/authenticated and must go
--   through the admin via the service-role client (server actions), which
--   bypasses RLS. This is the repo's established "admin-only writes" pattern
--   for editable, publicly-readable banks (questions are shown to anonymous
--   pre-purchase users).
ALTER TABLE public.journey_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_questions_read ON public.journey_questions;
CREATE POLICY journey_questions_read
  ON public.journey_questions FOR SELECT USING (true);

-- journey_questions_history: admin-only for BOTH read and write. Public/anon
--   must NOT see historical values. Uses the repo's CANONICAL admin check —
--   public.is_admin() (defined in 001_admin_schema.sql) — exactly as the newest
--   migrations do (112_subscription_prices.sql, 115 RPC guard). NOTE: we do NOT
--   copy 082 cms_text_history's inline `profiles.role='admin'` test — that is an
--   outlier and references a column that doesn't exist here (it caused the
--   42703 error). (The audit trigger above is SECURITY DEFINER, so it still
--   writes history rows for service-role edits regardless of this policy.)
ALTER TABLE public.journey_questions_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journey_questions_history_admin_all ON public.journey_questions_history;
CREATE POLICY journey_questions_history_admin_all
  ON public.journey_questions_history
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;

NOTIFY pgrst, 'reload schema';
