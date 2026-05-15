-- 084_cms_texts_color_override.sql
--
-- Sprint 5 — Color Override.
--
-- Adds a per-row colour override to cms_texts so an admin can change
-- the text colour of any CMS-driven string from /admin/content
-- without a deploy. NULL = no override (the component's existing CSS
-- class wins, exactly like before this migration).
--
-- Value format (enforced by a CHECK constraint so bad data can't
-- land via direct SQL or a buggy client):
--   NULL                  → no override, component default
--   'preset:<name>'       → one of the 9 named presets resolved by
--                           components/cms/CmsText.tsx. <name> is
--                           kebab-case ASCII (regex [a-z][a-z0-9-]*).
--   '#XXXXXX'             → 6-digit HEX, uppercase or lowercase.
--                           3-digit shorthand is rejected to avoid
--                           ambiguity (#FFF != #F0F0F0 in some
--                           workflows).
--
-- Why store the preset name as 'preset:foo' rather than its resolved
-- HEX:
--   • A future palette change ("brand-rose is now #C04050") only
--     needs a code edit, not a DB migration over thousands of rows.
--   • The 'muted' preset is rgba (with opacity) — it has no single
--     HEX equivalent.
--   • The admin UI can show "brand-rose" in the dropdown without
--     reverse-mapping HEX → name on every render.
--
-- The history table gets the same column so a restore brings back
-- the colour along with the text.
--
-- Idempotent on re-run.

BEGIN;

-- ── 1. Columns ───────────────────────────────────────────────────────

ALTER TABLE public.cms_texts
  ADD COLUMN IF NOT EXISTS color_override TEXT;

ALTER TABLE public.cms_text_history
  ADD COLUMN IF NOT EXISTS color_override TEXT;

COMMENT ON COLUMN public.cms_texts.color_override IS
  'Sprint 5 — per-row text colour override. NULL = no override (component default wins). ''preset:<name>'' = named preset resolved by components/cms/CmsText.tsx. ''#XXXXXX'' = custom 6-digit HEX. Enforced by cms_texts_color_override_format CHECK.';

COMMENT ON COLUMN public.cms_text_history.color_override IS
  'Snapshot of cms_texts.color_override at the time of the change. Lets a "restore this version" reset the colour along with the text.';

-- ── 2. Format CHECK — keeps junk out at the DB layer ────────────────
-- Drop-then-add so a re-run with a tweaked regex picks up the new
-- pattern instead of silently keeping the old one.

ALTER TABLE public.cms_texts
  DROP CONSTRAINT IF EXISTS cms_texts_color_override_format;

ALTER TABLE public.cms_texts
  ADD CONSTRAINT cms_texts_color_override_format
  CHECK (
    color_override IS NULL
    OR color_override ~ '^preset:[a-z][a-z0-9-]*$'
    OR color_override ~ '^#[0-9A-Fa-f]{6}$'
  );

-- ── 3. Audit trigger — include the new column in the change check ───
-- The 082 trigger fires only when a watched column changed. Without
-- this update, editing only the colour would skip the history log.

CREATE OR REPLACE FUNCTION public.cms_texts_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cms_text_history (
    text_id, key,
    he_text, en_text,
    he_font_size, he_font_weight, he_line_height,
    en_font_size, en_font_weight, en_line_height,
    color_override,
    changed_by, change_type
  )
  VALUES (
    OLD.id, OLD.key,
    OLD.he_text, OLD.en_text,
    OLD.he_font_size, OLD.he_font_weight, OLD.he_line_height,
    OLD.en_font_size, OLD.en_font_weight, OLD.en_line_height,
    OLD.color_override,
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
    OR OLD.color_override  IS DISTINCT FROM NEW.color_override
  )
  EXECUTE FUNCTION public.cms_texts_log_change();

COMMIT;

NOTIFY pgrst, 'reload schema';
