#!/usr/bin/env python3
"""
generate_curriculum_migration.py

Phase 2 — turn the Mioshy curriculum CSV into an idempotent SQL
migration that seeds 250 structured lessons into journey_programs /
journey_categories / journey_items (with the migration-077 lesson
blocks).

Why a Python generator (not a TS importer):
  - No new npm deps (csv-parse, tsx).
  - Migration replays through Itzik's existing pipeline.
  - 250 rows of static data live in a SQL file under git, reviewable.
  - Re-run after CSV edits: `python3 scripts/generate_curriculum_migration.py`.

Usage:
  python3 scripts/generate_curriculum_migration.py [<csv-path>]

Default CSV path: ~/Library/.../uploads/מסע-זוגיות-מערכת-תוכן - מסע זוגיות.csv
Output: supabase/migrations/078_seed_curriculum_content.sql

Idempotency:
  - journey_programs upsert ON CONFLICT (slug)
  - journey_items upsert ON CONFLICT (category_id, slug)
  - Slugs are deterministic: csv-s{stage}-{cat}-{nnn}
  - Categories left in place (seeded in migration 055)
  - We never DELETE — items removed from the CSV stay in the DB
"""

from __future__ import annotations
import csv
import os
import sys

CATEGORY_BY_HE: dict[str, str] = {
    "תקשורת זוגית":               "communication",
    "מיניות ואינטימיות":          "intimacy",
    "אהבה וחיבור רגשי":           "emotional_connection",
    "חברות ושותפות יומיומית":     "friendship",
    "משפחה, הורות ולחצים חיצוניים": "family",
}

DEFAULT_CSV = os.path.expanduser(
    "~/Library/Application Support/Claude/local-agent-mode-sessions/"
    "c75c6be4-b9b1-4314-a6dc-4bf54779890e/479a3efd-bb4a-4e28-b228-1aadc0fddf91/"
    "local_4c1e457f-bfe1-4ef9-8260-12425184cfee/uploads/"
    "מסע-זוגיות-מערכת-תוכן - מסע זוגיות.csv"
)
DEFAULT_OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "supabase",
    "migrations",
    "078_seed_curriculum_content.sql",
)


def sql_str(s: str | None) -> str:
    """PG dollar-quoted literal — handles Hebrew + apostrophes safely."""
    if s is None:
        return "NULL"
    s = (s or "").strip()
    if not s:
        return "NULL"
    if "$b$" in s:
        # Extremely rare collision — fall back to standard escape.
        return "'" + s.replace("'", "''") + "'"
    return f"$b${s}$b$"


def slug_for(stage: int, num: str, cat_slug: str) -> str:
    return f"csv-s{stage}-{cat_slug}-{int(num):03d}"


def main() -> int:
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    if not os.path.exists(csv_path):
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        return 1

    out_path = DEFAULT_OUT

    with open(csv_path, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    valid: list[tuple[str, int, str, str, str, dict]] = []
    errors: list[str] = []
    for r in rows:
        num    = (r.get("#") or "").strip()
        stage  = (r.get("שלב") or "").strip()
        cat_he = (r.get("קטגוריה") or "").strip()
        title  = (r.get("כותרת") or "").strip()
        if not (num and stage and cat_he and title):
            continue
        cat_slug = CATEGORY_BY_HE.get(cat_he)
        if not cat_slug:
            errors.append(f"Row {num}: unknown category {cat_he!r}")
            continue
        try:
            st = int(stage)
        except ValueError:
            errors.append(f"Row {num}: bad stage {stage!r}")
            continue
        valid.append((num, st, cat_he, cat_slug, title, r))

    if errors:
        print(f"WARNING: {len(errors)} row errors", file=sys.stderr)
        for e in errors[:20]:
            print(f"  {e}", file=sys.stderr)

    print(f"Valid rows: {len(valid)}", file=sys.stderr)

    with open(out_path, "w", encoding="utf-8") as out:
        out.write(HEADER)
        for (num, stage, cat_he, cat_slug, title, r) in valid:
            slug       = slug_for(stage, num, cat_slug)
            sort_order = stage * 10000 + int(num)
            out.write(
                ITEM_TEMPLATE.format(
                    num        = num,
                    stage      = stage,
                    cat_he     = cat_he,
                    title      = title,
                    cat_slug   = cat_slug,
                    slug       = slug,
                    title_sql  = sql_str(title),
                    body       = sql_str(r.get("תוכן מלא (~500 מילים)") or title),
                    task       = sql_str(r.get("שאלה / תרגיל")),
                    sort_order = sort_order,
                    src        = sql_str(r.get("מקור (ספר/חוקר)")),
                    insight    = sql_str(r.get("תובנת מומחים")),
                    mistakes   = sql_str(r.get("טעויות שכיחות")),
                    metaphor   = sql_str(r.get("מטאפורה")),
                    measurement= sql_str(r.get("תצפית / מדידה")),
                    do_w       = sql_str(r.get("מה לעשות השבוע")),
                    dont_w     = sql_str(r.get("מה לא לעשות השבוע")),
                    progress   = sql_str(r.get("סימן להתקדמות")),
                )
            )
        out.write(FOOTER)

    size = os.path.getsize(out_path)
    print(f"Wrote {out_path} ({size // 1024} KB)", file=sys.stderr)
    return 0


HEADER = """-- 078_seed_curriculum_content.sql
--
-- Phase 2 — bulk seed of the 250-row Mioshy curriculum from the CSV
-- 'מסע-זוגיות-מערכת-תוכן' onto journey_programs / journey_categories /
-- journey_items. Generated by scripts/generate_curriculum_migration.py;
-- regenerate after CSV edits and replay to update content in place.
--
-- Idempotent — uses ON CONFLICT (category_id, slug) DO UPDATE so
-- re-running adopts the latest CSV without duplicating rows. Items in
-- the database whose slug isn't in the CSV are LEFT UNTOUCHED — this
-- script never deletes.
--
-- Strategy:
--   1. Ensure program 'ha-masa-ha-shalem' (המסע השלם) exists.
--   2. Bind the 5 priority categories (communication / intimacy /
--      emotional_connection / friendship / family) to the program if
--      they're currently program-less.
--   3. UPSERT 250 lessons keyed on (category_id, slug). Slugs are
--      deterministic (csv-s{stage}-{cat}-{nnn}) so re-runs hit the
--      same rows.
--
-- All lesson blocks (insight / mistakes / metaphor / measurement /
-- do / don't / progress / source) populated from migration 077's
-- new columns.

BEGIN;

-- ── 1. Program ───────────────────────────────────────────────────
INSERT INTO public.journey_programs (
  slug, name_he, name_en, description_he, description_en,
  default_anchor, is_active, sort_weight
) VALUES (
  'ha-masa-ha-shalem',
  $b$המסע השלם$b$,
  $b$The Full Journey$b$,
  $b$תוכנית הליווי המלאה של מיאושי — ארבעה שלבים, חמש קטגוריות, 250 שיעורים מובנים. מבוסס על מחקר של גוטמן, צ׳פמן, פרל, סו ג׳ונסון ועוד.$b$,
  $b$The full Mioshy coaching program — four stages, five categories, 250 structured lessons. Grounded in research from Gottman, Chapman, Perel, Sue Johnson and others.$b$,
  'purchase', true, 100
)
ON CONFLICT (slug) DO UPDATE SET
  name_he      = EXCLUDED.name_he,
  name_en      = EXCLUDED.name_en,
  description_he = EXCLUDED.description_he,
  description_en = EXCLUDED.description_en,
  is_active    = true,
  updated_at   = now();

-- ── 2. Bind the 5 priority categories to this program (only if NULL) ──
UPDATE public.journey_categories c
SET program_id = (SELECT id FROM public.journey_programs WHERE slug = 'ha-masa-ha-shalem')
WHERE c.program_id IS NULL
  AND c.assessment_priority_key IN ('communication','intimacy','emotional_connection','friendship','family');

-- ── 3. Resolve category ids into a CTE for the upsert below ──────
"""

ITEM_TEMPLATE = """
-- Row #{num}: שלב {stage} · {cat_he} · {title}
INSERT INTO public.journey_items (
  category_id, slug, title_he, body_he, task_he,
  sort_order, default_offset_days, is_active, audience,
  stage, source_attribution_he, source_attribution_en,
  expert_insight_he, common_mistakes_he, metaphor_he,
  measurement_he, do_this_week_he, dont_this_week_he, progress_marker_he
) VALUES (
  (SELECT id FROM public.journey_categories WHERE assessment_priority_key = '{cat_slug}' LIMIT 1),
  '{slug}',
  {title_sql},
  {body},
  {task},
  {sort_order}, 0, true, 'both',
  {stage},
  {src}, {src},
  {insight}, {mistakes}, {metaphor},
  {measurement}, {do_w}, {dont_w}, {progress}
)
ON CONFLICT (category_id, slug) DO UPDATE SET
  title_he              = EXCLUDED.title_he,
  body_he               = EXCLUDED.body_he,
  task_he               = EXCLUDED.task_he,
  sort_order            = EXCLUDED.sort_order,
  is_active             = true,
  audience              = EXCLUDED.audience,
  stage                 = EXCLUDED.stage,
  source_attribution_he = EXCLUDED.source_attribution_he,
  source_attribution_en = EXCLUDED.source_attribution_en,
  expert_insight_he     = EXCLUDED.expert_insight_he,
  common_mistakes_he    = EXCLUDED.common_mistakes_he,
  metaphor_he           = EXCLUDED.metaphor_he,
  measurement_he        = EXCLUDED.measurement_he,
  do_this_week_he       = EXCLUDED.do_this_week_he,
  dont_this_week_he     = EXCLUDED.dont_this_week_he,
  progress_marker_he    = EXCLUDED.progress_marker_he,
  updated_at            = now();
"""

FOOTER = """
COMMIT;

NOTIFY pgrst, 'reload schema';
"""


if __name__ == "__main__":
    sys.exit(main())
