# Journey FU6 — Handoff & Manual Test Plan

**Date:** 2026-05-08
**Status:** Code shipped, migrations staged. Awaiting Itzik's run.

---

## What was built

Five steps from `journey-fu6-implementation-plan.md`, all code-clean
(`npx tsc --noEmit` passes).

| # | Step | Migration | Files touched |
|---|---|---|---|
| 1 | Admin expert-messages tracker | 075 | 5 new + 2 modified |
| 2 | Email wiring for d1/d2 reminders | None | 1 modified |
| 3 | View-as full read substitution | None | 3 modified |
| 4 | Anniversary backfill | 076 | 1 new |
| 5 | "Your story so far" narrative | None | 2 new + 2 modified |

---

## Migrations to run (in order)

Both are idempotent and additive — re-running is safe.

```bash
# Step 1 — adds topic_tags TEXT[] to two tables + GIN indexes.
psql … -f supabase/migrations/075_message_topic_tags.sql

# Step 4 — corrects couples.started_journey_at for couples that
# bought Journey after couple creation.
psql … -f supabase/migrations/076_couple_anniversary_backfill.sql
```

After both: run `pnpm build` to confirm the typed Supabase client
sees the new columns.

---

## Files added (10 total)

### Step 1 — Admin expert-messages tracker
- `supabase/migrations/075_message_topic_tags.sql`
- `lib/journey/admin-messages.ts` — read helper + stats
- `app/dashboard/journey/expert-messages/page.tsx` — admin page
- `components/dashboard/journey/ExpertMessagesView.tsx` — filters + list

### Step 4 — Anniversary backfill
- `supabase/migrations/076_couple_anniversary_backfill.sql`

### Step 5 — Story narrative
- `lib/journey/story-narrative.ts` — templated builder
- `components/my/StoryReveal.tsx` — inline retrospective panel

### Doc
- `docs/journey-fu6-implementation-plan.md` — original spec
- `docs/journey-fu6-handoff-2026-05-08.md` — this doc

## Files modified

- `app/actions/journey-couple-channel.ts` — stamp `topic_tags` from library
- `app/actions/journey-messages.ts` — stamp `topic_tags` (channel + per-item)
- `app/api/journey/d1-reminders/route.ts` — wire Brevo email + flip `channel`
- `app/[locale]/my/journey/page.tsx` — view-as substitution + story narrative wiring
- `app/[locale]/my/journey/together/page.tsx` — view-as substitution + banner
- `app/[locale]/journey/timeline/[scheduledId]/page.tsx` — view-as substitution + banner + skip writes
- `app/dashboard/journey/page.tsx` — link the new admin page from the journey hub
- `components/my/MilestoneRevealModal.tsx` — "Read our story" CTA for ten/twenty milestones

---

## Manual test plan

### Step 1 — Admin expert-messages tracker

1. Sign in as admin → `/dashboard/journey/expert-messages`
2. Confirm: top stats show all-time / 7d / 30d totals.
3. Confirm: top coaches and top tags lists render. (May be empty
   on a fresh DB — that's fine; the "no expert activity yet" copy
   covers it.)
4. As coach, post a per-item reply using a saved-library snippet.
   Refresh the admin page — the new row should appear with the
   library's tags stamped on it.
5. Filter by coach → only their messages appear.
6. Filter by tag → only messages stamped with that tag appear.
7. Filter by "Untagged only" → rows with no tags (organic replies).
8. Click a couple-label → page reloads scoped to that couple.

### Step 2 — d1/d2 email reminders

Hard to E2E without waiting 24h, so verify by:

1. Manually `INSERT` a `journey_scheduled_items` row with
   `unlock_at = now() - interval '30h'`, `seen_at = NULL`,
   `has_unlock_override = true`.
2. Trigger the cron: `curl -H "Authorization: Bearer …" $URL/api/journey/d1-reminders`
3. Check the response: `{ d1_sent: 1, … }`.
4. Check `journey_reminder_log` — new row with `channel='email'`.
5. Check `journey_notifications` — row with `kind='reminder_inactivity'`.
6. Check Brevo dashboard — outgoing email logged.
7. Re-run the cron — should be a no-op (idempotency on
   composite-unique).

### Step 3 — View-as substitution

1. As a coach, find a client → click "View as user" → cookie set.
2. Visit `/he/my/journey` → should now show **the user's**
   timeline, channel, score history. Banner visible at top.
3. Confirm `markFirstSessionCompleted` is NOT called (the user's
   profile.journey_first_session_completed_at must not change).
4. Visit `/he/my/journey/together` → user's together page
   (their partner, their channel). Banner visible.
5. Visit `/he/journey/timeline/<scheduledId>` → user's item
   detail. Banner visible. `journey_activity_log` entry NOT
   created for this view.
6. Open the cookie's audit row → `ended_at` still null.
7. End view-as → page reverts to coach's own (empty) dashboard.

### Step 4 — Anniversary backfill

1. Run migration 076.
2. SQL spot check:
   ```sql
   SELECT
     c.id, c.created_at, c.started_journey_at,
     MIN(ja.anchor_date) AS first_purchase
   FROM couples c
   LEFT JOIN journey_assignments ja
     ON ja.couple_id = c.id AND ja.origin = 'purchase'
   GROUP BY c.id;
   ```
   Couples with a purchase after creation should now have
   `started_journey_at = first_purchase`.
3. Re-run 076 → no rows updated (idempotent).

### Step 5 — Story narrative

Tricky to E2E without simulating 10 completions. Easiest path:

1. Pick a couple that's already at 10+ completions.
2. SQL: `INSERT INTO journey_milestones (couple_id, slug)
   VALUES ('<couple_id>', 'ten_items') ON CONFLICT DO NOTHING;`
3. As that user, visit `/he/my/journey` → milestone modal opens.
4. Below the primary CTA, a secondary "קראו את הסיפור שלכם עד כה"
   button should be visible.
5. Click it → StoryReveal opens with: lead line, ordered list of
   item titles, optional excerpt, outro.
6. Click the close button → milestone is dismissed (per existing
   modal flow).
7. Refresh — modal does not reopen.

---

## Definition of done (FU6 completion)

- ✅ All 5 steps shipped.
- ✅ TypeScript clean (`npx tsc --noEmit`).
- ✅ Migrations 075 + 076 saved as files.
- ⏳ Itzik runs both migrations + `pnpm build`.
- ⏳ Manual smoke per the plan above.
- ⏳ Anything that fails reported with line/file for a quick fix.

---

## Pending after FU6

Tracked separately, not part of this slice:

- Yael (or human) copy review of all user-facing strings
- VAT verification with uxellent (post-deploy)
- Google OAuth (frozen, awaiting credentials)
