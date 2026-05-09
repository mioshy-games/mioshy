# Journey Phase 3 + 4 — Handoff: Metrics + AI Recommendations

**Date:** 2026-05-09
**Status:** Code shipped, migration 079 staged. Awaiting Itzik's run.

---

## What was built

### Phase 3 — Cross-system metrics dashboard
- `lib/journey/metrics.ts` — 5 KPI helpers (kpis / coach load / category heat / stage funnel / alerts) + getUrgentUserMessages
- `/dashboard/journey/metrics` — single-screen admin page
- Hub link added to `/dashboard/journey`

### Phase 4 — AI message classification + smart suggestions
- Migration 079 — `sentiment` + `auto_tags` columns on both message tables
- `lib/ai/classify-message.ts` — Claude Haiku classifier (direct fetch, no SDK dep)
- Hooked into 3 user-message actions (per-item, channel, couple) as fire-and-forget
- "Concerning + urgent" panel on metrics dashboard
- `lib/journey/coach-suggestions.ts` + `SmartSuggestionsPanel` — 3 next-item suggestions for coach per couple

---

## Migration to run

```bash
psql … -f supabase/migrations/079_message_ai_enrichment.sql
```

After: `pnpm build` to refresh Supabase types.

**Phase 3 has no migration.** Pure code change.

---

## New env var required

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without this, the classifier silently returns null — message persistence still works, but `sentiment` and `auto_tags` stay NULL/empty. Set it in Vercel project settings + local `.env.local`.

**Optional**: `ANTHROPIC_MODEL` — defaults to `claude-haiku-4-5-20251001`. Override only if you want to test with Sonnet.

---

## What the admin sees

### `/dashboard/journey/metrics`

**Top KPIs (4 cards)**: active owners · completion rate (30d) · avg reply time · drifting count

**Second row (3 cards)**: expert messages (7d) · completions (7d) · completions (30d)

**Coach load (top 10)**: per-coach active couples + 30d messages + open thread queue (unanswered user messages). Destructive badge when >5 open.

**Stage funnel**: distinct owners reached at each stage (1-4) plus catalog size per stage.

**Category heat**: completions per category, last 7d vs prior 7d, with WoW % delta + trend chip.

**Concerning + urgent user messages** (Phase 4): real-time list of user messages auto-classified as `urgent` or `concerning` by Claude Haiku. Each row shows the couple, sentiment chip, auto-tags, and a body preview. Empty until the classifier has tagged some recent rows.

**Attention list (Phase 3)**: drift cohorts + items with negative feedback.

### `/dashboard/my-clients/[coupleId]`

New **Smart Suggestions panel** above the assignment form. Three next-best item picks for this couple, scored by:
- priority match (top priority = +50, descending by 10)
- stage match (current stage = +20, current+1 = +10)
- negative feedback penalty (-10 per negative rating, capped at -30)

Each suggestion shows score, stage, category, and a short rationale ("עדיפות #1 שלהם — תקשורת זוגית · בשלב הנוכחי (2)"). Clicking opens the item editor.

---

## How AI classification works

1. User posts a message anywhere (per-item / channel / couple).
2. The post action does its primary insert, returns success to the user.
3. **After** the insert, `void classifyAndStampMessage(...)` is called as fire-and-forget. The user does NOT wait for the LLM.
4. The classifier runs ~1s, then UPDATEs the row with `sentiment` + `auto_tags`.
5. Failures (no API key / network / invalid JSON) silently log a warning. Message is still persisted with NULL sentiment.

**Tag vocabulary** (12 fixed): `communication`, `intimacy`, `emotional_connection`, `friendship`, `family`, `conflict`, `appreciation`, `stuck`, `win`, `question`, `request_for_help`, `exercise_feedback`. Anything outside this list is dropped — keeps aggregation predictable.

**Sentiment vocabulary** (4 fixed): `positive`, `neutral`, `concerning`, `urgent`. The metrics dashboard surfaces only `urgent` + `concerning`.

**Privacy note**: classification uses message body text only. No user PII is sent. The only identifier the LLM sees is the message body itself.

---

## Files added (Phase 3 + 4)

- `lib/journey/metrics.ts` (Phase 3 + 4)
- `lib/ai/classify-message.ts` (Phase 4)
- `lib/journey/coach-suggestions.ts` (Phase 4)
- `app/dashboard/journey/metrics/page.tsx` (Phase 3)
- `components/dashboard/coach/SmartSuggestionsPanel.tsx` (Phase 4)
- `supabase/migrations/079_message_ai_enrichment.sql` (Phase 4)

## Files modified

- `app/dashboard/journey/page.tsx` — link to metrics
- `app/actions/journey-messages.ts` — fire classifier on user posts (×2 sites)
- `app/actions/journey-couple-channel.ts` — fire classifier on partner post
- `lib/journey/admin-messages.ts` — extended row type with auto_tags + sentiment
- `app/dashboard/my-clients/[coupleId]/page.tsx` — mount SmartSuggestionsPanel

---

## Manual test plan

### Phase 3 (no migration needed)
1. Visit `/dashboard/journey/metrics` as admin → all sections render.
2. KPIs reflect real data; values can be 0 on a fresh DB.
3. Coach load shows top 10 by activity.
4. Category heat renders all 5 priority categories.
5. Stage funnel shows 4 rows (stages 1-4) with catalog sizes from migration 078.

### Phase 4
After running migration 079 + setting ANTHROPIC_API_KEY:

1. As a Journey user, post a clearly emotional message ("אני מרגיש מנותק לגמרי, לא יודע מה לעשות").
2. Wait ~3-5s, then check the row in DB:
   ```sql
   SELECT id, sentiment, auto_tags, body
   FROM journey_messages
   WHERE author_kind = 'user'
   ORDER BY created_at DESC LIMIT 5;
   ```
   Expected: sentiment populated (likely "concerning"), auto_tags has 1-3 entries.
3. Visit `/dashboard/journey/metrics` — the "Concerning + urgent" panel should now list the message.
4. Visit `/dashboard/my-clients/<some-couple-id>` — Smart Suggestions panel renders 3 picks (or "no data yet" if the couple has no completions / priorities).
5. Negative test: unset `ANTHROPIC_API_KEY`, post another user message. Server logs warn "ANTHROPIC_API_KEY missing — skipping" but the message saves fine. `sentiment` stays NULL.

### Re-run safety
Migration 079 is idempotent. Re-running causes no row changes.

---

## What's NOT in V1 (deferred)

- **Backfill of pre-Phase-4 messages**: existing messages stay NULL for sentiment. A separate backfill job can be written if desired (would burn ~1 LLM call per message).
- **LLM-driven smart suggestions**: V1 uses heuristics only. V2 could add an LLM pass that synthesizes the couple's state into a sentence rationale ("This couple is stuck on conflict patterns; suggest item X").
- **Auto-tag coach messages**: only USER messages are classified. Coach messages stay clean — the admin tracker uses `topic_tags` (admin-stamped from library), which is intentional.
- **Cohort retention curves**: deferred to V2. Current dashboard is point-in-time.

---

## Definition of done

- ✅ Phase 3 page + helpers shipped
- ✅ Phase 4 migration 079 written
- ✅ Classifier + actions + UI panels shipped
- ✅ TypeScript clean (`npx tsc --noEmit`)
- ⏳ Itzik runs migration 079 + sets ANTHROPIC_API_KEY + `pnpm build`
- ⏳ Manual smoke per the plan above

---

## What's next (pending Itzik approval)

- Phase 5 — visual assessment builder for the admin
- CP6 — Yael copy review
- VAT verification, Google OAuth (frozen)

Plus after AI is live and stable, V2 ideas:
- Cohort retention curves
- LLM-driven smart suggestions with sentence rationales
- Auto-tag backfill for legacy messages
