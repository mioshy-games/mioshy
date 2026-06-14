-- 119_journey_analysis_report_markers.sql
-- =============================================================================
-- F1 — Additive markers on public.journey_analysis so a SHORT (pre-purchase)
-- report is distinguishable from a FULL report, and re-runs can be numbered.
--
-- Both columns are NULLABLE / DEFAULTed → no backfill, no risk to existing rows
-- and no impact on the live scoring path (analysis.ts doesn't read these).
--
--   report_phase   — which question set produced this analysis row.
--                    DEFAULT 'full' so every existing/legacy row reads as a
--                    full report (correct: today's flow is the full set).
--   report_version — per-user/per-lineage run number. NUMBERING LOGIC IS
--                    DEFERRED TO F4; we only add the column now (left NULL).
--
-- Idempotent (ADD COLUMN IF NOT EXISTS). Does NOT touch any other table.
-- =============================================================================

BEGIN;

ALTER TABLE public.journey_analysis
  ADD COLUMN IF NOT EXISTS report_phase text NOT NULL DEFAULT 'full'
    CHECK (report_phase IN ('short','full'));

ALTER TABLE public.journey_analysis
  ADD COLUMN IF NOT EXISTS report_version int;

COMMENT ON COLUMN public.journey_analysis.report_phase IS
  'F1 — which question set produced this analysis: short (pre-purchase preview) or full. DEFAULT full; legacy rows read as full. Lets the UI label preview vs full and lets history compare like-with-like (full-to-full across 8-week re-runs).';
COMMENT ON COLUMN public.journey_analysis.report_version IS
  'F1 — run number for a user''s analysis lineage. Numbering logic deferred to F4; column added now so it can be populated without a later migration.';

COMMIT;

NOTIFY pgrst, 'reload schema';
