-- ───────────────────────────────────────────────────────────────────────────
-- 167_articles_scheduled_publish.sql
--
-- Article infrastructure upgrade (Itzik 2026-07-06):
--   1. scheduled_publish_at — timed publishing. An article with
--      is_published=true stays COMPLETELY hidden from the public (404, absent
--      from /articles, sitemap, and "more articles") until
--      scheduled_publish_at <= now(). At that moment it goes live with no
--      manual action — every public query gates on the timestamp and the
--      pages/sitemap are dynamic / hourly-revalidated. NULL = publish
--      immediately (legacy behaviour, unchanged for existing rows).
--   2. faq  — [{ "q": "...", "a": "..." }] powering the FAQPage JSON-LD.
--   3. graph — a single in-body chart: { "type": "bars", "title", "source",
--      "bars": [{ "label", "value", "display" }] }. Rendered where the body
--      contains the {{graph}} token.
--
-- Idempotent (IF NOT EXISTS). No backfill: existing articles get NULLs, so
-- their visibility and rendering are unchanged.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS faq   jsonb,
  ADD COLUMN IF NOT EXISTS graph jsonb;

-- Fast lookup for the "due yet?" gate on the public queries.
CREATE INDEX IF NOT EXISTS idx_articles_scheduled_publish_at
  ON public.articles (scheduled_publish_at);
