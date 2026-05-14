-- ============================================================
-- cms_texts re-sectioning migration  —  Sprint 4 #3 Phase 2 follow-up
-- Date: 2026-05-14
-- Author: Itzik (mioshyoffice@gmail.com)
--
-- Why:
--   The seed script (scripts/seed-cms-texts.mjs) currently maps any
--   2-segment key (`namespace.key`) to section = second segment. For
--   `myHub.subtitle` that means section="subtitle" — a section of
--   exactly one key. Across journey/games/mioshy-sex/my the admin
--   editor ended up with dozens of single-key sections, making it
--   unnavigable (games: 55 sections / 76 keys; my: 63 / 105).
--
-- New rule (decided 2026-05-14 — "top-namespace fallback"):
--   1. Single-section namespaces (overrides from the seed script's
--      SECTION_OVERRIDES map): force section to the namespace name
--      regardless of key depth — nav, footer, legal, metadata,
--      paywall, pricing, auth, account, articlePage→"article",
--      articlesPage→"articles".
--   2. Keys with 3+ dotted segments — section = segment[1]
--      (0-indexed in JS terms; split_part index 2 in PostgreSQL).
--      Example: `journeyAssessment.analysis.cta` → "analysis".
--      UNCHANGED from current behaviour.
--   3. Keys with 1 or 2 dotted segments — section = segment[0]
--      (the top namespace itself). Example: `journeyHub.h1` →
--      "journeyHub", `gamesHub.lede` → "gamesHub". THIS IS THE
--      FIX. Grouping reflects the page/component that contributed
--      the keys, so the admin's "I want to edit page X" mental
--      model lands on the right section instantly.
--
-- Scope:
--   page != 'homepage'  — homepage rows already follow the 3+
--   segment pattern correctly (31 sections, 416 rows). Not
--   touched.
--
-- Columns updated: section ONLY. he_text, en_text, is_rich,
-- he/en_font_size/_weight/_line_height, needs_review, updated_by
-- are not in the UPDATE list. A trigger on `updated_at` (if one
-- exists) will bump the timestamp for the ~183 affected rows —
-- Itzik confirmed this is acceptable (schema-level metadata
-- change, not content edit history).
--
-- The WHERE clause's `section IS DISTINCT FROM (...)` guard avoids
-- writing rows that already have the correct section.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Step 1 — Preview (read-only). Run this first to confirm the
-- per-page row-change counts match the expected impact.
-- ────────────────────────────────────────────────────────────

WITH proposed AS (
  SELECT
    id,
    page,
    key,
    section AS current_section,
    CASE
      WHEN split_part(key, '.', 1) = 'nav'          THEN 'nav'
      WHEN split_part(key, '.', 1) = 'footer'       THEN 'footer'
      WHEN split_part(key, '.', 1) = 'legal'        THEN 'legal'
      WHEN split_part(key, '.', 1) = 'metadata'     THEN 'metadata'
      WHEN split_part(key, '.', 1) = 'paywall'      THEN 'paywall'
      WHEN split_part(key, '.', 1) = 'pricing'      THEN 'pricing'
      WHEN split_part(key, '.', 1) = 'auth'         THEN 'auth'
      WHEN split_part(key, '.', 1) = 'account'      THEN 'account'
      WHEN split_part(key, '.', 1) = 'articlePage'  THEN 'article'
      WHEN split_part(key, '.', 1) = 'articlesPage' THEN 'articles'
      WHEN array_length(string_to_array(key, '.'), 1) >= 3
        THEN split_part(key, '.', 2)
      ELSE split_part(key, '.', 1)
    END AS new_section
  FROM cms_texts
  WHERE page != 'homepage'
)
SELECT
  page,
  current_section,
  new_section,
  COUNT(*) AS rows
FROM proposed
WHERE current_section IS DISTINCT FROM new_section
GROUP BY page, current_section, new_section
ORDER BY page, rows DESC, current_section;

-- ────────────────────────────────────────────────────────────
-- Step 2 — Migration (writes). Run after reviewing Step 1.
-- ────────────────────────────────────────────────────────────

UPDATE cms_texts
SET section = CASE
  WHEN split_part(key, '.', 1) = 'nav'          THEN 'nav'
  WHEN split_part(key, '.', 1) = 'footer'       THEN 'footer'
  WHEN split_part(key, '.', 1) = 'legal'        THEN 'legal'
  WHEN split_part(key, '.', 1) = 'metadata'     THEN 'metadata'
  WHEN split_part(key, '.', 1) = 'paywall'      THEN 'paywall'
  WHEN split_part(key, '.', 1) = 'pricing'      THEN 'pricing'
  WHEN split_part(key, '.', 1) = 'auth'         THEN 'auth'
  WHEN split_part(key, '.', 1) = 'account'      THEN 'account'
  WHEN split_part(key, '.', 1) = 'articlePage'  THEN 'article'
  WHEN split_part(key, '.', 1) = 'articlesPage' THEN 'articles'
  WHEN array_length(string_to_array(key, '.'), 1) >= 3
    THEN split_part(key, '.', 2)
  ELSE split_part(key, '.', 1)
END
WHERE page != 'homepage'
  AND section IS DISTINCT FROM (
    CASE
      WHEN split_part(key, '.', 1) = 'nav'          THEN 'nav'
      WHEN split_part(key, '.', 1) = 'footer'       THEN 'footer'
      WHEN split_part(key, '.', 1) = 'legal'        THEN 'legal'
      WHEN split_part(key, '.', 1) = 'metadata'     THEN 'metadata'
      WHEN split_part(key, '.', 1) = 'paywall'      THEN 'paywall'
      WHEN split_part(key, '.', 1) = 'pricing'      THEN 'pricing'
      WHEN split_part(key, '.', 1) = 'auth'         THEN 'auth'
      WHEN split_part(key, '.', 1) = 'account'      THEN 'account'
      WHEN split_part(key, '.', 1) = 'articlePage'  THEN 'article'
      WHEN split_part(key, '.', 1) = 'articlesPage' THEN 'articles'
      WHEN array_length(string_to_array(key, '.'), 1) >= 3
        THEN split_part(key, '.', 2)
      ELSE split_part(key, '.', 1)
    END
  );

-- ────────────────────────────────────────────────────────────
-- Step 3 — Verify (read-only). Section counts per page should
-- now read: journey 27, games 8, mioshy-sex 5, my 7,
-- homepage 31 (untouched), shared 9 (untouched).
-- ────────────────────────────────────────────────────────────

SELECT
  page,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT section) AS sections
FROM cms_texts
GROUP BY page
ORDER BY page;
