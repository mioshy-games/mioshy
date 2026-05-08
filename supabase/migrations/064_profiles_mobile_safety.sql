-- ============================================================
-- 064_profiles_mobile_safety.sql
--
-- Fix for the production error reported by Itzik 2026-05-07:
--
--     Could not find the 'mobile' column of 'profiles' in the
--     schema cache
--
-- Migration 009 already added `mobile text` to public.profiles
-- (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS mobile text`). So in
-- a clean migration history the column exists. The error means
-- one of two things on the affected database:
--
--   1. Migration 009 was never applied (some envs were spun up
--      before that migration shipped).
--   2. PostgREST's schema cache is stale — the column exists but
--      the API server is still running with an older introspection
--      and rejects requests touching `mobile`.
--
-- This migration is idempotent and fixes both. It re-asserts the
-- column with `ADD COLUMN IF NOT EXISTS`, then issues a
-- `NOTIFY pgrst, 'reload schema'` so PostgREST refreshes its
-- cache and starts seeing the column immediately.
--
-- Safe to run multiple times. No data is changed.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mobile text;

-- Same defensive shape for the other freemium fields from 009 —
-- if any of those is missing in a given env, this rescues it too.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spins_used integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_spin_reset timestamptz;

-- Force PostgREST to reload its schema cache. Without this, the
-- new column won't be visible to the REST API until the server
-- is restarted (e.g., via a Supabase project restart). The NOTIFY
-- triggers an instant reload.
NOTIFY pgrst, 'reload schema';
