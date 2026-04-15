-- Fix broken email regex on leads table.
--
-- Migration 012 used double-backslash escaping inside a single-quoted SQL
-- string (standard_conforming_strings=on), which caused:
--   '\\.' → regex \\. → "literal backslash + any char"   (wrong)
-- instead of:
--   '\.'  → regex \.  → "literal dot"                    (correct)
--
-- This broke validation for any email with a '.' in the domain (i.e. all of them).

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_email_check;

-- Simple, permissive check: must contain exactly one @, something before it,
-- and at least one dot with something after it in the domain.
ALTER TABLE public.leads
  ADD CONSTRAINT leads_email_check
  CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$');
