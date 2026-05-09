# Admin Cockpit — Specification

**Date:** 2026-05-09
**Status:** Spec for Itzik review (before implementation)
**Scope:** Single landing page at `/dashboard` for the platform admin

---

## Problem statement

Today the admin (`role='admin'`) lands on `/dashboard` and sees a games-stats table — `totalGames`, `totalQuestions`, `activeGames`. That's a leftover from when Mioshy was just a games product.

Now Mioshy runs five product lines + a coaching workflow + a content engine + an AI layer:
- Journey (the coaching product)
- Games — Wheels (Truth/Dare)
- Games — Snakes & Ladders
- Adults (mioshy-sex)
- Articles (blog)

And the admin is also the only coach in production, so they need a single screen that:
1. Tells them what needs their **immediate attention** (urgent messages, drift, SLA breaches)
2. Shows them **platform health** at a glance (subs, completion, retention)
3. Surfaces **content health** (catalog stats, recent feedback)
4. Lets them **navigate to any deep dashboard** with one click
5. Shows **recent activity** (signups, subs, system events)

---

## Page structure — 6 sections, top to bottom

### 1. Header — greeting + global pulse
```
שלום, איציק — 09/05/2026 | 14:23

[3] דחוף  [2] חרגו מ-SLA  [1] צריכים check-in  [8] threads פתוחים
```

A single ribbon that screams: "if you only had 30 seconds, look here."
Each chip is a clickable shortcut to the relevant deep view.

---

### 2. Action queue — admin-as-coach
"מה דורש ממך התייחסות עכשיו"

Embeds the existing **NeedsAttentionPanel** (Phase 7) showing urgent + concerning user messages, scoped to the couples linked to this admin.

If empty: "✓ הכל רגוע. כדאי לעבור על שגרות."

---

### 3. Platform health — KPI strip
4 cards, each clickable:

| KPI | Value | Source |
|---|---|---|
| Active Journey subscribers | 247 | journey_assignments WHERE is_active |
| Active Games subscribers | 89 | subscriptions WHERE product='games' AND status='active' |
| Total registered users | 1,432 | profiles |
| Revenue this month | ₪9,653 | invoices (post-VAT) |

Plus a smaller second row:
- Completion rate (30d): 68% — links to Journey metrics
- Avg reply time: 14h — links to Coach load
- Drift rate: 8% — links to my-clients drift list
- Active coaches: 1 (you) — links to /dashboard/experts

---

### 4. Content health — Journey
"בריאות התוכן"

| Metric | Value |
|---|---|
| Items in catalog | 250 (50/75/75/50 across 4 stages) |
| Programs | X active |
| Categories | 5 priority + Y standalone |
| Recent feedback (7d) | Z helpful / W not_for_us |
| Top performing item (7d) | "שפת האהבה שלי — ושלך" (12 completions) |
| Bottom performing item (7d) | "..." (3 negative ratings) |

Plus:
- Recent edits — last 5 items the admin changed (with timestamps)
- "Manage content →" links to /dashboard/journey/items

---

### 5. Navigation hub — every surface, organized
A grid of cards organized by category. Each card has:
- Icon + label
- 1-line description
- Optional badge with a count or status

**Coaching (admin-as-coach):**
- My Clients → "12 couples"
- Today's queue → "8 open threads"
- My Profile → "✓ complete" / "incomplete"
- My Library → "X saved replies"

**Journey content:**
- Items / Programs / Categories / Match rules / Feedback / Expert messages / Metrics

**Other products:**
- Wheels (games) → "5 games · 234 questions"
- Snakes & Ladders → "1 game"
- Adults → "X games"
- Articles → "5 published"

**Users + commerce:**
- Users overview / Leads / Subscriptions / Cardcom logs

**System:**
- Automation / Settings / Health / Templates

---

### 6.5. Global search bar — top-of-page

Sticky search at the top of the cockpit (just below the pulse ribbon). One input that searches across:
- **Couples** — by partner name or pair_code
- **Users** — by email, full name, mobile
- **Items** — by title (HE/EN), source (e.g., "Gottman"), tags
- **Subscriptions** — by user email or invoice id

Behavior:
- Debounced 250ms.
- Results grouped under headers ("3 couples · 7 users · 12 items").
- Click a result:
  - Couple → opens the couple console drawer (no navigation)
  - User → opens the user console drawer (a new variant — see Section 9)
  - Item → opens item editor in a drawer
  - Subscription → opens subscription detail drawer
- Power-key: `/` focuses the search.
- Recent searches saved in localStorage (last 10).

Implementation: client-side fuzzy match over data already fetched for the cockpit, plus a /api/admin/search endpoint for items/subscriptions which aren't in the initial payload (they're too large).

---

### 7. Couples roster + inline console

**The new section per Itzik's request — a list of all active couples, click one to see what they're getting + edit / approve / schedule from the same page (no navigation).**

#### Roster — left side, vertical list
Compact list of every active couple this admin manages. Each row shows:
- Partner names (e.g., "דנה & יוסי")
- Status chip: active / drifting / silent / paused
- Stage indicator: "שלב 2 · 7 פריטים הושלמו"
- Bell icon if there's an urgent/concerning message pending

Sort: by attention priority (urgent → drifting → SLA breached → newest activity → others).
Search bar at top. Filter chips: "all", "needs attention", "active", "paused".

#### Console — right side panel (slides in)
Click a couple → side drawer opens (90% page height, 40% width) **without navigating away**.

**Critical UX principle — "always-visible data"**:
- The cockpit's KPIs, pulse ribbon, and content health stay visible behind/beside the drawer.
- Drawer is 40% wide on desktop (60% available for cockpit data underneath).
- Drawer fades the cockpit slightly (opacity 0.6) — but doesn't hide it.
- ESC closes the drawer; drawer can also be pinned (toggle button) so it stays open while admin clicks between couples.
- On mobile (<768px): drawer is full-width but contains a "back to dashboard" pill.
- The drawer state lives in URL query (e.g., `/dashboard?couple=<uuid>&tab=now`) so deep-linking works and refresh preserves position.

The drawer has 4 tabs:

**Tab 1: עכשיו (Now)**
- Last 5 messages from the couple — preview + sentiment chip
- Currently scheduled items in the next 7 days, in chronological order:
  ```
  [12/05 09:00]  שיחת יום ראשון           ⏳ עוד 3 ימים
  [15/05 09:00]  הקשבה אקטיבית           ⏳ עוד 6 ימים
  ```
- Inline buttons per row:
  - **שנה תאריך** — date picker → updates `scheduled_items.unlock_at`
  - **דחה לעוד שבוע** — quick +7d
  - **הסר** — soft delete (sets `is_active=false`, doesn't touch the couple)

**Tab 2: דחוף עכשיו (Push now)**
Three sub-modes within the same tab — admin picks the source:

**Mode A — מהקטלוג (From catalog)**
- "Smart Suggestions" panel (existing Phase 4 logic) — 3 next-best items
- "Browse all" — search/select any item from the catalog (250 items)
- Each suggestion has:
  - **דחוף עכשיו** button → creates a scheduled_item with `unlock_at=now`, `source='admin_manual'`
  - **תזמן** button → date picker → schedule for a specific date
  - **ערוך עבור הזוג** → opens inline editor → saves as override

**Mode B — תוכן חד-פעמי (Ad-hoc / one-off content) — NEW**
For when no catalog item fits. Admin writes content from scratch for THIS couple, not added to the catalog.

Form (mirrors LessonView 9 blocks, all optional):
- כותרת *
- תובנת מומחים
- טעות שכיחה
- מטאפורה
- תוכן מלא *
- תרגיל / שאלה
- מה למדוד השבוע
- לעשות / לא לעשות
- סימן להתקדמות
- קטגוריה (dropdown — communication / intimacy / etc.)
- שלב (1-4)
- מקור (אופציונלי — אם מבוסס על מחקר)

Buttons:
- **דחוף עכשיו** — creates the item + schedules immediately
- **תזמן ל-DD/MM** — creates + schedules for date
- **שמור כטיוטה** — creates as `is_active=false`, can be picked up later

Schema mechanic:
- A new `journey_items` row gets created with `is_one_off=true` flag (new column on items, migration 080).
- Linked to ONE specific couple via `journey_couple_item_overrides` (the override IS the content for one-offs).
- It does NOT appear in the catalog browser, never gets auto-suggested for other couples.
- Admin can later "promote to catalog" if it turns out to be reusable.

**Mode C — מהספרייה האישית (From coach library)**
- Lists snippets from `journey_expert_library` (existing Phase 2 mechanism)
- Same push/schedule/edit options
- Useful for short coach replies, not full lessons

**Tab 3: היסטוריה (History)**
- Timeline of every item ever delivered to this couple
- Each row: title · stage · status (completed/skipped/open) · feedback rating
- Click row → expands to show user response + admin edit field
- Useful for cross-reference when picking the next item

**Tab 4: הגדרות (Settings)**
- Pause/resume subscription
- Track switch (primary/paused/archived)
- Couple-level notes (admin private)
- Send a message directly via couple channel

#### Approve gate — for AI-suggested content
When AI Smart Suggestions surfaces an item, the admin sees:
```
[item title]
מסיבה: עדיפות #1 שלהם — תקשורת זוגית · בשלב הנוכחי (2)

[ערוך לפני שליחה]   [דחוף עכשיו]   [תזמן ל-DD/MM]   [דחה]
```

"ערוך לפני שליחה" — opens an inline editor (re-uses LessonView fields) where the admin can tweak the body / exercise / etc. for THIS couple specifically. Saved as a couple-scoped override (new mechanic — see "Schema additions" below).

If admin doesn't intervene, AI suggestions never auto-fire — this is **suggest, not auto-push** by design.

---

### 6. Recent activity — last 24h feed
A simple chronological list:

```
14:21  💬 Couple "דנה & יוסי" sent an urgent message       [open]
13:42  ✓  User completed item "שפת האהבה" — communication
12:15  💳 New Journey subscription — דנה (1y trial)
11:08  📥 Lead form submission — michal@gmail.com
09:30  ⏰ d1-reminder cron sent 3 emails
08:45  🔄 weekly-recap cron generated 12 recaps
```

Drives admin awareness of what the system did overnight + what users did today. Clickable rows where applicable.

---

### 9. Subscriptions panel — inline view

Below the couples roster, a parallel section with its own inline console:

#### Subscriptions roster
List of every active subscription. Columns:
- User name + email
- Product (Journey / Games / Adults)
- Plan (monthly / annual / trial)
- Started · current period end
- Status (active / past_due / cancelled / expired / paused)
- Cardcom recurring id (for cross-reference)

Filter chips:
- All / Active only / Cancelling / Paused / Trial / Past due

Sort: by attention priority (past_due → cancelling → trial ending soon → active by recency).

#### Subscription console — drawer (same pattern as couples)
Click a row → drawer opens with 3 tabs:

**Tab 1: סקירה (Overview)**
- Plan, status, billing cycle dates
- Lifetime value (sum of paid invoices)
- Activity: last login, last item completed
- Linked couple_id (if any) → "פתח את הזוג" button

**Tab 2: היסטוריית חיוב (Billing history)**
- Every invoice from this subscription, newest first
- Status (paid / refunded / failed)
- Cardcom transaction id
- Download PDF link
- VAT inclusive / exclusive amounts

**Tab 3: פעולות (Actions)**
- Pause subscription (1 / 2 / 4 weeks)
- Cancel at period end
- Cancel immediately (with refund prompt)
- Issue manual refund
- Extend trial by N days
- Manual override of next billing date
- Send invoice copy email

All actions log an admin audit row in `subscription_admin_actions` (new table — migration 080 includes it).

The subscription drawer follows the same "always-visible cockpit" pattern as the couple drawer.

---

## Schema additions for the inline console

To support Section 7 fully, we'd add **one** small migration:

**Migration 080 — couple_item_overrides + one-off flag**

```sql
-- Mark items that exist for one specific couple only.
ALTER TABLE journey_items
  ADD COLUMN IF NOT EXISTS is_one_off BOOLEAN NOT NULL DEFAULT false;

-- Per-couple overrides (and storage for one-off content).
CREATE TABLE journey_couple_item_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id       UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES journey_items(id) ON DELETE CASCADE,
  -- Optional per-block overrides. NULL = use the catalog default.
  body_he         TEXT,
  task_he         TEXT,
  expert_insight_he   TEXT,
  common_mistakes_he  TEXT,
  metaphor_he         TEXT,
  measurement_he      TEXT,
  do_this_week_he     TEXT,
  dont_this_week_he   TEXT,
  progress_marker_he  TEXT,
  -- Provenance.
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (couple_id, item_id)
);

-- Hide one-off items from catalog browsers (they don't auto-suggest).
CREATE INDEX IF NOT EXISTS journey_items_catalog_idx
  ON journey_items (id) WHERE is_one_off = false AND is_active = true;

-- Audit trail for subscription actions taken via the admin cockpit
-- (pause/cancel/extend/refund). Compliance + ability to revert.
CREATE TABLE subscription_admin_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  admin_user_id   UUID NOT NULL REFERENCES auth.users(id),
  action          TEXT NOT NULL CHECK (action IN (
    'pause','resume','cancel_at_period_end','cancel_immediate',
    'refund','extend_trial','override_next_billing','send_invoice'
  )),
  reason          TEXT,
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subscription_admin_actions_sub_idx
  ON subscription_admin_actions(subscription_id, created_at DESC);
```

When the user-facing LessonView renders an item, it does:
```sql
SELECT
  COALESCE(o.body_he, i.body_he)              AS body_he,
  COALESCE(o.task_he, i.task_he)              AS task_he,
  COALESCE(o.expert_insight_he, i.expert_insight_he) AS expert_insight_he,
  -- ... etc.
FROM journey_items i
LEFT JOIN journey_couple_item_overrides o
  ON o.item_id = i.id AND o.couple_id = $coupleId
WHERE i.id = $itemId;
```

This way:
- The 250-row catalog stays the source of truth.
- Per-couple personalizations don't pollute it.
- Admin can edit for one couple without affecting anyone else.
- Removing an override (DELETE row) reverts to catalog content.

**Existing ON CONFLICT pattern — re-running the seed migration 078 won't touch overrides.**

---

## Gaps surfaced during the coaching guide audit (2026-05-09)

While writing `/dashboard/coaching-guide`, additional functional gaps surfaced. Listed here so they make it into V2 planning. Each comes with a brief design pointer.

### G1. Copy content between couples
**Problem:** Coach writes ad-hoc content for couple A. Realizes it'd help couple B too. Currently has to retype.
**Solution:** "Copy to another couple" button on any override or one-off item. Picks the source couple, prompts the target. Creates a NEW override row for couple B (independent — editing one doesn't affect the other).
**Effort:** ~30 minutes once Phase 9B ships.

### G2. Read receipts on coach messages
**Problem:** Coach doesn't know if the message was read. Sometimes reaches out a second time pre-emptively, which feels needy from the user side.
**Solution:** New column `journey_messages.read_at TIMESTAMPTZ`. User-side surface stamps it on render. Coach UI shows a single check (sent) → double check (read).
**Effort:** ~1.5 hours (migration + render hook + UI badge).

### G3. Variable substitution in saved replies
**Problem:** Coach saves "תודה {{partner_name}} שחלקת". Today the variables don't expand — coach types the name manually each time.
**Solution:** Tiny templating engine. Replace `{{partner_name}}`, `{{couple_name}}`, `{{today}}`, `{{coach_name}}` on insert. Optional whitelist enforces the variable list.
**Effort:** ~1 hour.

### G4. Internal coach notes — surface them better
**Problem:** `couple_note` library kind exists but is buried inside the library page. Coach doesn't see notes when viewing the couple.
**Solution:** Pin the latest 3 couple_notes for THIS couple as a small panel in the per-couple workspace, above the timeline.
**Effort:** ~1 hour.

### G5. "Why did I push this?" rationale on history
**Problem:** Coach pushed a manual item 2 weeks ago. Now reviewing — can't remember why.
**Solution:** When pushing, optional one-line note attached to the scheduled_item (`admin_notes` field already exists, just need UI). Surface in history tab of couple drawer.
**Effort:** ~45 minutes.

### G6. Onboarding wizard for first 3 couples
**Problem:** When a coach joins, even with the guide, the first 3 couples are anxious. They don't know what to do for each step.
**Solution:** Per-couple onboarding checklist (similar to coach-readiness milestones but per-couple): "sent welcome message" / "scheduled day-1 item" / "logged a couple_note about goals". Coach checks off as they go.
**Effort:** ~2 hours.

### G7. Standard crisis-resources panel
**Problem:** When AI flags "urgent", the guide says to escalate. But what does the coach actually send? Today they improvise.
**Solution:** Pre-approved crisis-resources block (Hebrew helplines, ER protocols, suicide hotline, abuse reporting). One-click insert into the message compose. Lives as a special `library_kind='crisis_resource'`.
**Effort:** ~2 hours (content writing dominates; tech is trivial).

### G8. Audit trail for content edits
**Problem:** Multiple people may edit the catalog (admin + future coaches). Today no record of WHO changed WHAT and WHEN.
**Solution:** New `journey_items_history` table, populated by trigger on UPDATE. Surface a "history" tab on the item edit page.
**Effort:** ~1.5 hours.

### G9. Per-pillar metrics
**Problem:** Cockpit currently mixes Journey + Games + Adults metrics. For deeper analysis, want a "Journey-only" / "Games-only" view.
**Solution:** Filter chip on the cockpit ("All / Journey / Games / Adults"). Hides KPIs that aren't relevant to the chosen pillar.
**Effort:** ~30 minutes.

### G10. Welcome-back message after pause
**Problem:** When a couple resumes from pause, currently no special handling. Coach gets the same "active couple" UI.
**Solution:** Soft alert on the couple row: "🔄 חזרו מהשהיה ב-DD/MM". Coach can review what they missed and send a "ברוך שובכם" message.
**Effort:** ~45 minutes.

---

## What's NOT in V1

- **Real-time updates** — no WebSocket. Admin refreshes the page or hits a refresh button. V2.
- **Per-user deep search** — admin uses /dashboard/users for that. The cockpit just summarizes.
- **Editable widgets** — no drag-to-rearrange, no hide/show. Static layout for V1.
- **Date range filters** — fixed windows (today / 7d / 30d) chosen per metric. V2 could add a global picker.
- **Cross-product cohort analysis** — out of scope. V2.

---

## Data sources — already exist

Almost every number on the cockpit already has a query implemented somewhere. The cockpit data helper aggregates them in **one function** with `Promise.all` so the page renders fast.

Sources:
- `lib/journey/metrics.ts` — `getJourneyKPIs`, `getCoachLoad`, `getCategoryHeat`, `getStageFunnel`, `getUrgentUserMessages`
- `lib/journey/coach-readiness.ts` — `getCoachReadiness` (queue summary scoped to this admin)
- `lib/journey/coach-urgent.ts` — `getCoachUrgentMessages` (already mounts in NeedsAttentionPanel)
- `lib/experts/sla.ts` — `getSlaForCouples`
- `lib/journey/drift.ts` — drift queries
- New micro-queries for: total users, active subs by product, revenue, recent activity (last 24h composite)

---

## Implementation plan — 7 steps

(Updated for the inline console addition.)

### Step 1 — `lib/admin/cockpit.ts`
Single helper `getAdminCockpitData(adminUserId)` that returns:
```ts
{
  pulse: { urgentMessages, slaBreaches, needsCheckIn, openThreads }
  kpis: {
    activeJourney, activeGames, totalUsers, revenueThisMonthIls,
    completionRate30d, avgReplyHours30d, driftRate, activeCoaches
  }
  content: {
    itemsTotal, itemsByStage, programsActive, categoriesActive,
    feedbackPositive7d, feedbackNegative7d,
    topItem, bottomItem, recentEdits[]
  }
  navCounts: {
    couplesActive, openThreads, libraryEntries,
    wheelsGames, snakesGames, adultsGames, articlesPublished,
    usersTotal, leadsTotal, subscriptionsActive
  }
  recentActivity: ActivityRow[]   // last 24h, max 15 rows
}
```

### Step 2 — `components/dashboard/AdminCockpit.tsx`
Server component that renders the 6 sections. Reuses existing components where possible (NeedsAttentionPanel, BackfillClassifierButton optionally). New small components:
- `<PulseRibbon/>` — header chip row
- `<KpiCard/>` — already pattern from Phase 3
- `<ContentHealthCard/>` — table of content stats
- `<NavGrid/>` — grouped card grid
- `<ActivityFeed/>` — chronological list

### Step 3 — Wire to `/dashboard`
Replace the admin branch (currently games-stats) with `<AdminCockpit/>`. Coach branch stays untouched (`<CoachOverviewPanel/>`).

### Step 4 — Migration 080 + couple-override read helper
- Run migration 080 (`journey_couple_item_overrides` table).
- Update `lib/journey-content/queries.ts` to apply LEFT JOIN on overrides for any per-couple read.

### Step 5 — Couples roster + drawer (with always-visible data)
- New `<CouplesRoster/>` component (left side list + filter chips).
- New `<CoupleConsoleDrawer/>` — slides in from right (40% width desktop, full mobile), URL-state-driven (`?couple=...&tab=...`).
- Sub-components: `<NowTab/>`, `<PushNowTab/>`, `<HistoryTab/>`, `<SettingsTab/>`.
- Cockpit data behind the drawer stays visible (opacity dim only).
- New server actions:
  - `setCoupleItemOverride(coupleId, itemId, blocks)` — upsert override
  - `removeCoupleItemOverride(coupleId, itemId)` — delete row
  - `pushItemNow(coupleId, itemId)` — schedules with `unlock_at=now`
  - `scheduleItem(coupleId, itemId, date)` — schedules with custom date
  - `rescheduleScheduledItem(scheduledId, newDate)` — adjusts existing
  - `softRemoveScheduledItem(scheduledId)` — sets is_active=false

### Step 6 — PushNowTab three modes
- **Mode A (catalog)**: reuses Phase 4 SmartSuggestions + a search box over `journey_items` WHERE is_one_off=false.
- **Mode B (ad-hoc)**: full LessonView form + 3-button bar (push now / schedule / save draft). Server action `createOneOffItem(coupleId, lessonBlocks, scheduleAt?)` does:
  1. INSERT INTO journey_items (is_one_off=true, ...) → returns item_id
  2. INSERT INTO journey_couple_item_overrides (couple_id, item_id, ...all 9 blocks)
  3. INSERT INTO journey_scheduled_items (assignment_id, item_id, unlock_at, source='admin_manual')
  4. Returns the new scheduled_item_id
- **Mode C (library)**: list of coach_library snippets, each with the same push/schedule buttons.

### Step 7 — Inline LessonView editor (override flow)
Reuse the existing 9-block lesson form (Phase 1 ItemForm) but as a compact inline editor inside the drawer's "ערוך עבור הזוג" flow. Saves as override (couple_id + item_id), not catalog edit.

### Step 8 — Read-side override application
Update LessonView's data fetch on `/journey/timeline/[scheduledId]` to LEFT JOIN `journey_couple_item_overrides` and COALESCE each block. Already specced under "Schema additions" — just code it.

### Step 9 — Global search bar
- New `<GlobalSearchBar/>` client component at top of cockpit.
- New `/api/admin/search?q=...&types=...` route — server-side fuzzy match across couples / users / items / subscriptions.
- Result groups + drawer routing per type.
- localStorage history.

### Step 10 — Subscriptions roster + drawer
- New `<SubscriptionsRoster/>` component (parallel to CouplesRoster).
- New `<SubscriptionConsoleDrawer/>` with 3 tabs (Overview / Billing / Actions).
- Server actions for the 8 admin actions (pause/resume/cancel/refund/etc.) — each writes audit row in `subscription_admin_actions`.
- Reuses Cardcom helpers from existing `/dashboard/subscriptions` page.

### Step 7 — Verify
TS clean, verify script, manual flow:
- Click a couple → drawer opens with 4 tabs
- "דחוף עכשיו" actually schedules a row
- "ערוך לפני שליחה" creates an override → user sees overridden content on their timeline
- Remove override → user sees catalog default

---

## Estimated effort

- Step 1: ~1.5h — data helper (8-10 parallel queries)
- Step 2: ~2.5h — cockpit sections
- Step 3: ~15m — wiring
- Step 4: ~1h — migration 080 + read-side override join
- Step 5: ~3h — roster + drawer + 4 tabs + 6 server actions
- Step 6: ~3h — PushNowTab three modes (catalog / ad-hoc / library) + createOneOffItem action
- Step 7: ~1.5h — inline editor reuse
- Step 8: ~30m — read-side override on /journey/timeline
- Step 9: ~2h — global search bar + /api/admin/search route
- Step 10: ~3h — subscriptions roster + drawer + 8 admin actions + audit table

**Total: ~18 hours of work.**

Ship in 3 phases:
- **Phase 9A** (Steps 1-3, ~4h): Cockpit landing page. Couples roster links to existing `/dashboard/my-clients/[coupleId]` (no drawer yet). Subscriptions linked from nav grid.
- **Phase 9B** (Steps 4-8, ~9h): Couple console drawer + ad-hoc content + override mechanic. The big content-management upgrade.
- **Phase 9C** (Steps 9-10, ~5h): Global search + subscription drawer with admin actions.

Each phase is independently shippable. Phase 9A alone replaces the games-stats landing with something useful immediately.

---

## Open questions for Itzik

1. **Revenue calculation** — should "this month" include canceled subs? exclude refunds? The simple version: SUM(amount) from invoices issued this month. Refund correction is V2.

2. **Recent activity feed** — should I include EVERY event type (signups, completions, messages, cron runs) or filter to admin-relevant only (signups, subs, urgent messages)?

3. **Top / bottom item** — by completion count? by feedback rating? net promoter? The simplest is last-7-days completion count for top, and ≥3 negative ratings for bottom.

4. **Refresh strategy** — `force-dynamic` (rerun every hit) or 60s cache (revalidate)? force-dynamic is safest for an action-driven page; 60s cache reduces DB load.

5. **Layout — single column or 2-col grid?** Single column reads faster on mobile but desktop feels empty. I'd default to single column with KPIs in 4-up grid, but I want your call.

---

## Approval checklist

After you read this, tell me:
- [ ] Sections look right (1-9, plus search 6.5)?
- [ ] Open questions answered (or "use your judgment")
- [ ] Visual style — admin-clean (current) or premium (wine accents)?
- [ ] Anything missing?
- [ ] Ship as one big Phase 9 (~18h) or 3 sub-phases (9A/9B/9C)?

When you say "מאושר, נתחיל" — I implement.

---

## Quick map — sections at a glance

```
┌─────────────────────────────────────────────────────────────┐
│  שלום איציק       [3 דחוף] [2 SLA] [1 drift] [8 threads] │  Pulse
├─────────────────────────────────────────────────────────────┤
│  🔍 [search bar — couples/users/items/subscriptions...]      │  Global search
├─────────────────────────────────────────────────────────────┤
│  ⚡ דורש התייחסות עכשיו — list of urgent messages           │  Action queue
├─────────────────────────────────────────────────────────────┤
│  [247 Journey] [89 Games] [1432 users] [₪9,653 revenue]    │  Platform KPIs
│  68% completion · 14h reply · 8% drift · 1 coach            │
├─────────────────────────────────────────────────────────────┤
│  Content health: 250 items · 5 categories · 12 helpful (7d)│  Content
├─────────────────────────────────────────────────────────────┤
│  Navigation hub: 25+ surfaces, organized                    │  Nav
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌────────────────────────────┐         │
│  │ זוגות        │    │ Couple drawer (when open) │         │  Couples
│  │ - דנה & יוסי │ →  │ Now / Push / History /    │         │  + console
│  │ - מיכל & רון │    │ Settings tabs             │         │
│  │ ...          │    └────────────────────────────┘         │
│  └──────────────┘                                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌────────────────────────────┐         │
│  │ מנויים       │    │ Subscription drawer       │         │  Subscriptions
│  │ - דנה Active │ →  │ Overview / Billing / Acts │         │  + console
│  │ ...          │    └────────────────────────────┘         │
│  └──────────────┘                                            │
├─────────────────────────────────────────────────────────────┤
│  Recent activity (24h): signups, completions, crons, etc.   │  Activity feed
└─────────────────────────────────────────────────────────────┘
```
