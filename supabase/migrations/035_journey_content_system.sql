-- ============================================================
-- 035_journey_content_system.sql
-- Structured content delivery ("Journey Content System").
--
-- Product context (from docs/journey-content-system-design.md Revision 2):
--   * A "journey" is a time-released roadmap of content delivered to an
--     OWNER, where an owner is EITHER a single user OR a couple
--     (polymorphic ownership - exactly one of user_id/couple_id is set).
--   * Content lives ONCE in the items table and is referenced by FK from
--     scheduled rows - edits to body/title/task/media flow through to
--     every existing user automatically (retroactive by design).
--   * Structural edits (add/remove item, change default_offset_days)
--     are NOT automatic - admin chooses via PropagateConfirmDialog
--     whether to apply to existing assignments.
--   * Completion is OPTIONAL. Responses (text reflections) are separate,
--     append-only, shared within a couple by default with a per-response
--     is_private toggle (resolved decision D2).
--   * No expiration, no passed state. Derived display status is just
--     locked / available / completed.
--   * Automation-ready: assignments carry origin (admin_manual|purchase|
--     trigger) + origin_ref so purchase/trigger hooks slot in later.
--
-- Mutations route through the admin (service-role) client per the
-- project's @supabase/ssr pattern - this migration installs SELECT-only
-- RLS policies. There are intentionally NO insert/update/delete policies.
-- ============================================================


-- ============================================================
-- SECTION 1 - PROGRAMS
-- A program is a reusable template (e.g. "6-week intimacy reset").
-- It contains categories. Admin bulk-assigns it to owners and each
-- item inside becomes a scheduled row per assignment.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journey_programs (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text         NOT NULL,
  name_he           text         NOT NULL,
  name_en           text,
  description_he    text,
  description_en    text,
  cover_image_url   text,
  -- How anchor_date is chosen when the program is assigned. Admin can
  -- still override per-assignment.
  default_anchor    text         NOT NULL DEFAULT 'assignment',
  is_active         boolean      NOT NULL DEFAULT true,
  sort_weight       int          NOT NULL DEFAULT 0,
  created_by        uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_programs
  DROP CONSTRAINT IF EXISTS journey_programs_default_anchor_check;
ALTER TABLE public.journey_programs
  ADD CONSTRAINT journey_programs_default_anchor_check
  CHECK (default_anchor IN ('assignment','purchase','fixed'));

CREATE UNIQUE INDEX IF NOT EXISTS journey_programs_slug_key
  ON public.journey_programs (slug);

CREATE INDEX IF NOT EXISTS journey_programs_active_idx
  ON public.journey_programs (is_active, sort_weight DESC)
  WHERE is_active;


-- ============================================================
-- SECTION 2 - CATEGORIES
-- A category groups items topically. It can belong to a program
-- (program_id not null) or stand alone (program_id null) so that
-- admin can bulk-assign a topical category to an owner on its own.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journey_categories (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        uuid         REFERENCES public.journey_programs(id) ON DELETE CASCADE,
  slug              text         NOT NULL,
  name_he           text         NOT NULL,
  name_en           text,
  description_he    text,
  description_en    text,
  sort_order        int          NOT NULL DEFAULT 0,
  is_active         boolean      NOT NULL DEFAULT true,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

-- Uniqueness on (program_id, slug). Standalone categories (program_id
-- null) get a separate partial unique index because NULLs are not
-- considered equal by the normal UNIQUE constraint.
CREATE UNIQUE INDEX IF NOT EXISTS journey_categories_program_slug_key
  ON public.journey_categories (program_id, slug)
  WHERE program_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS journey_categories_standalone_slug_key
  ON public.journey_categories (slug)
  WHERE program_id IS NULL;

CREATE INDEX IF NOT EXISTS journey_categories_program_idx
  ON public.journey_categories (program_id, sort_order)
  WHERE program_id IS NOT NULL;


-- ============================================================
-- SECTION 3 - ITEMS (content catalog)
-- Every item MUST belong to a category (resolved adj #4). Content lives
-- here and ONLY here - scheduled rows reference items by FK so content
-- edits flow through to existing users automatically (adj #6).
-- default_offset_days = how many days after the assignment's anchor
-- date this item should unlock (0 = unlocks on anchor day).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journey_items (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id           uuid         NOT NULL REFERENCES public.journey_categories(id) ON DELETE RESTRICT,
  slug                  text         NOT NULL,
  title_he              text         NOT NULL,
  title_en              text,
  body_he               text         NOT NULL,   -- markdown
  body_en               text,
  task_he               text,
  task_en               text,
  challenge_he          text,
  challenge_en          text,
  video_url             text,
  image_url             text,
  sort_order            int          NOT NULL DEFAULT 0,
  default_offset_days   int          NOT NULL DEFAULT 0,
  is_active             boolean      NOT NULL DEFAULT true,
  created_by            uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS journey_items_category_slug_key
  ON public.journey_items (category_id, slug);

CREATE INDEX IF NOT EXISTS journey_items_category_sort_idx
  ON public.journey_items (category_id, sort_order);

CREATE INDEX IF NOT EXISTS journey_items_active_idx
  ON public.journey_items (is_active)
  WHERE is_active;


-- ============================================================
-- SECTION 4 - ASSIGNMENTS
-- Owner is polymorphic: exactly one of user_id / couple_id is set.
-- origin tracks whether this was manual or fired by a future trigger
-- (purchase webhook, etc.) - schema stays stable when automation lands.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journey_assignments (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Owner (XOR enforced below)
  user_id        uuid         REFERENCES auth.users(id)  ON DELETE CASCADE,
  couple_id      uuid         REFERENCES public.couples(id) ON DELETE CASCADE,
  -- What is being assigned. source_id points at programs/categories/items
  -- - the join happens in the query layer (no FK partitioning in SQL,
  -- kept intentionally simple).
  source_kind    text         NOT NULL,
  source_id      uuid         NOT NULL,
  -- How anchor_date was resolved + the resolved absolute date.
  anchor_kind    text         NOT NULL DEFAULT 'assignment',
  anchor_date    timestamptz  NOT NULL,
  -- Automation-ready bookkeeping
  origin         text         NOT NULL DEFAULT 'admin_manual',
  origin_ref     text,
  assigned_by    uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  notes          text,
  is_active      boolean      NOT NULL DEFAULT true,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_assignments
  DROP CONSTRAINT IF EXISTS journey_assignments_source_kind_check;
ALTER TABLE public.journey_assignments
  ADD CONSTRAINT journey_assignments_source_kind_check
  CHECK (source_kind IN ('program','category','item'));

ALTER TABLE public.journey_assignments
  DROP CONSTRAINT IF EXISTS journey_assignments_anchor_kind_check;
ALTER TABLE public.journey_assignments
  ADD CONSTRAINT journey_assignments_anchor_kind_check
  CHECK (anchor_kind IN ('assignment','purchase','fixed'));

ALTER TABLE public.journey_assignments
  DROP CONSTRAINT IF EXISTS journey_assignments_origin_check;
ALTER TABLE public.journey_assignments
  ADD CONSTRAINT journey_assignments_origin_check
  CHECK (origin IN ('admin_manual','purchase','trigger'));

-- Polymorphic owner: exactly ONE of user_id / couple_id must be set.
ALTER TABLE public.journey_assignments
  DROP CONSTRAINT IF EXISTS journey_assignments_owner_xor;
ALTER TABLE public.journey_assignments
  ADD CONSTRAINT journey_assignments_owner_xor
  CHECK ((user_id IS NOT NULL) <> (couple_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS journey_assignments_user_idx
  ON public.journey_assignments (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS journey_assignments_couple_idx
  ON public.journey_assignments (couple_id)
  WHERE couple_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS journey_assignments_source_idx
  ON public.journey_assignments (source_kind, source_id)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS journey_assignments_origin_idx
  ON public.journey_assignments (origin, origin_ref)
  WHERE origin <> 'admin_manual';


-- ============================================================
-- SECTION 5 - SCHEDULED ITEMS
-- Materialized timeline row per (assignment × item). Only the absolute
-- unlock_at is stored; content is fetched via the FK to journey_items.
-- NO expires_at, NO status column, NO per-row content copy (adj #2, #6).
-- has_unlock_override = true when admin intentionally moved unlock_at
-- so structural propagation leaves that row alone.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journey_scheduled_items (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id         uuid         NOT NULL REFERENCES public.journey_assignments(id) ON DELETE CASCADE,
  item_id               uuid         NOT NULL REFERENCES public.journey_items(id)       ON DELETE CASCADE,
  unlock_at             timestamptz  NOT NULL,
  sort_order            int          NOT NULL DEFAULT 0,
  has_unlock_override   boolean      NOT NULL DEFAULT false,
  admin_notes           text,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS journey_scheduled_items_assignment_item_key
  ON public.journey_scheduled_items (assignment_id, item_id);

CREATE INDEX IF NOT EXISTS journey_scheduled_items_timeline_idx
  ON public.journey_scheduled_items (assignment_id, unlock_at);

CREATE INDEX IF NOT EXISTS journey_scheduled_items_item_idx
  ON public.journey_scheduled_items (item_id);


-- ============================================================
-- SECTION 6 - COMPLETIONS (sparse, optional)
-- One row per scheduled item that has been marked done. Most scheduled
-- rows will never have a completion row, so this stays small.
-- Primary key = scheduled_item_id so UPSERT is trivial.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journey_item_completions (
  scheduled_item_id     uuid         PRIMARY KEY REFERENCES public.journey_scheduled_items(id) ON DELETE CASCADE,
  completed_at          timestamptz  NOT NULL DEFAULT now(),
  completed_by          uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS journey_item_completions_completed_by_idx
  ON public.journey_item_completions (completed_by, completed_at DESC);


-- ============================================================
-- SECTION 7 - RESPONSES (reflections / feedback)
-- Per-user, append-only, multiple allowed per scheduled item.
-- Shared by default within a couple; is_private flips it to "only
-- the author + admin" (resolved decision D2).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.journey_item_responses (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_item_id     uuid         NOT NULL REFERENCES public.journey_scheduled_items(id) ON DELETE CASCADE,
  user_id               uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response_text         text         NOT NULL,
  is_private            boolean      NOT NULL DEFAULT false,
  created_at            timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_item_responses
  DROP CONSTRAINT IF EXISTS journey_item_responses_text_not_empty;
ALTER TABLE public.journey_item_responses
  ADD CONSTRAINT journey_item_responses_text_not_empty
  CHECK (length(trim(response_text)) > 0);

CREATE INDEX IF NOT EXISTS journey_item_responses_scheduled_idx
  ON public.journey_item_responses (scheduled_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS journey_item_responses_user_idx
  ON public.journey_item_responses (user_id, created_at DESC);


-- ============================================================
-- SECTION 8 - UPDATED_AT TRIGGERS
-- Reuse the project-wide public.tg_set_updated_at() function defined
-- in migration 029.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'journey_programs_set_updated_at') THEN
    CREATE TRIGGER journey_programs_set_updated_at
      BEFORE UPDATE ON public.journey_programs
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'journey_categories_set_updated_at') THEN
    CREATE TRIGGER journey_categories_set_updated_at
      BEFORE UPDATE ON public.journey_categories
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'journey_items_set_updated_at') THEN
    CREATE TRIGGER journey_items_set_updated_at
      BEFORE UPDATE ON public.journey_items
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'journey_assignments_set_updated_at') THEN
    CREATE TRIGGER journey_assignments_set_updated_at
      BEFORE UPDATE ON public.journey_assignments
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'journey_scheduled_items_set_updated_at') THEN
    CREATE TRIGGER journey_scheduled_items_set_updated_at
      BEFORE UPDATE ON public.journey_scheduled_items
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END $$;


-- ============================================================
-- SECTION 9 - ROW LEVEL SECURITY (SELECT only)
-- Writes are performed via the service-role admin client per the
-- project's @supabase/ssr pattern. No INSERT/UPDATE/DELETE policies
-- are installed - admin actions must use supabase-admin.
-- ============================================================

ALTER TABLE public.journey_programs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_assignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_scheduled_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_item_completions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_item_responses       ENABLE ROW LEVEL SECURITY;

-- Catalog tables: signed-in users may read active rows; admins see all.
DROP POLICY IF EXISTS journey_programs_read      ON public.journey_programs;
CREATE POLICY journey_programs_read ON public.journey_programs
  FOR SELECT USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS journey_categories_read    ON public.journey_categories;
CREATE POLICY journey_categories_read ON public.journey_categories
  FOR SELECT USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS journey_items_read         ON public.journey_items;
CREATE POLICY journey_items_read ON public.journey_items
  FOR SELECT USING (is_active OR public.is_admin());

-- Assignment visible to its owner (user directly, or via couple_members).
DROP POLICY IF EXISTS journey_assignments_read   ON public.journey_assignments;
CREATE POLICY journey_assignments_read ON public.journey_assignments
  FOR SELECT USING (
    is_active AND (
      user_id = auth.uid()
      OR couple_id IN (SELECT couple_id FROM public.couple_members WHERE user_id = auth.uid())
      OR public.is_admin()
    )
  );

-- Scheduled items visible through their assignment's owner scope.
DROP POLICY IF EXISTS journey_scheduled_items_read ON public.journey_scheduled_items;
CREATE POLICY journey_scheduled_items_read ON public.journey_scheduled_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.journey_assignments a
      WHERE a.id = assignment_id
        AND a.is_active
        AND (
          a.user_id = auth.uid()
          OR a.couple_id IN (SELECT couple_id FROM public.couple_members WHERE user_id = auth.uid())
          OR public.is_admin()
        )
    )
  );

-- Completions visible to anyone who can see the underlying scheduled item.
DROP POLICY IF EXISTS journey_item_completions_read ON public.journey_item_completions;
CREATE POLICY journey_item_completions_read ON public.journey_item_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.journey_scheduled_items s
      JOIN public.journey_assignments a ON a.id = s.assignment_id
      WHERE s.id = scheduled_item_id
        AND (
          a.user_id = auth.uid()
          OR a.couple_id IN (SELECT couple_id FROM public.couple_members WHERE user_id = auth.uid())
          OR public.is_admin()
        )
    )
  );

-- Responses: base visibility = same owner scope. Privacy is applied in
-- the app layer (queries filter is_private rows to author + admin)
-- rather than in RLS, because the "admin sees everything" path needs
-- to include private responses for coaching follow-up, while partners
-- should not. Keeping it in code avoids a policy that references a
-- non-existent helper; the admin client bypasses RLS anyway.
DROP POLICY IF EXISTS journey_item_responses_read ON public.journey_item_responses;
CREATE POLICY journey_item_responses_read ON public.journey_item_responses
  FOR SELECT USING (
    -- Author always sees own rows (private or not).
    user_id = auth.uid()
    OR public.is_admin()
    -- Non-author owner-scope read: only non-private responses.
    OR (
      is_private = false
      AND EXISTS (
        SELECT 1
        FROM public.journey_scheduled_items s
        JOIN public.journey_assignments a ON a.id = s.assignment_id
        WHERE s.id = scheduled_item_id
          AND (
            a.user_id = auth.uid()
            OR a.couple_id IN (SELECT couple_id FROM public.couple_members WHERE user_id = auth.uid())
          )
      )
    )
  );
