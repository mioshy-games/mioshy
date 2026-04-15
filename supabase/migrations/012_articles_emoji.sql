-- Add emoji column to articles for cover fallback
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS emoji text;
