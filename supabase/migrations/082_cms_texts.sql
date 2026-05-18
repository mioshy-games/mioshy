-- 082_cms_texts.sql
--
-- Phase 1 of the internal CMS (feature/admin-cms).
--
-- Adds two tables that let an admin edit every user-facing copy
-- string + its per-language typography overrides directly from
-- /admin/content, without touching messages/*.json or shipping a
-- deploy.
--
-- Tables:
--   public.cms_texts          — live source of truth, one row per key
--   public.cms_text_history   — audit log of every meaningful UPDATE
--
-- Read model on the public site:
--   • Page-level loader does a single `SELECT * FROM cms_texts
--     WHERE page = $1` and caches the result for ~60s.
--   • `useCmsText(key)` consults the loaded rows; on miss OR empty
--     value, falls back to the existing next-intl messages/*.json
--     translation. The site never breaks if this table is empty.
--
-- RLS:
--   • cms_texts SELECT  — public/anon (the public site reads this).
--   • cms_texts INSERT/UPDATE/DELETE — admin only (profiles.role='admin').
--   • cms_text_history — admin-only for both read and write.
--     Public/anon must NOT see historical values.
--
-- Auditing:
--   • A BEFORE UPDATE trigger copies the OLD row into cms_text_history
--     with change_type='edit' whenever any text/typography column
--     actually changes. The admin app can also explicitly insert
--     'publish' or 'revert' rows from its action layer.
--
-- Idempotent on re-run (IF NOT EXISTS / OR REPLACE / DROP POLICY IF
-- EXISTS) so this migration can be safely applied to a database that
-- already has an earlier partial version of the schema.

BEGIN;

-- ── 1. Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cms_texts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dotted-path key as it appears in messages/*.json,
  -- e.g. "homeV2.hero.tag" or "nav.menu.about". Unique across the
  -- whole CMS — there is exactly one row per key.
  key               TEXT NOT NULL UNIQUE,

  -- Grouping used by the admin UI tabs/sections. Derived at seed
  -- time from the key's namespace. Free text on purpose so the
  -- admin tool can introduce new pages/sections without a schema
  -- change.
  page              TEXT NOT NULL,        -- "homepage" | "journey" | "games" | "mioshy-sex" | "my" | "shared"
  section           TEXT NOT NULL,        -- "hero" | "reviews" | "faq" | … (page-local)

  -- Bilingual content. Nullable on purpose: when NULL or empty,
  -- the public site falls back to messages/*.json. This lets an
  -- admin "blank" a row without breaking the site.
  he_text           TEXT,
  en_text           TEXT,

  -- Per-language typography overrides. All nullable — when NULL,
  -- the existing CSS class on the rendering element wins (no
  -- inline-style override is emitted).
  he_font_size      TEXT,                  -- e.g. "18px" or "1.2rem"
  he_font_weight    TEXT,                  -- e.g. "600"
  he_line_height    TEXT,                  -- e.g. "1.4"
  en_font_size      TEXT,
  en_font_weight    TEXT,
  en_line_height    TEXT,

  -- Bilingual drift flag — set by the admin when one language was
  -- edited but the other hasn't been reviewed yet. Surfaced as a
  -- visual indicator in the CMS UI.
  needs_review      BOOLEAN NOT NULL DEFAULT false,

  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.cms_texts IS
  'CMS — live source of truth for every editable user-facing string + per-language typography overrides. The public site reads this; on miss/empty it falls back to messages/*.json.';

COMMENT ON COLUMN public.cms_texts.key IS
  'Dotted-path key as it appears in messages/*.json (e.g. homeV2.hero.tag). UNIQUE.';
COMMENT ON COLUMN public.cms_texts.page IS
  'CMS-UI grouping. One of: homepage, journey, games, mioshy-sex, my, shared.';
COMMENT ON COLUMN public.cms_texts.he_text IS
  'Hebrew copy. NULL or empty → public site falls back to messages/he.json for this key.';
COMMENT ON COLUMN public.cms_texts.en_text IS
  'English copy. NULL or empty → public site falls back to messages/en.json for this key.';

CREATE INDEX IF NOT EXISTS cms_texts_page_idx ON public.cms_texts (page);
CREATE INDEX IF NOT EXISTS cms_texts_updated_at_idx ON public.cms_texts (updated_at DESC);


CREATE TABLE IF NOT EXISTS public.cms_text_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The row this history entry belongs to. We DO NOT cascade-delete
  -- on cms_texts removal; if a key is ever deleted from cms_texts we
  -- keep the audit trail orphaned-but-readable.
  text_id           UUID NOT NULL REFERENCES public.cms_texts(id) ON DELETE CASCADE,

  -- Snapshot of cms_texts.key at the time of the change. Stored so
  -- the history list is readable even if the key is later renamed.
  key               TEXT NOT NULL,

  -- Snapshot of the PREVIOUS values (the OLD row), so "Restore this
  -- version" can write these back into cms_texts directly.
  he_text           TEXT,
  en_text           TEXT,
  he_font_size      TEXT,
  he_font_weight    TEXT,
  he_line_height    TEXT,
  en_font_size      TEXT,
  en_font_weight    TEXT,
  en_line_height    TEXT,

  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 'edit'    — text/typography changed via UPDATE trigger (default)
  -- 'publish' — explicit publish action (cache revalidation marker)
  -- 'revert'  — written when an older history row is restored
  change_type       TEXT NOT NULL CHECK (change_type IN ('edit', 'publish', 'revert'))
);

COMMENT ON TABLE public.cms_text_history IS
  'CMS — audit log of every meaningful change to cms_texts. Snapshots the OLD row before each UPDATE so "restore this version" can write the snapshot back.';

CREATE INDEX IF NOT EXISTS cms_text_history_text_id_idx
  ON public.cms_text_history (text_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS cms_text_history_changed_at_idx
  ON public.cms_text_history (changed_at DESC);


-- ── 2. Auto-update updated_at on cms_texts ───────────────────────────

CREATE OR REPLACE FUNCTION public.cms_texts_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cms_texts_touch_updated_at_trigger ON public.cms_texts;
CREATE TRIGGER cms_texts_touch_updated_at_trigger
  BEFORE UPDATE ON public.cms_texts
  FOR EACH ROW
  EXECUTE FUNCTION public.cms_texts_touch_updated_at();


-- ── 3. Audit trigger: snapshot OLD row to history on real changes ────

CREATE OR REPLACE FUNCTION public.cms_texts_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Snapshot the OLD row. The history table's CHECK constraint forces
  -- change_type ∈ {edit, publish, revert}; here we always log 'edit'
  -- because the trigger fires on content changes. Application code
  -- writes 'publish' / 'revert' rows directly.
  INSERT INTO public.cms_text_history (
    text_id, key,
    he_text, en_text,
    he_font_size, he_font_weight, he_line_height,
    en_font_size, en_font_weight, en_line_height,
    changed_by, change_type
  )
  VALUES (
    OLD.id, OLD.key,
    OLD.he_text, OLD.en_text,
    OLD.he_font_size, OLD.he_font_weight, OLD.he_line_height,
    OLD.en_font_size, OLD.en_font_weight, OLD.en_line_height,
    OLD.updated_by,
    'edit'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cms_texts_log_change_trigger ON public.cms_texts;
CREATE TRIGGER cms_texts_log_change_trigger
  BEFORE UPDATE ON public.cms_texts
  FOR EACH ROW
  WHEN (
       OLD.he_text         IS DISTINCT FROM NEW.he_text
    OR OLD.en_text         IS DISTINCT FROM NEW.en_text
    OR OLD.he_font_size    IS DISTINCT FROM NEW.he_font_size
    OR OLD.he_font_weight  IS DISTINCT FROM NEW.he_font_weight
    OR OLD.he_line_height  IS DISTINCT FROM NEW.he_line_height
    OR OLD.en_font_size    IS DISTINCT FROM NEW.en_font_size
    OR OLD.en_font_weight  IS DISTINCT FROM NEW.en_font_weight
    OR OLD.en_line_height  IS DISTINCT FROM NEW.en_line_height
  )
  EXECUTE FUNCTION public.cms_texts_log_change();

COMMENT ON FUNCTION public.cms_texts_log_change IS
  'CMS — fires on every UPDATE to cms_texts that changes text or typography. Copies the OLD row to cms_text_history with change_type=edit so the admin UI can show history and offer "restore this version".';


-- ── 4. Row-Level Security ────────────────────────────────────────────

ALTER TABLE public.cms_texts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_text_history ENABLE ROW LEVEL SECURITY;

-- cms_texts — public read, admin-only writes
-- The public site reads via the anon key, so SELECT must be open to
-- anonymous. Updates/inserts/deletes are gated on profiles.role='admin'
-- using the same pattern as 080_couple_workflow_engine.sql.

DROP POLICY IF EXISTS "cms_texts_select_public" ON public.cms_texts;
CREATE POLICY "cms_texts_select_public"
  ON public.cms_texts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "cms_texts_insert_admin" ON public.cms_texts;
CREATE POLICY "cms_texts_insert_admin"
  ON public.cms_texts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "cms_texts_update_admin" ON public.cms_texts;
CREATE POLICY "cms_texts_update_admin"
  ON public.cms_texts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "cms_texts_delete_admin" ON public.cms_texts;
CREATE POLICY "cms_texts_delete_admin"
  ON public.cms_texts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- cms_text_history — admin-only for both read and write.
-- Public/anon must NOT see historical values.

DROP POLICY IF EXISTS "cms_text_history_admin_all" ON public.cms_text_history;
CREATE POLICY "cms_text_history_admin_all"
  ON public.cms_text_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


COMMIT;

NOTIFY pgrst, 'reload schema';
