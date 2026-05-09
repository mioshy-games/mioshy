# Journey Phase 1+2 — Handoff: Lesson Schema + 250-Row Curriculum

**Date:** 2026-05-08
**Status:** Code shipped, migrations staged. Awaiting Itzik's run.

---

## What was built

Phase 1 — turn `journey_items` from "post" into "lesson":
- Migration 077 — 9 lesson-block columns + `stage` on `journey_items`
- Types + Zod validation extended
- Admin form `/dashboard/journey/items/[id]` — 7 new sections
- New `LessonView` component renders structured lesson on `/journey/timeline/[scheduledId]`
- Source attribution footer for legal/credit

Phase 2 — bulk import:
- 250-row curriculum CSV (תקשורת / מיניות / אהבה / חברות / משפחה × 4 stages)
- Generated as SQL migration 078 (no new npm deps)
- Idempotent — re-runnable after CSV edits
- Python generator at `scripts/generate_curriculum_migration.py` for re-runs

---

## Migrations to run (in order)

```bash
# 077 — schema for lesson blocks
psql … -f supabase/migrations/077_journey_lesson_blocks.sql

# 078 — bulk seed of 250 lessons
psql … -f supabase/migrations/078_seed_curriculum_content.sql
```

Both idempotent. After running, `pnpm build` to refresh Supabase types.

---

## What the user sees on a lesson now

Before (legacy "post"):
```
Title
[long body of text]
[task callout]
[challenge callout]
```

After (Phase 1 "lesson"):
```
Title
————
✨ THE INSIGHT             ← expert_insight_he (~80-150 words)
[opening framing]

⚠️  COMMON MISTAKE         ← common_mistakes_he
[what most couples get wrong]

" כמו...                   ← metaphor_he (italic, accent border)
  [visual anchor]

📖 THE FULL ARTICLE        ← body_he (~500 words)
[deep dive]

🎯 THIS WEEK'S EXERCISE    ← task_he (wine-accent prominent card)
[the climax — call to action]

📊 WHAT TO MEASURE          ← measurement_he
[observation prompt]

✅ DO THIS WEEK | ❌ NOT THIS WEEK   ← do/dont (paired green/rose cards)

✨ SIGN IT'S WORKING       ← progress_marker_he (gold accent)

—— Based on the work of Gottman — Mioshy interpretation
```

Each block conditional — items with empty blocks render only the
populated parts. Legacy items render through the existing
`ItemDetailClient` path unchanged.

---

## Files added (4)

- `supabase/migrations/077_journey_lesson_blocks.sql` — schema
- `supabase/migrations/078_seed_curriculum_content.sql` — 250-row seed (679 KB, generated)
- `components/journey/timeline/LessonView.tsx` — new structured renderer
- `scripts/generate_curriculum_migration.py` — re-runnable generator

## Files modified (5)

- `lib/journey-content/types.ts` — `JourneyItem` extended
- `lib/journey-content/validations.ts` — `journeyItemSchema` extended
- `app/dashboard/actions/journey-content.ts` — save action handles new fields
- `components/dashboard/journey/ItemForm.tsx` — 7 new sections
- `app/dashboard/journey/items/[id]/page.tsx` — defaults populate new fields
- `components/journey/timeline/ItemDetailClient.tsx` — `hideContent` prop
- `app/[locale]/journey/timeline/[scheduledId]/page.tsx` — mount LessonView

---

## CSV → schema mapping

| CSV column | DB column | Notes |
|---|---|---|
| `#` | (used in slug) | `csv-s{stage}-{cat}-{nnn}` |
| `שלב` | `stage` SMALLINT | 1-4 |
| `קטגוריה` | `category_id` (resolved) | by `assessment_priority_key` |
| `כותרת` | `title_he` | |
| `מקור (ספר/חוקר)` | `source_attribution_he/en` | foot of lesson |
| `תובנת מומחים` | `expert_insight_he` | opening block |
| `טעויות שכיחות` | `common_mistakes_he` | warning card |
| `מטאפורה` | `metaphor_he` | italic quote |
| `שאלה / תרגיל` | `task_he` (existing) | exercise card |
| `תצפית / מדידה` | `measurement_he` | observation prompt |
| `תוכן מלא (~500 מילים)` | `body_he` | main article |
| `מה לעשות השבוע` | `do_this_week_he` | green card |
| `מה לא לעשות השבוע` | `dont_this_week_he` | rose card |
| `סימן להתקדמות` | `progress_marker_he` | gold-accent footer |

---

## Manual test plan

### After migration 077 + 078 run:

1. **Item count check**
   ```sql
   SELECT stage, count(*)
   FROM journey_items
   WHERE stage IS NOT NULL
   GROUP BY stage ORDER BY stage;
   ```
   Expected: stage 1 = 50, stage 2 = 75, stage 3 = 75, stage 4 = 50.

2. **Category check**
   ```sql
   SELECT c.assessment_priority_key, count(i.id)
   FROM journey_categories c
   LEFT JOIN journey_items i ON i.category_id = c.id AND i.stage IS NOT NULL
   WHERE c.assessment_priority_key IN ('communication','intimacy','emotional_connection','friendship','family')
   GROUP BY 1;
   ```
   Expected: 50 per category × 5 categories = 250.

3. **Source attribution sanity**
   ```sql
   SELECT count(*) FROM journey_items
   WHERE source_attribution_he IS NOT NULL;
   ```
   Expected: 250 (every CSV row has a source).

4. **Admin UI check** — open `/dashboard/journey/items/<any-id>`,
   confirm 7 new sections render with content from the CSV. Edit
   any field, save, refresh — change persists.

5. **User UI check** — assign a couple to the program (or visit
   an existing assignment that already has a row from this catalog)
   and open `/he/journey/timeline/<scheduledId>`. Confirm:
   - Insight section shows
   - Mistake card shows (amber)
   - Metaphor renders italic
   - Body shows
   - Exercise stands out as the wine-accented CTA
   - Measurement / Do / Don't / Progress marker all render
   - Source line appears at the foot

6. **Re-run migration 078** — should be a no-op, every row UPDATEd
   with no errors. Verify count stays at 250.

7. **CSV edit cycle** — edit any row in the CSV → run
   `python3 scripts/generate_curriculum_migration.py` → run
   migration 078 again → confirm the change is in the DB.

---

## Edge cases handled

- **Existing legacy items** (pre-077) have NULL lesson blocks; they
  render through the legacy `ItemDetailClient` path with body/task/
  challenge as before. No regression.
- **Empty source** — the source footer just doesn't render. (No CSV
  rows have empty source today, but the code handles it.)
- **Hebrew apostrophes / dollar signs** — dollar-quoted strings
  (`$b$...$b$`) handle them safely. Generator falls back to escape
  doubling if `$b$` ever appears in content (it doesn't today).
- **Category program binding** — the 5 priority categories were
  program-less by default (migration 055). Migration 078 binds
  them to `המסע השלם` only if currently NULL — never overwrites.

---

## Definition of done

- ✅ All schema + UI changes shipped
- ✅ 250 lessons generated cleanly (250 INSERTs in migration 078)
- ✅ TypeScript clean (`npx tsc --noEmit`)
- ✅ Generator script saved + documented
- ⏳ Itzik runs migrations 077 + 078 + `pnpm build`
- ⏳ Manual smoke per the plan above
- ⏳ Anything that fails reported with line/file for a quick fix

---

## What's next (pending Itzik approval)

Phase 3 — cross-system metrics dashboard for admin
Phase 4 — AI recommendations (auto-tag, smart suggestions, drift triggers)
Phase 5 — visual assessment builder for the admin

Plus the standing items: Yael copy review (CP6), VAT verification, Google OAuth.
