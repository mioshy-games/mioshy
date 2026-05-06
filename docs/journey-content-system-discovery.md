# Journey Content System - Discovery Report (v3 spec)

**Status:** Discovery only. No code or schema changes proposed for execution yet.
**Author:** Claude, 2026-05-02.
**Baseline doc this extends:** [docs/journey-content-system-design.md](docs/journey-content-system-design.md) (v2, 2026-04-21). The v2 design is largely shipped.
**Spec this is measured against:** Itzik's "Per-Partner Content Delivery System" brief, 2026-05-02.

---

## 0. TL;DR

The codebase is **much further along than the spec assumes**. Programs / categories / items / assignments / scheduled-items / completions / responses / clinician-feedback / per-couple inspector / KPI page / CSV import + export / hourly unlock-notification cron - **all shipped**. Sidebar entries under `/dashboard/journey` are wired and styled. Drag-and-drop is the only "missing pillar" people will see at a glance.

The real gaps are conceptual, not surface area:

1. **No subtopic tier.** Today the hierarchy is `Program → Category → Item`. The v3 spec needs `Category → Subtopic → Item` (with items also allowed direct-on-category). Programs become optional / legacy.
2. **Couple-centric ownership.** Today `journey_assignments` is polymorphic (user XOR couple), and most flows resolve to the *couple* via [`preferCoupleOwner()`](lib/journey-content/owner.ts:52). The v3 spec mandates **strict per-partner queues**. Both partners can be subscribed independently; their queues, deliveries, threads must be per-user.
3. **No assessment-driven queue generation.** Admins manually assign programs/categories/items today. The v3 spec wants the engine to *generate* the queue from a per-partner ranking + admin-curated order, with strict dedup.
4. **No cadence engine.** `default_offset_days` materializes a fixed schedule at assignment time. The v3 spec wants a recurring engine: 2/week on user-chosen days (default Mon+Wed) + 1 random/week, advancing the queue per delivery slot, "first item delivers immediately" on assessment completion.
5. **No reactive re-prioritization.** When a user changes their priority order today, [`JourneyPriorityRanking`](components/my/JourneyPriorityRanking.tsx) persists the new order to `journey_responses` but nothing regenerates the future queue.
6. **No drag-and-drop UI.** Admin uses numeric `sort_order` / `sort_weight` inputs. `framer-motion` is installed and used for the *user's* priority ranking ([`PriorityRankingStep.tsx`](components/journey/PriorityRankingStep.tsx)) but never in admin.
7. **No subtopic group cohorts.** The v3 spec wants admin-managed groups bound to specific subtopics with replace/interleave behavior. No infrastructure today.
8. **Expert push lands instantly.** [`SendInterventionModule`](components/dashboard/journey/SendInterventionModule.tsx) sends right now. The v3 spec wants pushes to land on the recipient's *next scheduled delivery day*.
9. **Grace period is 7 days, not 14, and only fires on payment failure.** [`lib/billing.ts:82`](lib/billing.ts:82) sets `GRACE_PERIOD_DAYS = 7`; `subscriptions.grace_until` is touched only by the renewal cron. No "subscription expiry → pause cadence + 14-day grace" path exists.
10. **No threaded per-item chat or general expert channel.** [`journey_item_responses`](supabase/migrations/035_journey_content_system.sql) is append-only with a single optional `clinician_reply_text` field (migration 049). [`journey_user_messages`](supabase/migrations/051_journey_user_messages.sql) is one-way fire-and-forget. The spec wants two-way threaded conversations on both surfaces.
11. **Five categories are hardcoded** in [`lib/journey/priorities.ts:14`](lib/journey/priorities.ts:14) (`PRIORITY_KEYS = ["communication","intimacy","emotional_connection","friendship","family"]`). They must move into `journey_categories` as seed data so admin can edit/translate them.
12. **No live stats sidebar in catalog editor.** [`/dashboard/journey-analytics`](app/dashboard/journey-analytics/page.tsx) gives platform-wide KPIs. Per-item "queued / delivered / completion rate" while editing - not yet.

The good news: every gap is additive on top of a clean foundation. **No throwaway needed**, no parallel system, no rewrite. We extend the existing schema, swap couple-centric resolution for per-partner resolution, and bolt on a queue-generator + cadence cron + drag-reorder UI + groups + threaded chat.

---

## 1. Branch & worktree note (read first)

The harness placed me in worktree `claude/jolly-volhard-2decee` at `faf92e6` - that branch is rooted in a near-empty 2-commit history and does **not** contain any of the journey work. The live `game` branch is at `c5fe1bb` with all the migrations and admin pages this report inventories. All discovery was performed against `/Users/uxellent/mioshy` (the main checkout). Before any implementation lands, the worktree must be reset onto `game`'s tip, or implementation should happen directly in main. Flagging now so this doesn't bite us at PR time.

---

## 2. Current state inventory

For each area: **what exists / where / maturity**. Maturity is `production` (shipped, in use), `partial` (built but missing key paths), `placeholder` (table exists but no UI/logic), or `missing` (nothing).

### 2.1 Database schema

53 migrations under [`supabase/migrations/`](supabase/migrations/). Journey-relevant migrations:

| File | Role | Maturity |
|---|---|---|
| `001_admin_schema.sql` | `profiles` table with `role` enum (user/admin/expert) | production |
| `026_journey_questionnaire.sql` | Onboarding questionnaire: `journeys`, `journey_responses`, `journey_analysis`, `engagement_schedules`, `sent_messages`, `message_templates` | production |
| `029_between_us_section.sql` | `couples`, `couple_members` (owner/partner roles), `couple_entitlements` | production |
| `030_couple_invitations.sql` | Email invitations with token + 30-day expiry | production |
| `032_subscription_product_pillar.sql` | `subscriptions.product` ∈ {games, journey, adults} | production |
| `035_journey_content_system.sql` | **The core delivery system**: `journey_programs`, `journey_categories`, `journey_items`, `journey_assignments`, `journey_scheduled_items`, `journey_item_completions`, `journey_item_responses` | production |
| `036_journey_automation_fields.sql` | `programs.product_slug` + `scheduled_items.notified_at` (notify-unlocks idempotency) | production |
| `043_expert_couples.sql` | Expert ↔ couple assignment + `is_expert()` / `is_expert_for_couple()` RLS helpers | production |
| `046_journey_feedback.sql` | Admin-only clinical notes (severity enum, anchor to category/item/question) | production |
| `049_journey_response_clinician_fields.sql` | `clinician_status / clinician_id / clinician_reply_text / clinician_replied_at` on responses | production |
| `050_journey_items_assessment_kind.sql` | `items.kind` ∈ {content, assessment, reflection} + `assessment_payload jsonb` + `responses.structured_answer jsonb` | production |
| `051_journey_user_messages.sql` | One-way user→clinician note channel | partial (no UI thread) |
| `052_journey_response_tags.sql` | Auto-tag array on responses + GIN index | production |
| `053_journey_user_scores.sql` | Derived per-user adaptive signals | partial (no recompute job in vercel.json yet) |

Couple model (verbatim):
- [`couples`](supabase/migrations/029_between_us_section.sql) - `id, pair_code, created_by, display_name, is_active`.
- [`couple_members`](supabase/migrations/029_between_us_section.sql) - `couple_id, user_id, role ∈ {owner, partner}`, UNIQUE(couple_id, user_id).
- Two distinct `auth.users` rows linked through `couple_members`. **Per-partner queues are schema-friendly today** (assignments can be `user_id`-scoped); the application layer is what biases toward couple resolution.

Subscription / entitlement schema:
- [`subscriptions`](supabase/migrations/012_leads_and_subscriptions.sql) carries `status ∈ {active, paused, canceled, cancelled, expired, past_due, blocked}`, `current_period_end`, `next_billing_date`, `grace_until` (set on payment failure only - *not* on natural expiry), `failed_attempts`, `product`.
- [`getUserEntitlements()`](lib/entitlements/getUserEntitlements.ts) returns `{ games, journey, adults, anyPillar, pillarCount }`. It only checks `status='active' AND current_period_end > now()`. **No grace-window logic in the entitlement check** - once `current_period_end` passes, the user is dropped immediately.

**Maturity overall: production for the core relational schema, missing for subtopics/groups/threads/per-partner-cadence/grace.**

### 2.2 Admin UI under `/dashboard`

Routes under [`app/dashboard/journey/`](app/dashboard/journey/):

| URL | File | Role | Maturity |
|---|---|---|---|
| `/dashboard/journey` | `page.tsx` | Landing with KPI cards + program/category previews + import/export tools | production |
| `/dashboard/journey/programs` | `programs/page.tsx` | Programs table | production |
| `/dashboard/journey/programs/new`, `/[id]` | - | Create / edit program | production |
| `/dashboard/journey/categories` | `categories/page.tsx` | Categories table with item counts | production |
| `/dashboard/journey/categories/new`, `/[id]` | - | Create / edit category | production |
| `/dashboard/journey/items` | `items/page.tsx` | Items table + category filter pills | production |
| `/dashboard/journey/items/new`, `/[id]` | - | Create / edit item | production |
| `/dashboard/journey/assignments` | `assignments/page.tsx` | All assignments table | production |
| `/dashboard/journey/assignments/new`, `/[id]` | - | Create / inspect assignment | production |
| `/dashboard/journey/clients` | `clients/page.tsx` | Searchable per-owner roster with stats | production |
| `/dashboard/journey/clients/[ownerKey]` | - | Per-owner control panel: timeline + nudge/cancel actions | production |
| `/dashboard/journey/feedback` | `feedback/page.tsx` | Admin clinical notes inbox with filters | production |
| `/dashboard/journey/import` (POST) | `import/route.ts` | Multipart CSV upload, three-tier parse (programs/categories/items) | production |
| `/dashboard/journey/export` (GET) | `export/route.ts` | Returns ZIP of 4 CSVs with full fidelity | production |
| `/dashboard/journey/template` (GET) | `template/route.ts` | Empty-template CSV download | production |
| `/dashboard/journey-analytics` | `journey-analytics/page.tsx` | Platform-wide funnel + KPIs (7/30/90d window) | production |

Admin chrome: [`app/dashboard/layout.tsx`](app/dashboard/layout.tsx) calls `requireExpert()`; per-page `requireAdmin()` enforces admin-only routes via [`lib/auth/admin.ts`](lib/auth/admin.ts). Sidebar in [`components/dashboard/Sidebar.tsx`](components/dashboard/Sidebar.tsx) has a Journey group with all six children.

Form pattern (representative): [`CategoryForm.tsx`](components/dashboard/journey/CategoryForm.tsx) - `react-hook-form` + `zodResolver(journeyCategorySchema)` + Sonner toasts + server action `saveJourneyCategory()`. All forms follow this template.

CSV layer: [`lib/csv-journey.ts`](lib/csv-journey.ts) defines `parsePrograms/Categories/ItemsCsv()` (auto-detects the first column header to dispatch) and `buildPrograms/Categories/Items/AssignmentsCsv()`. Already returns a `JourneyImportSummary` with row-level skip reasons.

Per-couple inspector: [`/dashboard/my-clients/[coupleId]/page.tsx`](app/dashboard/my-clients/[coupleId]/page.tsx) shows partner split + recent activity + assignment form + [`SendInterventionModule`](components/dashboard/journey/SendInterventionModule.tsx) (push message/task/reflection/item to one or both partners - but lands instantly, not on next delivery day).

**Missing under `/dashboard` (verified by Explore):** subtopic CRUD, drag-reorder UI (any axis), groups CRUD, group bulk-assign / broadcast, push-with-delivery-slot, live per-item stats sidebar, scheduler health board, manual "unlock now" button.

### 2.3 User-facing surfaces

Routes under [`app/[locale]/journey/`](app/%5Blocale%5D/journey/) and [`app/[locale]/my/journey/`](app/%5Blocale%5D/my/journey/):

| URL | Role | Maturity |
|---|---|---|
| `/[locale]/journey` | Marketing hub, branches by auth + entitlement state | production |
| `/[locale]/journey/assessment` | Questionnaire flow (40 questions across stages + ranking) | production |
| `/[locale]/journey/timeline` | User's queue grouped by category, locked/available/completed badges | production |
| `/[locale]/journey/timeline/[scheduledId]` | Item detail: body + complete toggle + response thread (single reply chain) | production |
| `/[locale]/my/journey` | Private dashboard ("the tuned clinic"): rail of categories sorted by viewer's ranking, work area, activity history, editable ranking, expert message channel | production |

Component leaderboard:
- Assessment: [`JourneyClient.tsx`](components/journey/JourneyClient.tsx), [`QuestionStep.tsx`](components/journey/QuestionStep.tsx), [`PriorityRankingStep.tsx`](components/journey/PriorityRankingStep.tsx) (uses `Reorder.Group` from framer-motion), [`AnalysisSummary.tsx`](components/journey/AnalysisSummary.tsx), [`InlineAuthStep.tsx`](components/journey/InlineAuthStep.tsx).
- Timeline: [`TimelineList.tsx`](components/journey/timeline/TimelineList.tsx), [`NextUpHero.tsx`](components/journey/timeline/NextUpHero.tsx), [`ItemDetailClient.tsx`](components/journey/timeline/ItemDetailClient.tsx), [`UserRecentActivity.tsx`](components/journey/timeline/UserRecentActivity.tsx), [`CompletionCelebrationModal.tsx`](components/journey/timeline/CompletionCelebrationModal.tsx), [`AssessmentItemForm.tsx`](components/my/AssessmentItemForm.tsx).
- Dashboard: [`JourneyDesk.tsx`](components/my/JourneyDesk.tsx), [`JourneyProgressRail.tsx`](components/my/JourneyProgressRail.tsx), [`JourneyWorkArea.tsx`](components/my/JourneyWorkArea.tsx), [`JourneyActivityHistory.tsx`](components/my/JourneyActivityHistory.tsx), [`JourneyPriorityRanking.tsx`](components/my/JourneyPriorityRanking.tsx), [`JourneyExpertMessage.tsx`](components/my/JourneyExpertMessage.tsx), [`SubscriptionStatusBanner.tsx`](components/my/SubscriptionStatusBanner.tsx), [`ClinicianReplyBanner.tsx`](components/my/ClinicianReplyBanner.tsx), [`WelcomeProcessingBanner.tsx`](components/my/WelcomeProcessingBanner.tsx).

**Crucial: no occurrences of "lesson" / "שיעור" in journey-facing components.** Internal vocabulary is *items / assignments / scheduled items / chapters (פרקים)*. Already aligned with the v3 terminology rule.

Per-partner separation today: [`lib/journey-content/owner.ts:52`](lib/journey-content/owner.ts:52) `preferCoupleOwner()` resolves to the couple if one exists, else to the user. This is the call that the v3 spec wants reversed: **always per-partner**, with couple as a *view*.

`scheduled_items.audience ∈ {both, owner, partner}` already partitions visibility, so the schema can support per-partner queues without churn - we just stop materializing couple-owned assignments for the new product.

### 2.4 Assessment flow + ranking

Today's assessment is **not** the lean "rank 5 categories" the v3 spec describes. It's a 40-question Seven-Principles-inspired questionnaire ([`lib/journey/questions.ts`](lib/journey/questions.ts)) split into:
- Q1–Q5 unauthenticated (device_id cookie tracking).
- Q6–Q28 authenticated (after inline signup at the auth gate).
- A priority-ranking step using the 5 hardcoded `PRIORITY_KEYS` from [`lib/journey/priorities.ts:14`](lib/journey/priorities.ts:14).
- Final `AnalysisSummary` that computes love-language / friendship / conflict-health scores into [`journey_analysis`](supabase/migrations/026_journey_questionnaire.sql).

Per-question answers persist in `journey_responses`. The ranking is one of those rows (kind=ranking, `structured_answer = ["communication","intimacy",…]`).

**Spec gap.** The v3 brief implies the assessment *is* the ranking ("each partner answers an assessment, ranks 5 categories from most to least important"). Two options when implementing:
- **A.** Keep the 40-question assessment as the entry path, treat the existing priority-ranking step as the v3 ranking, and skip the rest for content-routing purposes (use the rest for clinical signal only).
- **B.** Add a new lean "ranking-only" assessment for users who land on the new product page, and keep the existing 40-question version as a separate path for clinical depth.

I recommend **A**: zero churn for users mid-flow, the data already exists, and the engine only needs the ranking row to start delivering. **Open question for Itzik in §6.**

### 2.5 Couples & partner model

- Two `auth.users` rows linked through `couple_members` with explicit owner/partner roles.
- Invitation flow: [`inviteCouplePartnerByEmail()`](app/actions/couple-invitations.ts) emits a Brevo email with a `/[locale]/invite/[token]` link; partner claims via [`claimInviteAsNewUser()` or `claimInviteAsExistingUser()`](app/actions/invite-claim.ts), then RPC `acceptInvitationForCurrentUser` writes the partner row.
- [`profiles`](supabase/migrations/001_admin_schema.sql) has **no** `partner_id`, **no** locale preference, **no** schedule/delivery-day preferences. The v3 spec wants user-chosen Mon/Wed defaults - that's a new column or sidecar table.

### 2.6 Subscription, billing, entitlements, grace

- Cardcom callback handler [`app/api/billing/cardcom/indicator/route.ts`](app/api/billing/cardcom/indicator/route.ts) updates `subscriptions` rows on payment success / failure. Sets `grace_until = now + 7 days` only on charge failure.
- Daily renewal cron [`app/api/billing/renewals/run/route.ts`](app/api/billing/renewals/run/route.ts) (06:00 UTC, secured with `CARDCOM_BILLING_CRON_SECRET`) charges due subscriptions, sets/clears `grace_until` based on outcome. **No code path expires a subscription on `current_period_end` without a failed charge attempt** - i.e., a subscription that simply isn't renewed because the payment method was removed or the user cancelled never gets a "soft expiry → grace → block" treatment.
- [`getUserEntitlements()`](lib/entitlements/getUserEntitlements.ts) does a naïve `current_period_end > now()` check. No grace handling.

**Spec gap.** The v3 spec wants:
- Cadence pauses immediately on expiry (no new items).
- Past content stays accessible for 14 days.
- After 14 days, full block.
- Renewal restores; queue is preserved (frozen, not deleted).

This means three additions: (a) an "expiry watcher" that sets `grace_until = now + 14d` when `current_period_end` passes without renewal, (b) a `journey_pause_until` flag (or compute from `grace_until`) that the cadence cron respects, (c) entitlement gate that returns three states - `active / grace / blocked` - not just a boolean.

### 2.7 Delivery / scheduling engine

- Hourly Vercel cron `/api/journey/notify-unlocks` (at `:15`) → [`notify-unlocks.ts`](lib/journey-content/notify-unlocks.ts) - scans `journey_scheduled_items` where `unlock_at <= now AND notified_at IS NULL`, sends Brevo emails, sets `notified_at`.
- Daily renewal cron at 06:00 UTC.
- Daily invoice repair at 06:30 UTC.
- 5-minute engagement tick at [`/api/engagement/tick`](app/api/engagement/tick/route.ts) (NOT in `vercel.json`; expects external trigger). Processes `engagement_schedules`.

**No queue advancer** - i.e., nothing reads "what should this user receive on their next delivery day?" and inserts a new `scheduled_items` row. Today the entire schedule is materialized at assignment time using `default_offset_days` per item.

The v3 spec needs a **rolling cadence engine**:
- Every X interval (probably daily near each user's preferred delivery hour), look at users whose next delivery day is today.
- For each, pick the next item from their personalized queue (respecting weighted-interleave across rankings, admin order within categories, dedup, push insertions).
- Insert one `scheduled_items` row with `unlock_at = today + per-user time of day`.
- Notify-unlocks cron then fires the email.

### 2.8 Messaging / chat / feedback infra

Three distinct surfaces today, all *partial* relative to the v3 spec:

| Surface | Table | Shape | What's missing for v3 |
|---|---|---|---|
| Per-item user → clinician | `journey_item_responses` (`response_text`, `is_private`, `clinician_status`, `clinician_reply_text` × 1) | **Append-only with single optional reply.** | Threaded back-and-forth; reactions; partner partial-visibility toggle. |
| User → clinician general | `journey_user_messages` (`message_text`, `clinician_status`, `clinician_replied_at`) | **One-way fire-and-forget**, no reply column. | Two-way thread; reply column; "general expert channel" UX. |
| Admin clinical notes | `journey_feedback` (severity enum, admin-only) | **RLS-hidden from users.** | No spec change needed. |

The v3 spec says: per-item thread (text + reactions, expert pool replies); persistent general inbox (two-way, expert pool); per-partner privacy. Implementing this cleanly likely means:
- Promote both surfaces to threaded by adding a `messages` table keyed by either `scheduled_item_id` or `general_channel_id` (whichever is non-null), with `author_kind ∈ {user, expert}`.
- Add a `journey_reactions` table (or a `reactions` jsonb on messages) for emoji reactions.
- Keep `journey_item_responses` as the *first user post* of a per-item thread (back-fill into messages on migration), or fold it entirely.

### 2.9 Notifications

- In-app: no actual in-app notification table. UI banners (`ClinicianReplyBanner`, `WelcomeProcessingBanner`, `SubscriptionStatusBanner`) compute on the fly.
- Email: Brevo, called from `notify-unlocks` and the engagement tick. Templates managed in `message_templates` table.
- No reminder for inactive users. No admin alert when a scheduled delivery fails.

Spec gap: in-app notifications + reminder rules + admin failure alerts are all missing.

### 2.10 i18n

- `next-intl` v4. Locales `he` (default) + `en`. Locale prefix `always`. Geolocation-aware redirect from `/`.
- Messages in single big `messages/he.json` + `messages/en.json` (851 lines each), 19 namespaces. `journeyHub` namespace has ~413 keys for the marketing page.
- **Convention:** Database content uses *separate `_he` / `_en` columns* (not jsonb). Every journey table follows this.
- Most assessment/dashboard inline strings are `isHe ? "..." : "..."` rather than `t()` calls - workable, but new admin UI strings should join `messages/*.json` under a `dashboardJourney` namespace for consistency.
- RTL handled per-component via `dir={isHe ? "rtl" : "ltr"}` and CSS `[dir="rtl"]` font-family overrides in [`app/globals.css`](app/globals.css).

### 2.11 Existing content materials (non-DB)

| File | Type | What | Used by code? |
|---|---|---|---|
| `שאלות-ואתגרים-זוגיים-חלק-{1..5}.md` | Hebrew markdown | ~900 lines combined; couples questions/challenges by intensity tier | No |
| `משחקי-זוגיות-10-קטגוריות.md` | Hebrew markdown | 1,345 lines; game design framework with 10 categories | No (referenced from `seed_wheel_games.sql`) |
| `love-games-messages-{he,en}.json` | JSON | Marketing copy fixture | Yes (in frontend marketing components) |
| `seed_articles.sql` | SQL | 6 bilingual articles | Manual seeding only |
| `seed_wheel_games.sql` | SQL | 7 wheel games with full configs | Manual seeding only |
| `seed_runner.mjs` | Node script | Idempotent seed runner | Manual run only |
| `מסע-זוגיות-מערכת-תוכן.xlsx` | Excel (189 KB) | **Likely the journey content master** | No |
| `מסע-זוגיות-מערכת-תוכן-אצווה-1.xlsx` | Excel (117 KB) | Batch 1 of journey content | No |
| `משימות-זוגיות-אצווה-1.xlsx` | Excel (9.8 KB) | Tasks batch 1 | No |
| Google Sheet ([link](https://docs.google.com/spreadsheets/d/1OZ2TWjAoj0Ok4eGmr76Ijh5iQzT-WzUMKeE7LDxm8hY/)) | External | Stated source-of-truth in spec | **No reference anywhere in repo** |

The Google Sheet is unreferenced from code. Per spec, it must become an importable source, not a live source.

---

## 3. Gap matrix vs spec sections A–I

`✓ exists` | `~ partial` | `✗ missing`

### A. Content catalog (DB-first, CSV in/out)

| Spec point | Status | Notes / file |
|---|---|---|
| Items in a generic pool (one category, optional subtopic, type, est. minutes, prereqs, tags, HE+EN body) | ~ partial | Items exist but **no subtopic FK, no est. minutes, no prereqs, no tag array, no `kind` of "type"**. `kind` already exists (content/assessment/reflection) but it's content shape, not the "type" the spec means. |
| Versioning (edits don't mutate delivered copies) | ✓ exists in spirit | Per the v2 design, scheduled_items references `items.id` (FK, no copy). Edits flow through. Spec says "versioning" but we currently have *retroactive update* - Itzik to confirm whether immutable snapshots are needed. |
| CSV import endpoint with upsert + error report | ✓ exists | [`/dashboard/journey/import`](app/dashboard/journey/import/route.ts) with `JourneyImportSummary`. Three-tier (programs/categories/items). Needs subtopic tier + new fields. |
| CSV export endpoint | ✓ exists | [`/dashboard/journey/export`](app/dashboard/journey/export/route.ts) returns ZIP. |
| Stable `item_id` for upsert | ✓ exists | Items have UUID primary key, exported. |

### B. Admin catalog management with drag-and-drop

| Spec point | Status | Notes |
|---|---|---|
| 5 categories as seed data, not hardcoded | ~ partial | `journey_categories` table exists; `lib/journey/priorities.ts` still hardcodes the 5 keys for the assessment path. Need to seed the table + drop the hardcode. |
| Subtopics under categories, CRUD + drag-reorder | ✗ missing | No subtopic table, no UI. |
| Items inside subtopic, drag-reorder | ✗ missing | Items live directly under categories today. |
| Two-level drag-and-drop (subtopics within category, items within subtopic) | ✗ missing | No DnD library installed for admin (`framer-motion` exists but unused there). |
| Reorder affects only future queue picks | ~ depends on engine | Today's "queue" is materialized at assignment time; the dedup-on-skip rule only matters once the rolling engine exists. |
| Filterable admin table with inline editing | ~ partial | Tables exist, filter pills exist on items page, **inline editing does not** - edits go to a separate `[id]` page. |
| Bulk import / export | ✓ exists | See A above. |
| Live stats sidebar per item (queued / delivered / completion / skip rate) | ✗ missing | KPIs page exists but is platform-wide, not per-item. |

### C. Per-partner personalized delivery

| Spec point | Status | Notes |
|---|---|---|
| Per-partner queue (separate from couple) | ~ schema-ready, app-side biased to couple | Schema supports it. App resolution via [`preferCoupleOwner()`](lib/journey-content/owner.ts:52) defaults to couple. Need to flip default. |
| First item delivers immediately on assessment completion | ✗ missing | Assessment completion currently hands off to `AnalysisSummary` + paywall. No item materialization on the completion event. |
| 2/week on user-chosen days (default Mon+Wed) | ✗ missing | No cadence engine, no schedule preferences column. |
| 1 random/discovery item per week | ✗ missing | No "random" picker. |
| Weighted-interleave across ranking (e.g. 50/25/15/7/3) | ✗ missing | No engine. |
| Within category: respect admin drag order | ✗ missing | `sort_order` column exists but no admin DnD UI to set it. |
| Strict dedup across all sources | ~ ad-hoc | Today's materialization writes once per (assignment × item); a multi-source engine needs an explicit dedup table (e.g., `journey_user_delivered_items(user_id, item_id, delivered_at)`). |
| Per-item status: queued → released → seen → completed → skipped | ~ partial | We have completion + responses. No "seen" / "skipped" granularity. |

### D. Subtopic group cohorts

| Spec point | Status |
|---|---|
| Create a Group (label + members) | ✗ missing |
| Bind group to specific subtopics | ✗ missing |
| Replace vs interleave per group | ✗ missing |

Entirely new infrastructure. Schema sketch in §4.

### E. Expert push

| Spec point | Status | Notes |
|---|---|---|
| Admin pushes item(s) to user / couple / group | ~ partial | Per-couple via [`SendInterventionModule`](components/dashboard/journey/SendInterventionModule.tsx). No per-user (without couple), no per-group. |
| Push lands at recipient's next scheduled day, not instantly | ✗ missing | Current flow inserts assignment + scheduled_item with `unlock_at = now`. |
| Surface marked "from your coach / מהמומחה שלכם" | ✗ missing | No UI tag for push origin. (Schema has `assignment.origin` - usable.) |
| Push is additive (doesn't replace cadence) | ~ depends on engine | Trivial once the engine exists. |

### F. Feedback & expert chat

| Spec point | Status | Notes |
|---|---|---|
| Per-item thread (text + reactions, two-way) | ~ partial | Single response + single clinician reply. No threading, no reactions. |
| General persistent inbox (two-way) | ~ partial | One-way fire-and-forget today. |
| Per-partner privacy by default | ~ partial | `is_private` flag on responses, but the architecture is response-centric not thread-centric. |
| Notifications both directions | ✗ missing | No notify-on-message-post or notify-on-reply path. |

### G. Notifications

| Spec point | Status |
|---|---|
| In-app + email when item releases | ~ email only via notify-unlocks; no in-app inbox table |
| In-app + email when expert replies | ✗ missing |
| Reminder when user inactive N days | ✗ missing |
| Admin alert when scheduler fails / queue empty | ✗ missing |

### H. Subscription expiry & 14-day grace

| Spec point | Status | Notes |
|---|---|---|
| Pause cadence on expiry | ✗ missing | No expiry watcher; cadence engine doesn't exist either. |
| Past content accessible during 14d grace | ~ partial | Past content is accessible while subscription is active; entitlement gate flips to false the moment `current_period_end` passes. No grace window. |
| 14d block | ✗ missing | Current grace is 7d, only on payment failure. |
| Banner everywhere ("מנוי פג - חידוש פותח את הכל") | ✗ missing | `SubscriptionStatusBanner` exists for assessment-missing recovery, not for expiry. |
| Renewal restores from where user was | ~ schema-ready | Queue + history preserved by virtue of being separate tables; cadence resumption logic is what's missing. |

### I. Admin monitoring

| Spec point | Status | Notes |
|---|---|---|
| Per-user stats | ✓ exists | [`/dashboard/users/[id]/page.tsx`](app/dashboard/users/%5Bid%5D/page.tsx) + [`/dashboard/journey/clients/[ownerKey]`](app/dashboard/journey/clients/%5BownerKey%5D/page.tsx). |
| Per-couple aggregated | ✓ exists | [`/dashboard/my-clients/[coupleId]`](app/dashboard/my-clients/%5BcoupleId%5D/page.tsx). |
| Per-item stats (queued, delivered, completion, skip) | ✗ missing | Aggregated only at platform level. |
| Per-group aggregated | ✗ missing | Groups don't exist. |
| Health board: scheduler last run, errors, empty queues | ✗ missing | |

---

## 4. Approach proposal

### 4.1 Schema diff

Two new migrations on top of the existing `035–053`. Numbering placeholders: `054_journey_subtopics_and_cohorts.sql`, `055_journey_per_partner_cadence.sql`, `056_journey_threaded_messaging.sql`, `057_subscription_grace_v2.sql`.

#### `054_journey_subtopics_and_cohorts.sql`

```sql
-- Subtopic tier under category
CREATE TABLE public.journey_subtopics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES public.journey_categories(id) ON DELETE RESTRICT,
  slug         text NOT NULL,
  name_he      text NOT NULL,
  name_en      text,
  description_he text,
  description_en text,
  sort_order   int NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);

-- Items can hang directly off a category, or sit inside a subtopic.
ALTER TABLE public.journey_items
  ADD COLUMN subtopic_id uuid REFERENCES public.journey_subtopics(id) ON DELETE SET NULL,
  ADD COLUMN content_type text DEFAULT 'article' CHECK (content_type IN ('article','exercise','video','prompt','challenge')),
  ADD COLUMN est_minutes int,
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN prereq_item_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX journey_items_subtopic_idx ON public.journey_items(subtopic_id) WHERE subtopic_id IS NOT NULL;
CREATE INDEX journey_items_tags_idx ON public.journey_items USING gin(tags);

-- Subtopic cohorts (groups bound to specific subtopics)
CREATE TABLE public.journey_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  label_he    text NOT NULL,
  label_en    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.journey_group_members (
  group_id   uuid NOT NULL REFERENCES public.journey_groups(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE public.journey_group_subtopics (
  group_id    uuid NOT NULL REFERENCES public.journey_groups(id) ON DELETE CASCADE,
  subtopic_id uuid NOT NULL REFERENCES public.journey_subtopics(id) ON DELETE CASCADE,
  mode        text NOT NULL CHECK (mode IN ('replace','interleave')),
  PRIMARY KEY (group_id, subtopic_id)
);
```

#### `055_journey_per_partner_cadence.sql`

```sql
-- User-level cadence preferences
ALTER TABLE public.profiles
  ADD COLUMN journey_delivery_days int[] NOT NULL DEFAULT ARRAY[1,3], -- 0=Sun..6=Sat (Mon=1, Wed=3)
  ADD COLUMN journey_delivery_local_hour int NOT NULL DEFAULT 9 CHECK (journey_delivery_local_hour BETWEEN 0 AND 23),
  ADD COLUMN journey_random_per_week int NOT NULL DEFAULT 1,
  ADD COLUMN journey_paused_at timestamptz;

-- Per-user category ranking (replaces the questionnaire-row-as-source-of-truth pattern)
CREATE TABLE public.journey_user_priorities (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ranking      uuid[] NOT NULL,            -- ordered category_ids; length = #categories
  weights      numeric[] NOT NULL,         -- e.g. {0.50,0.25,0.15,0.07,0.03} per ranking slot
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Strict dedup across all delivery sources
CREATE TABLE public.journey_user_delivered_items (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id      uuid NOT NULL REFERENCES public.journey_items(id) ON DELETE CASCADE,
  scheduled_item_id uuid REFERENCES public.journey_scheduled_items(id) ON DELETE SET NULL,
  source       text NOT NULL CHECK (source IN ('cadence','expert_push','group','random')),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- Pending pushes waiting to land on next delivery slot
CREATE TABLE public.journey_pending_pushes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES public.journey_items(id),
  pushed_by     uuid NOT NULL REFERENCES auth.users(id),
  reason_note   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  consumed_at   timestamptz,                -- set when materialized into scheduled_items
  scheduled_item_id uuid REFERENCES public.journey_scheduled_items(id)
);

-- Per-item engagement state (seen/skipped granularity)
ALTER TABLE public.journey_scheduled_items
  ADD COLUMN seen_at timestamptz,
  ADD COLUMN skipped_at timestamptz,
  ADD COLUMN source text NOT NULL DEFAULT 'cadence' CHECK (source IN ('cadence','expert_push','group','random'));
```

#### `056_journey_threaded_messaging.sql`

```sql
-- General expert channel per user (pool model: any expert replies)
CREATE TABLE public.journey_user_channels (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);

-- Unified thread message table covering both surfaces:
--   - per-item: scheduled_item_id NOT NULL, channel_user_id NULL
--   - general:  scheduled_item_id NULL,    channel_user_id NOT NULL (the user who owns the channel)
CREATE TABLE public.journey_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_item_id uuid REFERENCES public.journey_scheduled_items(id) ON DELETE CASCADE,
  channel_user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  author_user_id    uuid NOT NULL REFERENCES auth.users(id),
  author_kind       text NOT NULL CHECK (author_kind IN ('user','expert')),
  body              text NOT NULL CHECK (length(body) <= 4000),
  reactions         jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {":heart:": 2, ":thumbsup:": 1}
  is_private        boolean NOT NULL DEFAULT false,       -- author + experts only (partner cannot see)
  created_at        timestamptz NOT NULL DEFAULT now(),
  edited_at         timestamptz,
  CHECK ((scheduled_item_id IS NOT NULL) <> (channel_user_id IS NOT NULL))  -- exactly one set
);

CREATE INDEX journey_messages_item_idx ON public.journey_messages(scheduled_item_id, created_at);
CREATE INDEX journey_messages_channel_idx ON public.journey_messages(channel_user_id, created_at);
```

Migration script back-fills existing `journey_item_responses` rows into `journey_messages` (with `author_kind='user'`) and back-fills `clinician_reply_text` rows as paired `author_kind='expert'` messages.

#### `057_subscription_grace_v2.sql`

```sql
ALTER TABLE public.subscriptions
  ADD COLUMN journey_grace_until timestamptz,           -- 14d window starting at expiry/cancel
  ADD COLUMN journey_blocked_at  timestamptz;            -- set when grace ends without renewal

-- Watcher cron updates these every hour (see §4.3).
```

`getUserEntitlements()` extends to return `journey_state ∈ {active, grace, blocked}` instead of a plain boolean. Existing call sites that just need a boolean continue to work via a `journey: state !== 'blocked'` adapter.

**RLS posture.** All new tables follow the existing pattern: writes only via service-role admin client (admin pages, cron jobs); reads gated to subject (`auth.uid() = user_id`) plus expert helpers (`is_expert_for_couple()`); admin bypass via `is_admin()`. Concrete policies in the migration file at implementation time.

### 4.2 Drag-and-drop ordering scheme

**Library choice.** `@dnd-kit/core` + `@dnd-kit/sortable`. Reasons over framer-motion `Reorder`: nested sortables (subtopics within category; items within subtopic), accessible by default (keyboard + screen reader), small bundle, RTL-aware. `framer-motion` stays in the user-facing `PriorityRankingStep`.

**Storage.** `sort_order` (existing) `int4`. We store sparse spacing - initialize at multiples of 1000 - and reorder by recomputing the moved row's value as the average of its new neighbors. When the gap collapses, a server action rebalances the whole list (rare). This avoids cascading row updates on every drag.

**Atomicity.** Single server action `reorderJourneyChildren({ parentKind, parentId, childKind, orderedIds })` - wraps the rebalance in a transaction, validates ownership, returns the new order.

**Computing "next item for user X at slot Y."** Engine pseudocode (per-partner):

```
1. Read user's ranking R = [c1, c2, c3, c4, c5] with weights W.
2. For each cN, look up its subtopics ordered by sort_order, then items ordered by (subtopic.sort_order, item.sort_order).
3. Apply group cohorts: if user is in a group bound to subtopic S with mode='replace', use only group's queue for S; if 'interleave', merge.
4. Filter out item_ids already in journey_user_delivered_items for this user.
5. Pick the first item whose category is the next one in the weighted-interleave sequence
   (e.g. roll the next slot from an admin-configurable sequence like c1,c1,c2,c1,c2,c3,c1,c2,c3,c4,c5,…
    derived from W).
6. Insert into journey_scheduled_items + journey_user_delivered_items in one tx.
```

The "next slot" sequence is precomputed per ranking change and stored in a derived table `journey_user_queue_plan(user_id, plan jsonb)` so we don't redo the math every cron tick.

### 4.3 Scheduling architecture

Three crons in `vercel.json`:

| Cron | Schedule | Job |
|---|---|---|
| `/api/journey/cadence/advance` *(new)* | `*/15 * * * *` (every 15 min) | For each user whose next delivery slot ≤ now and entitlement is active, materialize one `scheduled_items` row using §4.2 picker. Honors push insertions and group cohorts. |
| `/api/journey/notify-unlocks` *(existing)* | `15 * * * *` | Unchanged. Fires emails for newly-released items. |
| `/api/journey/grace-watcher` *(new)* | `0 * * * *` | For each subscription where `current_period_end < now AND status='active'`: set `status='expired'`, `journey_grace_until = now + 14d`. For each where `journey_grace_until < now AND journey_blocked_at IS NULL`: set `journey_blocked_at = now`. |
| `/api/journey/scores/recompute` *(promote existing)* | `0 4 * * *` | Recompute `journey_user_scores`. Currently lacks a cron entry. |

**Defense.** Vercel cron is what's already in use; reliability is fine for "every 15 min" granularity; `notified_at` and `journey_user_delivered_items` PRIMARY KEY make every job idempotent. Supabase `pg_cron` is an option but the codebase has zero precedent and the queries are cheap enough to keep app-side. Edge runtime is *not* a fit (DB-heavy, batch-oriented) - Node functions, 5-min timeout, Bearer-token-secured exactly like the existing crons.

**Health board.** Add `journey_cron_runs(job_name, started_at, finished_at, ok, error_text, rows_processed)` table; every cron writes a row. Render at `/dashboard/journey/health`.

### 4.4 Admin UI structure

New / changed pages under `/dashboard/journey/`:

| Page | Status | Notes |
|---|---|---|
| `/dashboard/journey` | extend | Add health snippet, live "subscribers in cadence" count. |
| `/dashboard/journey/categories` | extend | Make rows draggable for top-level reorder. |
| `/dashboard/journey/categories/[id]` | extend | Show subtopics list (draggable), direct-on-category items list (draggable), live stats column per row (queued / delivered / completion %). |
| `/dashboard/journey/categories/[id]/subtopics/new` | new | Subtopic form. |
| `/dashboard/journey/categories/[id]/subtopics/[subId]` | new | Subtopic edit + items list (draggable) + stats. |
| `/dashboard/journey/items` | extend | Inline edit for `sort_order`, `is_active`, `est_minutes`, `tags`. Add filter by subtopic. |
| `/dashboard/journey/items/[id]` | extend | Add live-stats sidebar (queued count, delivered, completion rate, skip rate). |
| `/dashboard/journey/groups` | new | List groups + members + bound subtopics. |
| `/dashboard/journey/groups/new`, `/[id]` | new | Group form + member picker + subtopic binder + replace/interleave mode. |
| `/dashboard/journey/push` | new | Pick item(s) → recipient (user / couple / group) → "lands on next delivery slot" preview + confirm. Different surface than the per-couple `SendInterventionModule` (which stays for expert ad-hoc messages). |
| `/dashboard/journey/health` | new | Cron runs table, recent failures, empty-queue count. |
| `/dashboard/journey/import` | extend | Add subtopic CSV tier; accept Google Sheet URL pasted in (server fetches the sheet's CSV export endpoint). |

Sidebar in [`Sidebar.tsx`](components/dashboard/Sidebar.tsx): add `Subtopics` *(implicit through category drill-in)*, `Groups`, `Push`, `Health` entries under the Journey group.

### 4.5 CSV format (final)

Four CSVs in the export ZIP. Items CSV gets a new `subtopic_slug` column (joining via category + subtopic slug, both human-readable). Sample 3 rows of the items CSV in HE:

```csv
item_id,category_slug,subtopic_slug,slug,kind,content_type,est_minutes,tags,title_he,title_en,body_he,body_en,task_he,task_en,sort_order,is_active
,communication,active-listening,reflective-paraphrase,content,exercise,8,"listening;daily","פרפרזה משקפת","Reflective paraphrase","חזרו במילים שלכם על מה ששמעתם...","Repeat in your own words what you heard...","נסו זאת היום בארוחת הערב","Try this at dinner tonight",1000,true
,sexuality,desire-mapping,whisper-list,content,prompt,5,"intimacy;solo","רשימת לחישות","Whisper list","שיתפו 3 דברים שאתם...","Share 3 things you'd like...","",,2000,true
,family,boundary-with-parents,sunday-rule,content,challenge,15,"boundaries;family","חוק יום ראשון","The Sunday rule","הסכימו על חלון זמן שבו...","Agree on a time window when...","הגדירו את החוק לפני יום ראשון הקרוב","Set the rule before this Sunday",3000,true
```

Subtopics CSV: `subtopic_id, category_slug, slug, name_he, name_en, description_he, description_en, sort_order, is_active`.
Categories CSV: extended with `program_id` (nullable; programs become legacy) and `assessment_priority_key` (the key that links a `journey_categories` row to the assessment ranking - replaces the hardcoded `PRIORITY_KEYS`).
Programs CSV and assignments CSV: unchanged.

### 4.6 Migration plan (from the Sheet to the DB)

1. Itzik exports each tab of the Sheet to CSV (one per tab: categories, subtopics, items).
2. Itzik uploads each CSV via the extended `/dashboard/journey/import` page. Or pastes the Sheet URL - the import endpoint's new "fetch from Sheet" mode hits `https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=...` for each known tab gid and runs the same upserts.
3. For items already in the DB (none today for this v3 product), upsert by `item_id`; for new rows, `item_id` is empty and the importer mints a UUID.
4. Categories seed migration runs once with the 5 priorities (`communication`, `intimacy`, `emotional_connection`, `friendship`, `family`) + their HE/EN labels and an `assessment_priority_key` value matching the existing assessment.
5. We delete the hardcoded `PRIORITY_KEYS` array and have the assessment fetch categories from the DB.

The `.xlsx` files at the repo root should be converted to CSV by Itzik (Excel → Save As CSV) so the importer can ingest them too; otherwise they stay as documentation.

### 4.7 Per-partner re-resolution

Mechanically minimal: replace [`preferCoupleOwner()`](lib/journey-content/owner.ts:52) call sites *for the v3 product* with a per-partner resolver that always returns `{ kind: 'user', id: userId }`. Existing couple-owned assignments continue to render in the legacy paths. New assignments created by the cadence engine, expert push, and group cohorts are user-owned exclusively. Couple-aggregate views in admin become a `JOIN couple_members` over user-scoped data - a *view*, not a *primary key*.

---

## 5. Implementation slice plan (post-approval)

Roughly the order I'd land PRs, each independently shippable behind a `JOURNEY_V3` feature flag:

1. **Schema + categories seed** (`054`, `055`, `057`) + drop hardcoded `PRIORITY_KEYS`. Read-only impact.
2. **Subtopic CRUD + drag-and-drop UI** (`@dnd-kit` install, category detail page rebuild, subtopic pages). Admin-only.
3. **Cadence engine** (`/api/journey/cadence/advance` cron + queue planner + immediate-first-item server action wired to assessment completion).
4. **Per-partner resolver swap** (replace `preferCoupleOwner` for v3 product, keep legacy intact, add couple-aggregate admin view).
5. **Subscription grace v2** (`057` + watcher cron + entitlement gate update + banner).
6. **Threaded messaging** (`056` + back-fill responses + per-item thread UI + general channel UI).
7. **Groups + cohorts** (CRUD + binding + cadence engine awareness).
8. **Expert push v2** (`/dashboard/journey/push` + push lands on next slot).
9. **Live stats sidebar + health board + monitoring KPIs per item**.
10. **Notification expansion** (in-app inbox table + reminders + admin failure alerts).

---

## 6. Open questions for Itzik

1. **Assessment shape.** Keep the existing 40-question assessment as the v3 entry point and treat its priority-ranking step as the v3 ranking? Or design a new lean ranking-only assessment for the v3 marketing path? (Recommend: keep existing.)
2. **Programs.** Do you want to retire `journey_programs` for v3, or keep them as an optional grouping above categories? Today they're optional; if not used, the system works fine without them.
3. **Versioning vs retroactive edits.** v2 chose retroactive (edits flow through to delivered items). v3 spec mentions "Versioning: editing an item doesn't mutate copies already delivered." Which do you want? Retroactive is what's shipped; immutable snapshots require a new `journey_item_versions` table and copying content into `scheduled_items`.
4. **Random/discovery item.** What's "random"? Pure uniform sample from un-delivered items across all categories? Restricted to user's #1–#3? Tag-driven (e.g., `tags @> '{"discovery"}'`)?
5. **Weighted interleave defaults.** Spec mentions `50/25/15/7/3` as an example. Confirm the actual numbers. Should the weights be admin-configurable per couple/group, or just globally?
6. **Expert pool boundaries.** Pool model is the default - any expert can reply. Confirm. And: should experts be siloed by category (e.g., a "sexuality expert" only sees sexuality threads)?
7. **Per-partner privacy default for general channel.** Confirm partners can never see each other's general expert chat by default; should there be an opt-in to share?
8. **Push UX when recipient is a couple.** The spec says "both partners receive it on their next day." Each partner has their own delivery days - does that mean the item appears on partner-A's next day AND partner-B's next day independently? (Recommend yes, with a single `pending_pushes` row per partner.)
9. **Groups: members stored as users or couples?** Spec says "users/couples" but mixed membership is messy. Recommend: members are *users* only; "couple membership" is sugar for "add both partners."
10. **CSV: paste-Sheet-URL or upload-only?** The spec implies "or paste a Sheet URL." Confirm we should implement that (requires the Sheet to be world-readable or service-account-shared).
11. **Grace banner copy.** "מנוי פג - חידוש פותח את הכל" is the spec's example. Any updates / EN copy?
12. **Worktree mismatch.** Per §1, the worktree this report was written in is on a stale base. Should I rebase it onto `game` for implementation, or work directly in `/Users/uxellent/mioshy`?
13. **Subscription `status` enum extension.** Today's enum is `{active, paused, canceled, cancelled, expired, past_due, blocked}`. I need to add explicit `grace` so the watcher can distinguish "expired but in grace" from "expired and blocked." OK to extend?
14. **Excel files at repo root.** Should I treat them as authoritative content (convert to CSV and import) or leave them as Itzik's working docs and rely on the Sheet being the single source?

---

## 7. What I'm NOT doing in implementation

To make the scope explicit:

- Not touching the existing 40-question questionnaire flow. Only reading from it.
- Not removing `journey_programs` or any v2 concept. Programs become *optional* for v3.
- Not redesigning the user-facing `/[locale]/journey/timeline` rendering. Adding subtopic group chips and "from your coach" badges, but the layout stays.
- Not migrating articles, wheel games, or any non-journey content.
- Not rewriting `getUserEntitlements()` callers - I'm extending the return shape additively and routing journey-specific consumers through a new `getJourneyEntitlement()` helper.
- Not building a new auth / invitation flow. Per-partner resolution uses the existing `couple_members` rows.

---

**Stopping here for sign-off.** Once Itzik responds to §6 and gives the green light, I'll start with slice 1 from §5 (schema + seed + hardcode removal) and PR each slice independently against `game`.
