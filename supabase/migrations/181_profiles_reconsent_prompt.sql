-- ───────────────────────────────────────────────────────────────────────────
-- 181_profiles_reconsent_prompt.sql
--
-- Re-consent popup (results-summary page) — suppression column. The popup asks
-- users who did NOT tick the marketing-consent box to confirm consent so we can
-- email/WhatsApp them. It must appear at most once: we stamp this timestamp when
-- the user answers (either "yes" or "later"), and never show it again once set.
--
-- Additive, nullable, no default → zero effect on existing rows or the signup
-- flow. Idempotent. Apply manually to prod (repo has no auto-migration runner).
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reconsent_prompt_shown_at timestamptz;

COMMENT ON COLUMN public.profiles.reconsent_prompt_shown_at IS
  'When the results-page re-consent popup was answered (accept or "later"). Non-null suppresses re-showing.';

-- Refresh PostgREST schema cache so the column is queryable immediately.
NOTIFY pgrst, 'reload schema';
