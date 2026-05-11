# Journey FU6 — Implementation Plan & Spec

**Date:** 2026-05-08
**Status:** Approved by Itzik, in implementation
**Migrations:** All staged, run at the end (075 + 076)

---

## Scope

Five steps. The first is new (admin expert-message tracker). The other four close known gaps.

| # | Step | Migration? | Risk | ~Time |
|---|---|---|---|---|
| 1 | Admin expert-messages tracker | 075 | Low | 1 day |
| 2 | Email wiring for d1/d2 reminders | None | Low | 2h |
| 3 | View-as full read substitution on /my/journey | None | Medium | 4h |
| 4 | Anniversary backfill | 076 | Low | 1h |
| 5 | "Your story so far" narrative | None | Low | 3h |

Total: ~1.5–2 days.

---

## Step 1 — Admin: Expert Messages Tracker

### Why
Today there's no surface where an admin can see, across the whole platform, what messages experts are sending. Useful for:
- Monitoring coach quality (response patterns, sentiment hints)
- Spotting trending topics across couples ("conflict" is up 30% this month)
- Distribution oversight (one coach handling 80% of messages → workload imbalance)

### Scope (V1)
- One admin-only page `/dashboard/journey/expert-messages`
- Lists every expert message from `journey_messages` + `journey_couple_channel_messages`
- Filters: coach, couple, date range, topic tag
- Top stats: this week / this month / per-coach top-5

### Schema (Migration 075)
- `journey_messages.topic_tags TEXT[] DEFAULT '{}'`
- `journey_couple_channel_messages.topic_tags TEXT[] DEFAULT '{}'`
- GIN indexes on both columns for efficient tag filtering

### Wiring
- When coach inserts from `journey_expert_library` → copy `tags` from library row onto the new message
- Same for `journey_starter_templates` clones (carries through coach library to message)
- Pre-existing messages: `topic_tags` defaults to empty array — no backfill required, the UI just shows "untagged" for them

### Files touched
- `supabase/migrations/075_message_topic_tags.sql` (new)
- `lib/journey/admin-messages.ts` (new — read helper with batched lookups)
- `app/dashboard/journey/expert-messages/page.tsx` (new — admin page)
- `components/dashboard/journey/ExpertMessagesView.tsx` (new — list + filters client component)
- `app/actions/journey-messages.ts` (modify — stamp topic_tags on insert)
- `app/actions/journey-couple-channel.ts` (modify — same)

### Out of scope (defer)
- Sentiment analysis on message text (V3 — needs classifier)
- Auto-topic extraction from body (V3 — needs LLM or NLP)
- Time-to-reply metrics per couple (V2 follow-up)

---

## Step 2 — Email wiring for d1/d2 reminders

### Why
Today the d1/d2 reminders write a row to `journey_reminder_log` with `channel='in_app'` but no email is sent. Activation lift requires actual email.

### Scope
- In `app/api/journey/d1-reminders/route.ts`: after successful log insert, call existing email helper
- Use the same email infrastructure as `notifyOnReminderInactivity` (which is already wired)
- `channel` becomes `'email'` for these rows

### Files touched
- `app/api/journey/d1-reminders/route.ts` (modify — add email send)

### No migration.

### Risks
- Email service rate limits: cap batch at 100 sends per cron run (current cron already limits to 500 candidates).
- User has unsubscribed: respect existing `marketing_unsubscribed_at` flag — but reminders are **transactional**, not marketing. We'll honor a separate `journey_reminders_disabled` flag if it exists; otherwise send.

---

## Step 3 — View-as full read substitution on /my/journey

### Why
View-as today writes an audit row + shows a banner, but the page still reads `auth.uid()` data — so the coach sees their OWN dashboard with a banner, not the user's.

### Scope
- `/my/journey/page.tsx`: introduce `effectiveUserId = viewAsContext?.viewedUserId ?? user.id`
- Replace `user.id` with `effectiveUserId` everywhere in **read paths**
- Writes (markFirstSessionCompleted, kickoff cards, etc.) keep `auth.uid()` — coach can't accidentally write as the user
- Apply the same pattern to `/my/journey/together/page.tsx` and `/journey/timeline/[scheduledId]/page.tsx`

### Files touched
- `app/[locale]/my/journey/page.tsx` (modify ~30 occurrences of `user.id`)
- `app/[locale]/my/journey/together/page.tsx` (modify ~5)
- `app/[locale]/journey/timeline/[scheduledId]/page.tsx` (modify ~5)

### No migration.

### Risks
- Easy to miss a `user.id` reference and have mixed data. Mitigation: search-and-verify before commit. Also: the banner makes the impersonation observable — a partial substitution surfaces visually as "wait this isn't her timeline."

---

## Step 4 — Anniversary backfill

### Why
Migration 072 set `couples.started_journey_at = couples.created_at` for all existing rows. For couples that purchased Journey *after* couple creation, this gives them an early (wrong) anniversary date.

### Scope (Migration 076)
- For each couple with an existing `journey_assignments` row of `origin='purchase'`, set `started_journey_at` to that assignment's `anchor_date` (which is the purchase date).
- Idempotent: only updates rows where `started_journey_at < anchor_date` (i.e., where backfill was wrong).

### Files touched
- `supabase/migrations/076_couple_anniversary_backfill.sql` (new)

### No code changes.

---

## Step 5 — "Your story so far" narrative

### Why
Deferred from Layer 4. At 10 completed items, the user gets a milestone reveal but no retrospective. The architecture doc proposes an auto-generated narrative from completed item titles + reflections.

### Scope (V1 — slot-filling, no LLM)
- New helper `generateCoupleStoryNarrative(coupleId)` in `lib/journey/story-narrative.ts`
- Pulls last 10 completed items + their `journey_item_responses` (truncated to 1 line each)
- Templated paragraph: "You worked on X, then Y, then Z. Along the way you wrote: [excerpt]. Now: 10 steps in."
- Surfaces as a new card on `/my/journey` ONLY when 10+ items completed AND not yet dismissed
- New table: `journey_story_dismissals (couple_id, dismissed_at)` — single row per couple

Wait — actually we can reuse `journey_milestones` for this. The `ten_items` milestone already fires at 10 completions. The reveal modal can have a "Read our story" button → opens this narrative inline.

### Simplified scope
- No new schema. Use existing `journey_milestones` row for `ten_items` as the anchor.
- New component `<StoryReveal isHe={isHe} narrative={...}/>` rendered when the user clicks "Read our story" inside the milestone modal.
- New helper builds the narrative text on demand.

### Files touched
- `lib/journey/story-narrative.ts` (new)
- `components/my/StoryReveal.tsx` (new)
- `components/my/MilestoneRevealModal.tsx` (modify — add "Read our story" CTA for 10/20 milestones)

### No migration.

---

## Order of operations

1. Write all spec + plan doc ✅ (this file)
2. Step 1 — admin expert messages (build first, biggest impact)
3. Step 2 — email wiring (quick, unblocks retention)
4. Step 3 — view-as substitution (quick, unblocks coach QA)
5. Step 4 — anniversary backfill (just a SQL UPDATE)
6. Step 5 — story narrative (last, polish)
7. Verify every file parses cleanly
8. Hand off both migrations to Itzik (075 + 076) along with `pnpm build` instruction

---

## Migration safety

Both new migrations are idempotent and additive:
- 075: `ADD COLUMN IF NOT EXISTS` on two tables + GIN indexes with `IF NOT EXISTS`
- 076: `UPDATE ... WHERE started_journey_at < anchor_date` — re-runs are safe, just no-ops

If 075 partially ran from a prior attempt, the `IF NOT EXISTS` clauses skip cleanly.

---

## Definition of done

- All 5 steps shipped + parse-clean.
- Migrations 075 + 076 saved as files, NOT executed by me.
- Itzik runs migrations + `pnpm build`.
- Manual smoke test: admin sees expert-messages page, d1 reminder triggers email, view-as actually shows the user's data, anniversary dates correct, 10-item milestone offers "Read our story."
- Anything that fails reported with line/file for a quick fix.
