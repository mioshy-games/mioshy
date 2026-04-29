-- Add optional category column to questions table
-- category is a free-text tag (e.g. "family", "romance", "spicy") for grouping questions

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.questions.category IS
  'Optional grouping tag for the question (e.g. family, romance, spicy). Empty string = uncategorised.';

-- Reload PostgREST schema cache so the new column is immediately usable
-- from the app without having to restart the project.
NOTIFY pgrst, 'reload schema';
