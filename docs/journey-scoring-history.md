# How journey scoring resolves — and where its history lives

Written 2026-08-13, after a six-week scoring defect that was invisible because
nobody knew the change history existed.

## The short version

A journey answer is scored against the axis that was correct **when the answer
was given**, not the axis on the question today. Two tables make that possible,
and a third is the reason it was needed.

| table | what it is | who reads it |
|---|---|---|
| `journey_questions` | the question as it is **now** — what the questionnaire renders | the live flow, the admin editor |
| `journey_question_versions` | effective-dated **scoring** windows, `[valid_from, valid_to)` | `analyze()` via `buildVersionedQuestionResolver` |
| `journey_questions_history` | **every** edit ever made, written by a trigger | nobody automatically — it is the audit record |

## Why this exists

Seven questions were rewritten in July 2026 while their scoring axes stayed
pointed at the old meaning. The clearest case: `q11_contempt` was reworded in
Hebrew to ask *how often you express appreciation*, while still scoring onto
`four_horsemen_contempt`. The warmer a couple reported being, the worse their
result looked. It ran for six weeks.

The cause was structural, not careless. The admin editor had a "SCORING LOCK":
`he_text` was freely editable and `axes` was frozen. That reads as protecting
scoring integrity and does the opposite — text and axis could only ever diverge,
never re-converge. It is now replaced by **confirm-on-edit** (see
`app/dashboard/journey-questions/actions.ts`): changing displayed text requires
re-confirming the axis, opens a new version row, and records `updated_by`.

## `journey_questions_history` — read this before trusting `updated_at`

A `BEFORE UPDATE` trigger (`journey_questions_log_change`) inserts the **OLD**
row on every change to position, phase, type, domain, axes, reverse, he_text,
en_text, options, meta or is_active.

So a row `(changed_at = T, he_text = X)` means *"the text was X right up until
the edit at T"*. Windows are therefore:

```
[-infinity, T1) = X0      [T1, T2) = X1      ...      [Tn, ∞) = today's text
```

**This table is the source of truth for when a question's meaning changed.**
`journey_questions.updated_at` is the LAST edit, not the meaningful one, and
using it cost us a second defect: migration 196 built every version boundary
from `updated_at` and got two of them wrong, leaving 1,161 answers scored
against an era that had already ended. Migration 204 rebuilt them from this
table. Questions were edited up to six times; `q01_knowledge_world` alone has
six text versions and three distinct meanings.

Consecutive history rows often carry identical `he_text` — those are edits to
other fields and do **not** create a new meaning. Collapse them before deriving
windows.

`changed_by` is null for everything before 2026-08-13 because the trigger copies
`OLD.updated_by`, which the editor never wrote. That is why the July edits could
not be attributed to anyone. It is populated going forward.

## Two traps on `journey_questions`

**1. `updated_at` cannot be set explicitly.** A second `BEFORE UPDATE` trigger,
`journey_questions_touch_updated_at`, overwrites it with `now()` on *every*
update. An explicit `updated_at = <value>` in your `SET` clause is silently
discarded. Since version boundaries were derived from those timestamps, an
innocent update destroys evidence. Disable the trigger around the statement if
you need to preserve or restore them:

```sql
ALTER TABLE public.journey_questions DISABLE TRIGGER journey_questions_touch_updated_at_trigger;
-- your UPDATE
ALTER TABLE public.journey_questions ENABLE TRIGGER journey_questions_touch_updated_at_trigger;
```

**2. `axes` must stay in step with the open version.** `journey_questions.axes`
is the resolver's fallback when the version read fails, and it is what the admin
UI displays. If it disagrees with the open version row, a failed read scores
everyone the old way and the next admin edit is made on wrong information.
Migration 202 synced them; keep them synced.

## Adding or changing a question

- **New question** → new slug, always. Never repurpose an existing row: that is
  precisely what let a question's meaning change while its history kept pointing
  at the old one.
- **Rewording an existing question** → go through the admin editor so
  confirm-on-edit opens a version row. A direct SQL update will not.
- **Changing an axis** → CSV import or an explicit migration, and add the version
  row yourself.

## Verifying a change

Two scripts, both read-only:

- `scripts/journey-boundary-gate.ts` — the split gate. **A.** answers predating
  any edit to their question must not drift. **B.** answers whose era changed
  must drift, to the axis the history predicts. A single "nothing may drift"
  gate cannot test a boundary correction: when a boundary moves, some answers
  are *supposed* to change.
- `scripts/journey-axis-verify-prod.ts` — the five category scores for a real
  journey, and the distribution of the shift.

## Instrument changes break comparability

Scores from before **2026-08-13T09:18:53Z** and after are not measurements of
the same thing. `ScoreEvolutionChart` withholds its delta arrow when the two
compared measurements straddle that instant, because the arrow is what reads as
a change in the relationship. If the instrument changes again, add the new
boundary there.
