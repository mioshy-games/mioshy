-- ─────────────────────────────────────────────────────────────────────────────
-- 020  Single-session enforcement + profiles extension
-- ─────────────────────────────────────────────────────────────────────────────
-- Run in Supabase SQL editor:
--   https://supabase.com/dashboard/project/kphfmbqqafrvuzmiotsz/sql/new

-- ── Extend profiles with full_name + phone ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone     text;

-- ── user_sessions ─────────────────────────────────────────────────────────────
-- Tracks the ONE authoritative active session per user.
-- On each new login the old row is deleted and replaced.
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token   text        NOT NULL UNIQUE,
  device_info     jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per user - enforce at DB level
CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_user_id_unique
  ON public.user_sessions (user_id);

-- Index for fast token lookups in middleware
CREATE INDEX IF NOT EXISTS user_sessions_token_idx
  ON public.user_sessions (session_token);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own session
CREATE POLICY "user_sessions_select_own"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role manages everything (used by server actions)
CREATE POLICY "user_sessions_service_all"
  ON public.user_sessions FOR ALL
  USING (true)
  WITH CHECK (true);
