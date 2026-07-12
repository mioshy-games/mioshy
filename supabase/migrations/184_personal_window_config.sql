-- ───────────────────────────────────────────────────────────────────────────
-- 184_personal_window_config.sql
--
-- Admin control over the personal-window intro offer (the "48h from assessment"
-- bonus): how long the window lasts, and whether it shows as a text line or a
-- ticking countdown clock. Both live on the site_settings singleton (id=1),
-- next to promo_mode (migration 160).
--
--   personal_window_hours   int   default 48   — window length, stamped as
--                                                now + N hours at short-assessment
--                                                completion (app/api/journey/answer).
--   personal_window_display text  default 'text' ('text' | 'clock') — how the
--                                                results page shows the window.
--
-- Additive + idempotent (add column if not exists + guarded CHECK). No behaviour
-- change until the admin edits the values (defaults reproduce today's 48h/text).
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS personal_window_hours   int  NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS personal_window_display text NOT NULL DEFAULT 'text';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_pw_display_check'
  ) THEN
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_pw_display_check
      CHECK (personal_window_display IN ('text', 'clock'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_pw_hours_check'
  ) THEN
    -- Sanity bound: 1 hour … 720 hours (30 days). Guards against a fat-finger 0.
    ALTER TABLE public.site_settings
      ADD CONSTRAINT site_settings_pw_hours_check
      CHECK (personal_window_hours BETWEEN 1 AND 720);
  END IF;
END $$;

COMMENT ON COLUMN public.site_settings.personal_window_hours IS
  'Personal-window intro offer length in hours (stamped now+N at short-assessment completion). Default 48.';
COMMENT ON COLUMN public.site_settings.personal_window_display IS
  'How the personal window shows on the results page: text (line) | clock (countdown). Default text.';

-- Refresh PostgREST schema cache so the columns are queryable immediately.
SELECT pg_notify('pgrst', 'reload schema');
