# Journey — Product Execution Architecture

**Date:** 2026-05-08
**Predecessor:** `journey-product-audit-2026-05-08.md`
**Audience:** Itzik + future product/engineering team
**Stance:** Incremental on the existing schema. No rebuilds. Every recommendation here references real files, tables, and functions that exist today.

---

## Reading guide

This document is split into six parts. They are not equally important. The execution priority order is:

1. **Part 6 (Prioritization)** — read this first if you have 5 minutes
2. **Part 1 (MVP Breakdown)** — what to actually ship in the next 4 weeks
3. **Part 4 (Match Rules Engine)** — the structural unlock for V2 onwards
4. **Part 3 (Coaching Room)** — the highest-leverage UI investment of the year
5. **Part 2 (UX Flows)** — production-grade flow specs
6. **Part 5 (AI Strategy)** — written last; depends on Parts 1-4 actually shipping

If you read top-to-bottom, the architecture is presented in the order it gets *built*, not the order it matters.

---

# PART 1 — MVP Breakdown (8 features, production-ready)

Each feature below follows the same 12-dimension template. The order within the MVP is dependency-correct: you can build top-to-bottom and never have to revisit.

---

## MVP-01 · Per-item feedback (4 buttons)

### Goal
Capture per-content-item user feedback so the matching engine has a learning signal beyond completions.

### Business impact
Unlocks every downstream feature (rules engine, A/B testing, coach insight). Without it, the system can never improve. Highest infra ROI of the eight items.

### Psychological impact
Acts as *closure* on a content item. The user finishes a ritual + reflects + reads expert reply + presses "this helped" — that final tap is the cognitive bookmark that makes the experience memorable.

### Dependencies
- None. Schema additions only.

### DB changes
```sql
-- Migration 066_journey_item_feedback.sql
CREATE TABLE public.journey_item_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_item_id UUID NOT NULL REFERENCES public.journey_scheduled_items(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating          TEXT NOT NULL CHECK (rating IN ('helpful','neutral','not_for_us','made_things_worse')),
  optional_text   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scheduled_item_id, user_id)
);
CREATE INDEX journey_item_feedback_item_idx ON public.journey_item_feedback (scheduled_item_id);

-- RLS
ALTER TABLE public.journey_item_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own feedback"
  ON public.journey_item_feedback FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "users insert own feedback"
  ON public.journey_item_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "experts read for assigned couples"
  ON public.journey_item_feedback FOR SELECT
  USING (is_expert_for_user(user_id));
```

### API changes
- New server action `submitItemFeedback({ scheduledItemId, rating, text? })` in `app/actions/journey-feedback.ts`.
- Idempotent on `(scheduled_item_id, user_id)` — UPSERT.
- Returns `{ ok: true } | { ok: false, error }`.

### Frontend changes
- New component `components/journey/timeline/ItemFeedbackBar.tsx` — 4 chip buttons + optional collapsible textarea.
- Mount in `components/journey/timeline/ItemDetailClient.tsx` directly above `PerItemThread`, but only after `completion?.completed_at` is set.
- Visual: small horizontal row of pill buttons — `עזר ✨ / סבבה / לא לנו / החמיר`.
- Optimistic UI; on submit, hide buttons, replace with "תודה — זה משפיע על מה שתקבלו הלאה."

### Admin changes
- New page `app/dashboard/journey/items/[id]/feedback/page.tsx` — distribution histogram + recent text feedback.
- New column on `app/dashboard/journey/items/page.tsx` listing: `Helpful% / Total responses`.

### Analytics events
- `journey_item_feedback_submitted` — props: scheduled_item_id, item_id, rating, has_text, week_in_journey.
- `journey_item_feedback_revealed` — fires when buttons appear (so we can compute "shown but not used" rate).

### Edge cases
- User submits, then revisits and changes mind — UPSERT replaces; analytics records each as separate event with prior_rating prop.
- Couple where one partner submits and the other doesn't — feedback is per-user, not per-couple. Both votes counted independently.
- Item gets archived (is_active=false) but feedback rows reference it — keep rows; feedback is historically meaningful even when item is retired.

### Rollout strategy
- Ship behind feature flag `feedback_enabled` (env var). Open to 100% on day one — no risk, no migration of existing users.
- Monitor "shown but not used" rate. Target: <60%.

### V2 deferrals
- Per-rating drill-down in admin (start with histogram only).
- Sentiment analysis on `optional_text` — collect now, analyse in V2.
- Surfacing partner's rating to the other partner — **defer indefinitely** unless user research confirms. Privacy implication.

---

## MVP-02 · "Why this item" disclosure

### Goal
Every item in the user's timeline answers, on tap, *why it was chosen for them now*.

### Business impact
This is the single largest perceived-value lever. "Personalised content" that doesn't show its personalisation is indistinguishable from generic content.

### Psychological impact
Validates the user's earlier effort (the assessment). Also creates the *aha* moment of "the platform actually understood me," which converts trial users to advocates.

### Dependencies
- MVP-01 not required, but ships in same week.

### DB changes
```sql
-- Migration 067_match_rule_attribution.sql
CREATE TABLE public.journey_match_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT UNIQUE NOT NULL,
  label_he     TEXT NOT NULL,
  label_en     TEXT NOT NULL,
  -- The rationale shown to the user verbatim.
  rationale_he TEXT NOT NULL,
  rationale_en TEXT NOT NULL,
  -- Free-form definition; full DSL arrives in V2 (see Part 4).
  -- For MVP we use a set of slug-coded built-in matchers.
  matcher_kind TEXT NOT NULL,  -- e.g. 'priority_top1', 'score_threshold', 'fallback'
  matcher_args JSONB,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journey_scheduled_items
  ADD COLUMN matched_by_rule_id UUID REFERENCES public.journey_match_rules(id) ON DELETE SET NULL;

CREATE INDEX journey_scheduled_items_rule_idx ON public.journey_scheduled_items(matched_by_rule_id);
```

### API changes
- Modify `materializeAssignment()` in `lib/journey-content/materialize.ts` to set `matched_by_rule_id` based on assignment origin:
  - `origin='admin_manual'` → seed rule `manual_assignment` ("המומחה שלכם בחר את זה עבורכם")
  - `origin='purchase'` → seed rule `default_program` ("חלק מהתוכנית הראשונית שלכם")
  - Day-1 override → seed rule `day_one_kickoff` ("הצעד הראשון של המסע")
- Modify `cadence-engine.ts` materialisation to attach the rule that triggered the selection.
- Read path: `getTimelineForOwner()` already returns `scheduled_items` rows; extend the row JOIN to include `journey_match_rules.rationale_he/en`.

### Frontend changes
- `components/journey/timeline/ItemDetailClient.tsx` — beneath body, render `<WhyThisItem rationale={...} expertName={...}/>`.
- Visual: subtle ⓘ icon + a single sentence in italic, wine accent: *"יעל בחרה את זה כי דירגתם תקשורת במקום הראשון."*
- On `TimelineList` cards: same icon, no text — tap reveals the line inline (small expand).

### Admin changes
- Migration seeds 8-12 hand-authored rules covering today's reality:
  - `manual_assignment`, `default_program`, `day_one_kickoff`, `priority_communication_top1`, `priority_intimacy_top1`, `priority_emotional_connection_top1`, `priority_friendship_top1`, `priority_family_top1`, `low_conflict_score`, `low_passion_score`, `expert_recommendation`, `partner_response_followup`.
- New admin page `app/dashboard/journey/match-rules/page.tsx` — list + edit existing rules' `label_he/en` and `rationale_he/en`. (Full builder ships in V2.)

### Analytics events
- `journey_why_this_item_revealed` — fires on tap. Props: scheduled_item_id, rule_slug, week_in_journey.
- This event tells you *which rationales users actually want to see*. High reveal rate on a rule = user trusts the rule, low rate = nobody cares about that rationale.

### Edge cases
- A scheduled_item exists but `matched_by_rule_id IS NULL` (legacy rows pre-migration) — backfill via one-time SQL: assign `legacy_unknown` rule with rationale "פריט מוקדם ביותר במסע שלכם."
- Rule deleted while items reference it — `ON DELETE SET NULL` + frontend falls back to a generic line.
- Bilingual mismatch — if `rationale_en` is empty, fall back to `rationale_he` and log a content gap.

### Rollout strategy
- Ship rules table + column + seed rules in week 1.
- Backfill historical `journey_scheduled_items` in week 2.
- Frontend disclosure goes live in week 2.
- No flag — disclosure is value-add only, can't break anything.

### V2 deferrals
- Editable rules (the no-code builder is a V2 feature; MVP only ships pre-seeded rules).
- Multiple rules contributing to one item ("matched by 3 reasons").
- A/B testing of rationale copy.

---

## MVP-03 · Pre-assessment intro screen + pact commitment

### Goal
Add one screen between "user clicks CTA on /journey" and "user sees question 1." That screen sets expectations, asks for a small joint commitment, and explains the privacy model.

### Business impact
Direct lift on assessment completion rate. Industry pattern: every major behaviour-change product (Calm, Headspace, Noom, Replika) does this. Mioshy doesn't.

### Psychological impact
Pre-commitment (Cialdini): once a couple has tapped "we agree to 10 min/week," every subsequent session is congruent with that earlier identity statement. Friction drops.

### Dependencies
- None (uses existing `journey-pact` couple context).

### DB changes
```sql
-- Migration 068_journey_couple_pacts.sql
CREATE TABLE public.journey_couple_pacts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One of these two will be set.
  couple_id                   UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id                     UUID REFERENCES auth.users(id)    ON DELETE CASCADE,
  committed_minutes_per_week  SMALLINT NOT NULL DEFAULT 10,
  committed_weeks             SMALLINT NOT NULL DEFAULT 4,
  agreed_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  agreed_by_user_id           UUID NOT NULL REFERENCES auth.users(id),
  -- Updated by a nightly cron + on every completion.
  honoured_through_week       SMALLINT,
  CHECK (couple_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE INDEX journey_pacts_couple_idx ON public.journey_couple_pacts(couple_id);
CREATE INDEX journey_pacts_user_idx   ON public.journey_couple_pacts(user_id);
```

### API changes
- New server action `recordPactCommitment()` in `app/actions/journey-pact.ts` — saves the pact row tied to whichever owner is current (couple if paired, else user).
- Read on `/my/journey` via existing `getOwnerJourneyStatus()` — extend it to return `pact: { agreedAt, weeksRemaining, honoured }`.

### Frontend changes
- New page `app/[locale]/journey/assessment/intro/page.tsx` — single intro screen, 3 sections:
  1. "10 minutes a week, for 4 weeks" — visual time/duration card
  2. "Each of you answers separately. We don't share your answers with each other." — privacy line with lock icon
  3. Pact card with one "אני בפנים" button per partner (mobile: just one button for the current user)
- Existing `app/[locale]/journey/assessment/page.tsx` — change entry: if no pact exists for this user, redirect to `/journey/assessment/intro` first.

### Admin changes
- New column on coach's "My Couples" view: pact agreed date + weeks remaining.
- New admin page `app/dashboard/journey/pacts/page.tsx` — distribution: how many pacts agreed / how many honoured through week 4 / 8 / 12.

### Analytics events
- `journey_pact_intro_viewed`
- `journey_pact_committed` — props: committed_minutes, committed_weeks, has_partner_paired
- `journey_pact_dropped` — fires if user backs out of intro without committing

### Edge cases
- User refreshes intro screen before committing — idempotent. No row created until tap.
- Couple where one partner sees intro before pairing — pact rows attach to user; on pairing, transfer to couple via a one-line UPDATE in the existing pair-handler.
- User wants to extend pact ("we want to keep going") — V2 feature; MVP only supports first pact, weeks count down forever.

### Rollout strategy
- Ship intro screen behind URL gate first (no auto-redirect). Test internally.
- Open auto-redirect to 100% in week 2.
- Monitor `pact_committed / pact_intro_viewed` rate. Target: >75%.

### V2 deferrals
- Renewable pacts.
- Variable durations (8w, 12w options).
- Pact-anniversary celebration UI ("you finished your 4 weeks together — what's next?").

---

## MVP-04 · Live assessment feedback micro-screens

### Goal
Insert 4 short reflective interstitials inside the questionnaire that show the user we're listening.

### Business impact
Drop-off inside the 29-question flow is the largest unmeasured leak in the funnel. Micro-summaries between sections halve mid-flow drop-off in published cohort studies.

### Psychological impact
Self-perception theory: the user reads "we hear that you value friendship most" → updates their self-concept slightly → engages more deeply with the next section.

### Dependencies
- None. Pure copy + 4 component instances.

### DB changes
- None. The interstitials are derived live from accumulated answers in the current session.

### API changes
- None. Client-side derivation.

### Frontend changes
- New component `components/journey/AssessmentInterstitial.tsx`.
- Inserted by `components/journey/JourneyClient.tsx` after questions q05, q12, q19, q26 (4 break points across the 29-question flow).
- Each interstitial reads the running `answers` state and emits a single one-line reflection:
  - After q05 (communication block): *"אנחנו רואים שלפעמים קשה לכם לבטא רגשות מורכבים יחד. נמשיך."*
  - After q12 (intimacy + emotional connection): *"החיבור הרגשי ביניכם מורגש. נבדוק עכשיו את הצד היומיומי."*
  - After q19 (friendship): *"אתם חברים — זה יתרון נדיר. ממשיכים."*
  - After q26 (family domain): *"הקונטקסט המשפחתי שלכם מורכב. נדע איך לעבוד איתו."*
- Each interstitial: 2 seconds visible by default + skip button + auto-advance.

### Admin changes
- None for MVP. Future: admin-editable interstitial copy keyed by section.

### Analytics events
- `journey_interstitial_viewed` — props: section_index
- `journey_interstitial_skipped`

### Edge cases
- User answers q05 then closes the tab → opens later → resumes mid-flow. Interstitials fire only on first crossing of the boundary (track in session-storage).
- Interstitial copy depends on answer pattern but no answers fit any pattern → fall back to generic ("עוד שלוש שאלות לסעיף הזה.").

### Rollout strategy
- Ship to 100% from day one. Pure copy intervention, no risk.

### V2 deferrals
- Interstitial copy variants based on answer sentiment.
- Admin-editable copy.
- A/B test of interstitial vs no-interstitial completion rate.

---

## MVP-05 · First-session screen on /my/journey

### Goal
For a user's *first* visit to /my/journey after purchase, show a single-purpose screen pointing to one action: open the day-1 item.

### Business impact
First-session bounce rate is the key leading indicator of week-1 retention. Today's /my/journey shows 6 stacked widgets to a brand-new user; that's a recipe for pasta.

### Psychological impact
Goal gradient + cognitive scaffolding. The user has just made a payment; they need to see immediate momentum on a single, achievable next step.

### Dependencies
- Day-1 unlock override (already shipped).
- MVP-02 (so the first item already has its "why this item" line).

### DB changes
```sql
ALTER TABLE public.profiles
  ADD COLUMN journey_first_session_completed_at TIMESTAMPTZ;
```

### API changes
- New action `markFirstSessionCompleted()` — sets the column when the user *opens* (not just lands on) the day-1 item.
- Read on `/my/journey` page load — branch on null vs not-null.

### Frontend changes
- `app/[locale]/my/journey/page.tsx` — at the top, branch:
  - If `journey_first_session_completed_at IS NULL` AND there's a day-1 unlocked item → render `<JourneyFirstSession item={firstItem}/>` only, hide everything else.
  - Otherwise render today's full dashboard.
- New component `components/my/JourneyFirstSession.tsx`:
  - Big wine block, 60vh
  - "ברוכים הבאים" badge
  - Item title + 2-line snippet
  - "Open" pill, 60px tall, full width
  - Below: small expert intro — "your coach is Yael, she'll be in touch."
  - Tap on Open: navigate to `/journey/timeline/[id]` AND fire `markFirstSessionCompleted`.

### Admin changes
- New column on coach's My Couples: "first session done" (✓ / ✗ / hours since signup).
- Coach can see at a glance whether a fresh sign-up has actually crossed the engagement threshold.

### Analytics events
- `journey_first_session_viewed`
- `journey_first_session_item_opened` — props: hours_since_purchase, item_slug

### Edge cases
- User pays but no day-1 item exists (assignment failed) → show fallback: "we're preparing your program — you'll have your first item within 24 hours" + email coach.
- User completes first session, then partner signs up later — only the first user gets first-session screen; partner sees normal /my/journey from start.
- User triggers first-session screen but never opens the item, leaves, returns → still sees first-session until they actually open. (Stuck-loop guarded by 7-day timeout: after 7 days of "stuck on first session," fall through to normal dashboard with a banner.)

### Rollout strategy
- Ship behind feature flag `first_session_v2`. Open to 50% in week 2, 100% in week 3.
- Compare 7-day retention between the two cohorts.

### V2 deferrals
- Personalised greeting that names the partner ("you and David...").
- Animated entrance reveal.
- Audio greeting from the assigned coach.

---

## MVP-06 · Day-1 + Day-2 reminder cascade

### Goal
A user who signs up but doesn't open the day-1 item within 24 hours gets a gentle nudge. Within 48 hours, an evening nudge.

### Business impact
First-week activation is the biggest lever on subscription month-2 retention. Users who don't open the first item rarely come back unprompted.

### Psychological impact
External commitment → action prompt → reduced friction at the *exact* moment of habit-formation. Atomic Habits' "make it obvious" rule applied to the channel where it actually matters.

### Dependencies
- Email service (existing, used for receipts).
- Optional: Web Push (deferred to V2).

### DB changes
```sql
-- Migration 069_journey_reminder_log.sql
CREATE TABLE public.journey_reminder_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_item_id UUID REFERENCES public.journey_scheduled_items(id) ON DELETE CASCADE,
  reminder_kind   TEXT NOT NULL,  -- 'd1_morning', 'd2_evening', 'd7_drift'
  channel         TEXT NOT NULL,  -- 'email', 'push'
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scheduled_item_id, reminder_kind)
);
```

### API changes
- New cron `app/api/cron/journey-reminders/route.ts` — runs hourly.
- For each user: check if (a) a day-1 item exists unopened (b) >24h since unlock_at (c) <48h since unlock_at (d) no `d1_morning` reminder logged → send.
- For each user: same logic for `d2_evening` at 48h-72h window, only if d1 didn't get them to open.

### Frontend changes
- None directly; the email link points to `/he/journey/timeline/[id]?utm_source=reminder&utm_campaign=d1`.

### Admin changes
- New column on coach's My Couples: "last reminder" (kind + age). Helps the coach see whether automation is doing its job.
- Switch to disable reminders per user (for VIPs or sensitive cases).

### Analytics events
- `journey_reminder_sent` — props: kind, channel
- `journey_reminder_clicked` — props: kind, hours_after_send

### Edge cases
- User opens item between cron runs — reminder fires anyway because cron didn't see the open. Mitigation: cron checks `seen_at` column (MVP-09) live before sending.
- User unsubscribes from email — respect existing `marketing_unsubscribed_at` flag, but reminders are *transactional*, not marketing, so document the distinction. Add a separate `journey_reminders_disabled` flag.
- Multi-day outage of email service → resume sends on recovery, but skip stale reminders (>72h old).

### Rollout strategy
- Soft launch to internal team only for 3 days.
- Open to 50%, monitor "click rate / send rate." Target: >25% on d1.
- 100% by end of week 2.

### V2 deferrals
- Web Push (instead of email) for users who granted permission.
- SMS for users in active grace state.
- AI-personalised reminder copy.

---

## MVP-07 · Expert signature on replies

### Goal
Every expert reply shows the specific expert's first name and avatar — not the generic "מיאושי" badge.

### Business impact
The user's perceived value of the human reply is what justifies the subscription price. Anonymising the expert collapses that into "I'm chatting with a chatbot."

### Psychological impact
Reciprocity + parasocial bonding. The user starts seeing Yael as *their* expert; quitting the product means quitting Yael, which is harder than quitting "the platform."

### Dependencies
- `expert_couples` table exists (migration 043).
- `profiles` table has display name + optional avatar URL.

### DB changes
```sql
ALTER TABLE public.journey_messages
  ADD COLUMN expert_signed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Backfill historical expert messages with author's identity.
UPDATE public.journey_messages
SET expert_signed_by = author_user_id
WHERE author_kind = 'expert' AND expert_signed_by IS NULL;
```

Add to `profiles`:
```sql
ALTER TABLE public.profiles
  ADD COLUMN coach_display_name_he TEXT,
  ADD COLUMN coach_display_name_en TEXT,
  ADD COLUMN coach_avatar_url TEXT,
  ADD COLUMN coach_short_bio_he TEXT,
  ADD COLUMN coach_short_bio_en TEXT;
```

(`coach_*` rather than `display_name` because the user's first/last name on `profiles` is private; the *coach persona* is what's shown to clients.)

### API changes
- `getMessages()` already returns the message rows; extend to JOIN `profiles` on `expert_signed_by` and return `expert_persona: { displayName, avatarUrl, shortBio }`.
- New action `setCoachPersona({ displayNameHe, displayNameEn, avatarUrl, shortBio })` — used by experts to manage their own coach persona on `/dashboard/profile`.

### Frontend changes
- `components/journey/timeline/PerItemThread.tsx` MessageRow:
  - Replace generic "מ" / "Mioshy" with `expert_persona.displayName` (e.g., "יעל") + their avatar.
  - First-time the user sees a specific expert: tap reveals `shortBio` (one-time, dismissible).
- `components/my/GeneralChannelThread.tsx` — same change.
- `components/my/JourneyKickoffCards.tsx` — first-session card already mentions "your coach"; populate from couple's assigned expert.

### Admin changes
- New page `app/dashboard/profile/page.tsx` for experts to set their own persona — display name, avatar (image upload via Supabase storage), short bio.
- Admin-level page `app/dashboard/experts/page.tsx` — enforce that no expert has empty persona before they start receiving couples.

### Analytics events
- `journey_expert_persona_revealed` — props: expert_id, week_in_journey
- `journey_expert_bio_opened` — props: expert_id

### Edge cases
- Expert's `coach_display_name_he` is null — fall back to "המומחה שלכם." Never reveal the expert's real name from `profiles.full_name`.
- Couple is reassigned to a new expert mid-journey — old messages keep old `expert_signed_by`, new messages get new one. UI shows "the team" badge over time gap between old/new expert messages.
- Expert leaves the platform — `ON DELETE SET NULL` on `expert_signed_by`. Frontend falls back to "your coach" generic.

### Rollout strategy
- Migrate persona fields and require non-null persona before any new expert account activates.
- Backfill existing experts' persona via admin action (give each existing expert a default persona, they can edit later).
- Frontend reveal: ship behind flag, open to 50% then 100%.

### V2 deferrals
- Audio greeting from coach (recorded per-couple on first match).
- Multiple coaches collaborating on a single couple (handoff workflow).
- Coach availability indicator ("יעל באה לחדר שלכם בערב").

---

## MVP-08 · Drift detection

### Goal
The system detects when a couple has been silent for 14+ days and surfaces it to their assigned expert with a "needs check-in" tag.

### Business impact
Cancellation almost always follows 2-3 weeks of silence. Catching drift at week 2, intervening with a real human, recovers 30-50% of would-be cancellations in published cohort studies.

### Psychological impact
The user, upon receiving a check-in from their named expert ("Yael noticed you've been quiet — is everything okay?"), experiences being seen. That single message converts more than discounts.

### Dependencies
- MVP-07 (expert persona) — drift check-in is signed by the assigned coach.

### DB changes
- No new table needed for MVP. We use existing data:
  - Last response: `MAX(created_at)` from `journey_item_responses` where user_id = X.
  - Last message: `MAX(created_at)` from `journey_messages` where author_user_id = X.
- A future `journey_couple_state` materialised view will roll this up (V2).

### API changes
- New library `lib/journey/drift.ts`:
  ```ts
  export async function getCoupleDriftState(coupleId: string): Promise<{
    state: 'active' | 'drifting' | 'silent';
    daysSinceLastResponse: number;
    daysSinceLastMessage: number;
    lastActivityAt: string | null;
  }>
  ```
- Thresholds: 0-7 days = active, 8-14 = drifting, 15+ = silent.
- Used in two places:
  1. Coach's My Couples view — colour-codes each couple card.
  2. Cron `app/api/cron/journey-drift-alerts/route.ts` — daily job that creates a low-priority notification on the assigned expert's `/dashboard/coaching` inbox when a couple crosses 14 days.

### Frontend changes
- Coach's My Couples cards get a coloured ring + label "Needs check-in" on `silent` couples.
- (User-side: nothing yet. The user doesn't see "you've drifted." The coach reaches out.)

### Admin changes
- New widget on `/dashboard/coaching` (replaces today's list view): "Drifting couples — needs your attention" — top of page, sorted by days silent.
- Click → opens Coaching Room scrolled to drift banner with two pre-filled message templates the coach can edit + send.

### Analytics events
- `journey_drift_detected` — props: couple_id, days_silent, days_since_last_response
- `journey_drift_check_in_sent` — props: couple_id, expert_id, message_length

### Edge cases
- Couple paused subscription — exclude from drift detection.
- Couple in grace state — exclude (already handled by `JourneyGraceBanner`).
- Couple has zero responses ever (just signed up, never engaged) — different bucket: "never-activated" instead of "drifting." Different intervention copy.
- One partner active, the other silent — track per-user. Show coach: "Sarah engaged 2 days ago, David silent 18 days." Different intervention.

### Rollout strategy
- Ship `getCoupleDriftState` + coach UI in week 3.
- Cron job in week 4.
- Compare cancellation rate at month-2 between cohort with and without drift intervention.

### V2 deferrals
- Auto-pause subscription at 28 days silent (require user confirmation).
- ML-driven "drift risk" prediction (predict drift before silence).
- Self-service "tell us why you're quiet" survey (lightweight, optional).

---

# PART 2 — UX Flows (state machines + screen hierarchy)

For each flow: states, transitions, screen hierarchy, decision points, empty states, emotional states, notification timing, CTA priority, failure states.

Notation: `STATE` (uppercase) for state, `→` for transition, `[Screen]` for visible surface, `<event>` for trigger.

---

## Flow A — Onboarding (visitor → activated subscriber)

### State machine

```
ANON_VISITOR
  → <click on /journey CTA>
ASSESSMENT_INTRO_PENDING
  → <commit to pact>
ASSESSMENT_IN_PROGRESS
  → <complete q29>
ASSESSMENT_COMPLETED
  → <click upgrade>
PRICING_VIEWED
  → <pay>
SUBSCRIBED_AWAITING_FIRST_SESSION
  → <open day-1 item>
ACTIVATED
```

### Screen hierarchy

```
/journey (marketing)
  └─ /journey/assessment/intro    [pact + privacy + duration]
      └─ /journey/assessment       [questions, with 4 interstitials]
          └─ /journey/assessment/result  [analysis + offer]
              └─ /pricing          [country popup → checkout]
                  └─ /billing/success
                      └─ /my/journey  (FIRST_SESSION mode)
                          └─ /journey/timeline/[id]  (first item)
                              └─ /my/journey (DASHBOARD mode, all subsequent visits)
```

### Decision points

- After assessment q29: any "made things bad" answers → route to `/journey/assessment/result/concerning` (V2 — out of scope for MVP).
- At pricing: 401 from API → route to `/auth/signup?next=/pricing`.
- At checkout success: `return_path` present → route there instead of /my.

### Empty states

- Assessment never started: marketing /journey shows only "start assessment" CTA, no resume language.
- Assessment partially done, abandoned: returning user sees "Resume from question N (you're 60% through)" on intro screen.
- Subscribed but no items materialised: first-session screen falls through to "we're preparing your program" (24h SLA).

### Emotional states

- Visitor → curious + sceptical (marketing must establish credibility, not hype)
- Intro → tentatively hopeful (pact card is the trust transfer moment)
- Assessment → reflective + slightly tired (interstitials carry mood through)
- Pricing → defensive (objections rise; tax_note + cancel-anytime soothes)
- Post-purchase → uncertain ("what now?") — first-session screen resolves this in <2 seconds

### Notification timing

- 24h after assessment completion if not paid: email "your analysis is ready, here's a summary" (V2 — defer)
- 24h after pay if first session not done: MVP-06 day-1 reminder email
- 48h after pay if still not done: MVP-06 day-2 reminder

### CTA priority

- /journey: 1 primary (start assessment), 1 secondary (login)
- intro: 1 primary (commit + start), 1 tertiary (back)
- assessment: 1 primary (next), 1 tertiary (back)
- result: 1 primary (subscribe), 1 secondary (save my analysis & exit)
- pricing: 1 primary (continue), 1 tertiary (cancel)
- first-session: 1 primary (open the item), nothing else

### Failure states

- Network error during checkout: keep user on /pricing, show inline error, retry.
- Webhook fails to materialise items: first-session screen shows "preparing your program" + emails the user when ready (V2).
- User pays but assessment was anonymous (no auth) and never linked — the audit's `assessment_missing` recovery banner handles this.

---

## Flow B — Steady-state weekly engagement

### State machine (per item, repeats weekly)

```
ITEM_LOCKED
  → <unlock_at reaches now (cron)>
ITEM_UNLOCKED_UNSEEN
  → <user opens detail>
ITEM_OPENED
  → <user declares intent>            [optional, MVP-V2]
ITEM_INTENDED
  → <couple does ritual offline>
ITEM_PERFORMED
  → <user posts response>
RESPONSE_AWAITING_EXPERT
  → <expert replies>
EXPERT_REPLIED
  → <user reacts/reads>
ITEM_CLOSED
  → <both partners marked complete>
ITEM_COMPLETED
```

### Screen hierarchy

```
/my/journey  (dashboard)
  └─ JourneyDesk → click rail entry
      └─ /journey/timeline/[scheduledId]
          ├─ Body content
          ├─ WhyThisItem disclosure
          ├─ PerItemThread
          ├─ ItemFeedbackBar (after completion)
          └─ NextItemPreview (if next is unlocked)
```

### Decision points

- Item already completed when user opens it → show "you've done this; want to revisit?"
- Item unlocks while user is *currently* in the app → soft-pulse rail, do not interrupt.
- User wants to skip an item → no skip; instead, "we'll come back to this later" reschedules (V2).

### Empty states

- No unlocked items today: rail dims, copy "next unlock: Mon 9am, in 2 days." Surface alternative engagement (review past responses, reply to expert).
- No completed items yet: activity history shows "your story will fill in here as you go."
- No expert replies yet on a thread: composer is the primary affordance; "your coach replies within 24h."

### Emotional states

- Unlock day morning: anticipation (the unlock is the moment that sells the subscription weekly)
- Mid-week: maintenance (ambient presence, not demanding)
- Sunday: reflection (recap card, low-effort)
- After expert reply: validation (this is the highest-value moment in the entire week)

### Notification timing

- 9am unlock day: in-app banner; web push if granted.
- Expert replies to a response: ambient indicator (badge), not interrupt.
- 6pm Sunday: recap card lands at top of /my/journey (no notification — pull, not push).

### CTA priority

- /my/journey dashboard: open first available item is always rank 1.
- Item detail: post a response is rank 1, react is rank 2, mark complete is rank 3.
- Recap: tap to expand is rank 1, share is rank 3 (no rank 2 — keep it minimal).

### Failure states

- Unlock cron didn't run: items appear delayed. UI shows "next unlock: …" based on actual `unlock_at`, not real-time. Self-healing.
- Expert hasn't replied within 48h: subtle "your coach is preparing a reply" line. Internal SLA breach surfaces in admin only — never to user.
- User loses connection mid-response: composer auto-saves to localStorage; restores on next visit.

---

## Flow C — Drift recovery

### State machine (per couple)

```
ENGAGED
  → <14 days no response>
DRIFTING
  → <expert sends check-in>
DRIFT_CHECK_IN_SENT
  ├─ → <user responds>           ENGAGED
  └─ → <14 more days silent>     SILENT
SILENT
  → <expert proposes pause>
PAUSE_PROPOSED
  ├─ → <user accepts pause>      PAUSED
  ├─ → <user rejects, returns>   ENGAGED
  └─ → <14 more days no answer>  AT_RISK_CANCELLATION
AT_RISK_CANCELLATION
  → admin team takes over
```

### Screen hierarchy (user-facing)

```
/my/journey  (gentle awareness, not punishment)
  └─ DriftCheckInBanner (only if state = DRIFTING+ AND expert sent check-in)
      └─ /journey/messages/[expertChannelId]
          └─ Reply or "we want to pause" CTA
```

### Decision points

- Expert auto-recommended check-in → expert reviews + sends (never auto-sends without expert click).
- User rejects pause → expert can mark "watch closely" + assigns a lighter cadence (V2).

### Empty states

- Coach's My Couples shows the drifting couple with red ring; if no other couples, show empty-state "you have 1 couple needing check-in today."

### Emotional states

- User in DRIFTING: usually feeling guilty + avoidant. Coach's check-in must NOT increase guilt. Pre-fill template avoids "you haven't logged in" — use "thinking of you both. how's life?"
- User in SILENT: often disengaged emotionally from the relationship itself. Coach's tone must be open-door, not pressure.

### Notification timing

- Drift detected at day 14: coach receives in-app alert (no email — coach checks dashboard daily).
- Drift check-in sent: user gets an email + in-app notification badge. This one DOES interrupt (the user has been away; they need a tap on the shoulder).
- Pause proposed: user gets dedicated email with single CTA "pause my subscription for X weeks" (no marketing wrapper).

### CTA priority

- DriftCheckInBanner: 1 primary (open thread), 1 secondary (dismiss for now).
- Pause-proposed email: 1 primary (pause), 1 secondary (no, I want to come back).

### Failure states

- Coach doesn't act on drift alert within 7 days: escalate to admin team.
- User opens check-in but doesn't respond: counts as engagement signal (they read it). Don't repeat-ping.
- Cron misses a day: drift detection is idempotent — the next run picks up everything still drifting.

---

## Flow D — Expert intervention (coach acts on a couple)

### State machine (from coach's perspective on a single couple)

```
COACH_OPENS_COUPLE
  → <reads context>
COACH_ASSESSING
  ├─ → <reply needed>            DRAFTING_REPLY
  ├─ → <push content>            SUGGESTING_CONTENT
  ├─ → <flag for watch>          MARKED_FOR_WATCH
  └─ → <no action needed>        DONE
DRAFTING_REPLY
  → <send>
REPLY_SENT
  → <next couple>
SUGGESTING_CONTENT
  → <pick item from library or new>
CONTENT_QUEUED
  → <admin push or schedule>
NEXT_COUCH
```

### Screen hierarchy

```
/dashboard/coaching  (My Couples)
  └─ Couple card → Coaching Room
      ├─ Left: couple file
      ├─ Centre: unified conversation timeline
      │   └─ Compose box at bottom (sticky)
      │       └─ /library quick-insert popover
      └─ Right: dashboard widgets (sparkline, scores, risk)
```

### Decision points

- Coach can: reply / push content / flag / escalate. Never: edit the couple's response, delete a message, change couple ownership.
- "Send" is two-step: draft → preview → confirm. Stops accidental sends, especially in private threads.

### Empty states

- New coach with no couples: dashboard says "you'll see your couples here when admin assigns you to a couple." No empty-state fluff.
- Couple with no responses yet: Coaching Room shows assessment summary + "your couple is in their first week. Reach out via the general channel to introduce yourself."

### Emotional states (coach's, not user's)

- New coach: anxious + uncertain. Library should be highly visible (pre-loaded with reusable templates from senior coaches).
- Veteran coach: efficient, time-conscious. Keyboard shortcuts crucial. Compose-and-send in <30 sec.
- After bad message from user (escalation): coach needs a button "consult with senior" that opens internal-only thread.

### Notification timing

- New response from user on coach's couple: in-app immediately, no email.
- New message from user on coach's general channel: in-app + email at 4h delay (gives the user time to add follow-up).
- Drift alerts: daily summary email at 8am.
- Couple paused / cancelled: immediate email with reason if available.

### CTA priority

- Inside Coaching Room: send reply is rank 1. Push content is rank 2. Flag is rank 3.
- /dashboard/coaching: open next couple needing me is rank 1.

### Failure states

- Coach hits send and network fails: draft preserved in localStorage; on retry, dedup via idempotency key (`replyClientId`).
- Two coaches reply to the same thread simultaneously (race): both sends succeed, both messages visible. Optimistic concurrency. The user just sees two replies; not catastrophic.
- Coach assigned a couple but rules say couple isn't theirs (mismatch): admin alert + read-only access until resolved.

---

## Flow E — First session (deeper than MVP-05 covers)

### State machine

```
JUST_PAID
  → <land on /billing/success>
BILLING_CONFIRMED
  → <auto-redirect after 1.8s>
FIRST_SESSION_LANDING
  → <open day-1 item>
DAY_1_ITEM_OPEN
  ├─ → <read body>          DAY_1_ITEM_READ
  ├─ → <abandon>            DAY_1_ITEM_ABANDONED
  └─ → <skip body>          DAY_1_ITEM_SKIMMED
DAY_1_ITEM_READ
  → <post response>
DAY_1_RESPONSE_POSTED
  → <expert reply>          DAY_1_EXPERT_REPLIED  ← The activation moment
```

### Notes

The activation moment is `DAY_1_EXPERT_REPLIED`. Everything in the system should optimise for getting users to that state within their first 48 hours. SLAs, automation, expert workload — all calibrated to this.

The lifetime value of a user crosses break-even somewhere around month 2-3. The single biggest predictor of crossing that threshold is whether they reached `DAY_1_EXPERT_REPLIED` in their first week.

---

## Flow F — Couple collaboration

### Concept

Today, partners are largely siloed — each has their own /my/journey. Future state: a *shared surface* showing what they've done together.

### State machine (per couple)

```
SOLO_USER (paid, partner not yet paired)
  → <invite partner>
PARTNER_INVITE_SENT
  → <partner accepts>
COUPLE_PAIRED
  → <both complete first item>
SHARED_FIRST_DONE
  → ...
```

### Screen hierarchy (V2 territory; included for context)

```
/my/journey  (single-user mode, until paired)
  → /my/journey/together  (couple-mode page; shared)
      ├─ Joint progress (items both completed)
      ├─ Shared milestones
      └─ Coach voice ("here's what I've noticed about you both")
```

### Decision points (V2)

- Whose response shows on shared surface? Only public ones. Private (`is_private=true`) responses never appear here.
- What's celebrated? Items both completed. Items only one completed are surfaced privately.

This flow is V2 because it requires deeper privacy thinking and the coach's perspective on couple-level interventions.

---

# PART 3 — Coaching Room (deep architecture)

## Mental model

The Coaching Room is the surface where one expert coaches one couple over months. It is the most important UI in the entire product because:

1. It's where 80% of coach time is spent.
2. The coach's leverage = the room's information density × decision speed.
3. Better coaches = better couple outcomes = lower churn = higher LTV.

The room is built on these analogies:

- **Linear** — for keyboard-driven speed. Every action has a shortcut. Cmd-K opens command palette.
- **Notion** — for soft information surfaces. Sparklines, panels, freeform notes embedded in the page.
- **Intercom** — for the conversation as the centre of gravity. The thread *is* the page.

But the room is for *relationship coaching*, which adds its own constraints. A great coach session is not a fast support ticket. It's contemplative. The UI must support both modes: rapid triage (when the coach has 20 couples to scan) and slow attention (when one couple needs deep care).

---

## Layout system

### Desktop ≥1280px — three-column

```
┌────────────┬──────────────────────────┬──────────────┐
│ COUPLE     │   CONVERSATION TIMELINE  │   DASHBOARD  │
│ FILE       │                          │   WIDGETS    │
│ (sticky)   │                          │   (scroll)   │
│ 280px      │   flex-1                 │   320px      │
│            │                          │              │
│            │                          │              │
│            │                          │              │
│            │   ┌────────────────┐     │              │
│            │   │ COMPOSE        │     │              │
│            │   │ (sticky bottom)│     │              │
│            │   └────────────────┘     │              │
└────────────┴──────────────────────────┴──────────────┘
```

### Tablet 768-1279px — two-column

Right column collapses into a top accordion. Couple file remains left-sticky.

### Mobile ≤767px — single column with mode tabs

```
┌──────────────────────────────────────┐
│ ←   Couple Name        [details ▾]   │  sticky header, taps reveal couple file
├──────────────────────────────────────┤
│ [Conversation] [Dashboard] [Notes]   │  segmented control
├──────────────────────────────────────┤
│                                      │
│   active mode content                │
│                                      │
└──────────────────────────────────────┘
│  COMPOSE (sticky, only on Conv tab)  │
└──────────────────────────────────────┘
```

---

## Information hierarchy

Within each column, the order is:

### Couple file (left, top-to-bottom)

1. **Identity strip** — names, age, partnership length, kids, location (small)
2. **Status pill** — Active / Drifting / Silent / Paused
3. **Pact** — committed weeks, weeks remaining, honoured status
4. **Top focus** — current priority area
5. **Score snapshot** — 3 bars (friendship, conflict-handling, passion-risk) with deltas vs. assessment baseline
6. **Quick links** — assessment answers, full timeline, pause/cancel toggles
7. **Coach's note** — freeform markdown the current coach can edit

### Conversation timeline (centre, top-to-bottom, newest at bottom)

A unified, chronological feed of:

- User reflections on items (with the item title as anchor)
- User general channel messages
- Coach replies (signed)
- System events:
  - Item unlocked (small line, low contrast)
  - Item completed (with confetti only in the user's view, never here)
  - Assessment retake submitted
  - Pact agreed / drifting threshold crossed
  - Reaction added by user

Filter pills above the feed: `All / Needs me / Sent / This week / This couple's milestones only`.

### Dashboard widgets (right, top-to-bottom)

1. **Engagement sparkline** — 8-week response count
2. **Scores over time** — line chart, 3 series, baseline + retakes
3. **Item heatmap** — 5×N grid of items × completion state per partner
4. **Risk indicators** — colour-coded panel, no count: just lit if condition met
5. **Couple-level notes** — coach's running notes for this couple (markdown, edit-in-place)
6. **AI suggestions** (V2) — see Part 5

---

## Widgets (detailed)

### W-1 — Engagement sparkline

- 8-week rolling response count
- Two lines (one per partner) overlaid in different shades
- Hover/tap reveals exact counts
- A red dot below each week with zero responses

### W-2 — Score evolution

- Three lines: friendship, conflict-handling, passion-risk
- X-axis: assessment retake events (could be 1-3 points over a year)
- Initially flat after first assessment; meaningful only after first retake
- Hover reveals delta + which questions changed

### W-3 — Item heatmap

- 5 columns (recent 5 weeks), N rows (items in each week)
- Each cell: ⬛ unopened / ▫ opened-not-completed / ✓ completed (colour-coded per partner)
- Quick visual scan reveals "Sarah is doing the work, David hasn't opened anything in 2 weeks"

### W-4 — Risk indicators

A static list of conditions. Only the lit ones are visible; unlit ones occupy zero space.

```
🟡 Engagement gap >40% between partners (David 12% vs Sarah 80%)
🟡 No response in 11 days
🔴 Negative sentiment in last 2 responses
🟢 Pact honoured through week 4 (low risk)
```

Tap on a lit indicator → scrolls timeline to the originating event.

### W-5 — Coach's notes

Markdown editor, autosaves on blur. Visible to: this coach, admin, future coaches assigned to this couple. Not visible to user.

### W-6 — AI assistance (V2-V3)

When a user response arrives, AI drafts a reply. Coach reviews, edits, sends. Three modes:

- **Suggest a response** — reply draft based on item context + couple history
- **Suggest a content push** — top 3 items the AI thinks fit this moment, with reasoning
- **Summarise the past 4 weeks** — for coaches returning after vacation or first opening a new couple

---

## Quick actions

A `/` command palette (Linear-inspired) with these actions:

- `/reply` — focus compose
- `/push <item>` — open item picker, schedule push
- `/note` — focus coach notes
- `/flag` — flag for watch (next time the couple opens app, expert sees a banner)
- `/escalate` — open internal thread with senior expert
- `/pause` — propose pause to user
- `/library` — search saved replies
- `/score` — show score history modal

Keyboard shortcuts:

- `Cmd-K` — command palette
- `Cmd-Enter` — send compose
- `Esc` — close compose / preview
- `J/K` — next/previous couple in My Couples
- `R` — focus compose (reply)
- `?` — show all shortcuts

---

## Risk surfacing

The riskiest moments in any couple's journey:

1. **Silence after a vulnerable response** — user shared something hard, no follow-up
2. **Asymmetry crossing threshold** — engagement gap >40% sustained 14 days
3. **Negative sentiment streak** — 3+ responses with negative-tagged sentiment
4. **Pact failure** — committed to 4 weeks, week 4 came with no engagement
5. **Cancellation signals** — visited /account/cancel without confirming

Each surfaces in W-4 with a specific colour + a one-tap intervention. Never auto-acts; always coach-confirmed.

---

## Intervention workflows (deep)

### Intervention: send a check-in

1. Coach sees couple in "Drifting" state on My Couples
2. Click → Coaching Room opens scrolled to drift banner
3. Banner has 2 pre-written templates: warm + neutral. Coach edits.
4. Preview → confirm → send.
5. Audit log entry: drift_check_in_sent, kind=warm, message_id=X.

### Intervention: push content out-of-cadence

1. Coach reads a response, decides "they need item conflict-recovery-303"
2. `/push` opens picker. Filters: by category, by tag, by length.
3. Coach picks item. Schedule modal: now / next Monday / specific date.
4. Confirm → creates a `journey_assignments` row (source_kind=item, origin=admin_manual) + materialises immediately.
5. User receives unlock notification within minutes (or on schedule).

### Intervention: escalate to senior expert

1. Coach hits `/escalate`
2. Modal: "describe what you'd like input on" — markdown.
3. Submits → creates an internal thread visible only to senior experts + this coach.
4. Senior coach replies in dashboard.
5. Resolution: original coach acts on the senior's input. Internal thread archived.

### Intervention: assessment retake

1. Coach decides couple needs to re-anchor (e.g., big life event mentioned in responses).
2. Click "Request retake" in Coaching Room.
3. User sees retake banner on /my/journey.
4. After completion, scores update + cadence engine re-evaluates priority weighting.

---

## Timeline architecture

The conversation timeline is the central view. Architecture:

- **Source:** unified query JOIN-ing `journey_item_responses`, `journey_messages` (per-item + general channel), and `journey_assignments` event log.
- **Sort:** `created_at` ASC (or DESC depending on user preference; default ASC for coaching context — read top-to-bottom narrative).
- **Pagination:** virtual scroll, 50 events per page. Older events lazy-load on scroll-up.
- **Anchoring:** when navigating from a notification, scroll to the originating event with highlight ring.
- **Search:** full-text on bodies, narrowed by date range. (Algolia or pg_trgm — V2.)
- **Export:** Cmd-Shift-E exports the full conversation as PDF for the coach's records (V2).

---

## Collaboration model between coaches

- **Default:** one coach per couple, exclusive ownership.
- **Handoff:** admin can reassign couples; old coach retains read-only on past messages, no write.
- **Coverage** (V2): when a coach is on vacation, admin assigns a backup. Backup sees the couple in their My Couples with a yellow "covering" badge. Original coach gets a digest on return.
- **Internal collab:** the `/escalate` thread is the only place two coaches converse on the same couple. Never inside the user-facing thread.
- **Audit:** every action by a coach is logged in `coach_audit_log` (table to add in V2). Compliance + post-mortem use.

---

# PART 4 — Match Rules Engine (full design)

## Overview

The matching engine is the layer that decides *which content reaches which user when*. Today it's distributed across three files (`auto-assign.ts`, `cadence-engine.ts`, `priority-routing.ts`) with no central authority.

This part designs a **declarative rules engine** — a place where business logic lives in data, not code, and can be edited by non-engineers.

## Architectural principles

1. **Rules are data, not code.** Every rule is a row in `journey_match_rules`. Editing a rule is a database write, not a deploy.
2. **Rules are explainable.** Every match decision links back to the rule that caused it (`matched_by_rule_id`).
3. **Rules are simulatable.** Before activating a rule, the author can dry-run it against the current population and see who would be affected.
4. **Rules conflict gracefully.** When multiple rules fire for the same context, an explicit priority + a deterministic tie-breaker resolves it.
5. **Rules are A/B-testable.** Two rules can be alternatives; the engine assigns a stable variant per couple.

---

## DSL structure

The DSL is JSON, not a custom language. Rationale: easy to validate, easy to render in UI, no parser to maintain.

### Schema

```ts
type Rule = {
  id: string;
  slug: string;                 // unique, human-readable
  label_he: string;
  label_en: string;
  rationale_he: string;         // shown to user via "Why this item"
  rationale_en: string;

  when: Condition;              // the matching predicate
  then: Action;                 // what to do

  priority: number;             // higher = evaluated first
  is_active: boolean;
  ab_variant?: string;          // nullable; rules with same `slug` but different `ab_variant` form a test
  ab_weight?: number;           // 0-100, sums to 100 across variants

  created_by: string;
  created_at: string;
  updated_at: string;
};

type Condition =
  | { kind: 'and'; conditions: Condition[] }
  | { kind: 'or'; conditions: Condition[] }
  | { kind: 'not'; condition: Condition }
  | { kind: 'priority_top'; n: 1 | 2 | 3; equals: PriorityKey }
  | { kind: 'score_below'; axis: 'friendship' | 'conflict' | 'passion'; value: number }
  | { kind: 'score_above'; axis: 'friendship' | 'conflict' | 'passion'; value: number }
  | { kind: 'days_since_signup'; gt?: number; lt?: number }
  | { kind: 'days_since_last_response'; gt?: number; lt?: number }
  | { kind: 'completed_count'; category_slug?: string; gt?: number }
  | { kind: 'reaction_received'; emoji: string }
  | { kind: 'feedback_rating'; rating: 'helpful' | 'not_for_us' | 'made_things_worse' }
  | { kind: 'has_partner_paired' }
  | { kind: 'item_completed_count'; item_slug: string; gt: number }
  | { kind: 'engagement_gap_above'; partner_pct_diff: number };

type Action =
  | { kind: 'schedule_item'; item_slug: string; offset_days: number }
  | { kind: 'boost_category'; category_slug: string; multiplier: number }
  | { kind: 'suspend_cadence'; for_days: number }
  | { kind: 'notify_expert'; severity: 'info' | 'warn' | 'urgent'; reason: string }
  | { kind: 'reveal_milestone'; milestone_slug: string }
  | { kind: 'set_couple_state'; state: 'active' | 'drifting' | 'silent' | 'celebrating' };
```

### Example rule (week-1, communication priority)

```json
{
  "slug": "comm_priority_w1_kickoff",
  "label_he": "תקשורת — שבוע ראשון",
  "label_en": "Communication priority — week 1",
  "rationale_he": "בחרתם תקשורת כעדיפות #1, אז שבוע ראשון מתחיל בתשתית של תקשורת בריאה.",
  "rationale_en": "You chose communication as priority #1, so week 1 starts with the foundation of healthy communication.",
  "when": {
    "kind": "and",
    "conditions": [
      { "kind": "priority_top", "n": 1, "equals": "communication" },
      { "kind": "days_since_signup", "lt": 7 }
    ]
  },
  "then": {
    "kind": "schedule_item",
    "item_slug": "comm-foundation-101",
    "offset_days": 1
  },
  "priority": 100,
  "is_active": true
}
```

---

## Rule builder UX

The builder is the most important UI in this whole engine. If non-technical people can't use it, the engine is theatre.

### Visual approach: stacked cards

The user builds a rule by stacking visual blocks:

```
┌──────────────────────────────────────────┐
│ When (all of these are true):            │
│                                          │
│   • Their #1 priority is [Communication] │  ← dropdown
│   • Days since signup is [less than][7]  │  ← op + input
│   [+ Add condition]                      │
│                                          │
│ Then:                                    │
│                                          │
│   Schedule item [comm-foundation-101]    │  ← item picker
│   Offset: [1] days from anchor           │
│                                          │
│ User-facing rationale:                   │
│   [textarea per locale]                  │
└──────────────────────────────────────────┘
[Save as draft]  [Simulate]  [Activate]
```

- **No regex.** No "advanced mode."
- **Every field has a tooltip** with a real example.
- **Live count of affected couples** below the conditions ("This rule would currently match 47 couples").

### Templates

The builder ships with ~20 pre-built rule templates:

- Priority-top routes (one per priority)
- Score-threshold routes
- Drift recovery
- Engagement gap recovery
- Pact-honoured celebration
- Negative-feedback diversion
- Etc.

The author picks a template, customises 1-2 fields, saves. Most rules will start from a template.

---

## Evaluation priority + conflict resolution

### Order

When the cadence engine runs for user U at time T, it:

1. Loads all `is_active=true` rules.
2. For each rule, evaluates `when` against U's current state at T.
3. Collects all matched rules.
4. Sorts by `priority DESC`, ties broken by `created_at DESC`.
5. Walks the sorted list, applying actions in order, with conflict resolution:

### Conflict resolution

- Two rules schedule different items for the same anchor offset → keep the higher-priority rule's item, log the loser.
- A `suspend_cadence` rule fires → all subsequent `schedule_item` actions for the suspension window are skipped.
- A `reveal_milestone` rule fires regardless of cadence suspension (milestones are independent of content cadence).

The engine emits a structured trace per evaluation:

```json
{
  "evaluated_at": "2026-05-08T09:00:00Z",
  "user_id": "...",
  "rules_evaluated": 47,
  "rules_matched": 4,
  "rules_applied": 2,
  "rules_skipped": [
    { "rule_id": "...", "reason": "lower_priority_conflict_with_other_schedule" }
  ]
}
```

This trace is stored per evaluation and viewable in admin.

---

## Explainability layer

Every `journey_scheduled_items` row carries `matched_by_rule_id`. The user-facing surface (MVP-02) renders the rule's `rationale_*`.

But the admin needs more. The Coaching Room widget "Why this couple has these items" lists:

```
✓ comm_priority_w1_kickoff       → comm-foundation-101 (week 1)
✓ default_program                → conn-week2-warmup (week 2)
✗ low_conflict_score_alert       → would have triggered conflict-recovery-303
                                   but was suspended by pact_first_week_protect
```

Even non-firing rules are surfaced if their `when` was *almost* matched. This is the debugging tool.

---

## Simulation mode

Before saving a rule as `is_active=true`:

1. Author hits "Simulate."
2. System runs the rule against a snapshot of the *current* couple population.
3. Output: list of couples that would be affected, with a per-couple preview ("for couple #1234, this rule would schedule X on Monday, replacing Y").
4. Author can reject, refine, re-simulate, or activate.

Simulation is a read-only path; no side effects. Implemented as a parallel evaluation pass with `dry_run=true` flag in the engine.

---

## Debugging tools

For when a rule misbehaves in production:

- **Rule trace view** — for any couple, show the trace of every rule evaluation in the past 30 days. Why was this item scheduled? Why was that one not?
- **Rule-affected list** — for any rule, show the couples it has affected and the outcomes (completion rate of items it scheduled, vs. baseline).
- **Replay mode** — re-evaluate a rule against historical state of a couple at a past timestamp. Useful when a coach asks "why did the system do X two weeks ago?"

---

## Analytics

For every rule:

- Couples matched (rolling 28d, 90d)
- Items scheduled by it
- Of those items: completion rate, response rate, feedback rating distribution
- A/B variants comparison if applicable

The "rule health dashboard" surfaces:

- Rules that are matching nobody (probably broken or obsolete)
- Rules whose scheduled items have <20% completion (probably bad content fit)
- Rules with negative feedback skew (probably wrong intervention timing)

---

## A/B infrastructure

Two rules with the same `slug` and different `ab_variant` form a test. `ab_weight` (0-100) sets the split.

Assignment is **stable per couple**: hash(couple_id + slug) → variant. Same couple always gets the same variant. (No "user lottery" between weeks.)

The engine tracks per-variant metrics. When a variant clearly wins (statistical significance + minimum 100 couples per arm), an admin can "promote winner" — the losing variant goes inactive, the winner becomes the canonical rule.

---

## AI-assisted rule creation (V3)

Once the rule corpus has 50+ active rules and 12+ months of trace data, we can train:

1. An LLM-driven rule suggestor: "based on these 20 couples who churned at week 8, here's a candidate rule that might have helped them."
2. A semantic similarity matcher: "your new rule looks 87% similar to `existing_rule_X`. Are you duplicating?"
3. Rationale auto-author: "given this `when`/`then`, here's a draft rationale in HE and EN."

These are V3 features. They depend on having a healthy rule corpus, which is a V2 deliverable.

---

# PART 5 — AI Strategy

## Where AI generates real leverage

### A1. Coach reply drafts (V2)

Highest leverage. Coaches spend 60-70% of their time on response writing. Cutting that to 30% (with AI drafts that coaches edit) doubles their capacity without diluting voice quality.

**Approach:** retrieval-augmented generation. Inputs: this couple's full state, the user's response just received, the past 3 expert replies in their thread (style anchor), the assigned coach's saved-reply library.

**Deployment:** drafts only. Coach must edit + approve. No auto-send. Ever.

### A2. Auto-summarisation for coaches (V2)

When a coach opens a couple they haven't touched in 2 weeks, they should not read 30 events. They should read a 4-line summary, then dive into the events that matter.

**Approach:** summary regenerated on-demand or weekly. Caches the past N events into a structured digest.

**Output structure:** "Since you last reviewed: 3 responses on [items], 2 reactions, expert reply count: 1. Notable: [the most emotionally significant event]."

### A3. Sentiment + theme tagging on responses (V2)

Auto-tag every user response with:

- Sentiment (positive / mixed / hard / concerning)
- Themes mentioned (intimacy / conflict / family / work / life event / etc.)

Coach can filter by these tags. Risk indicators in W-4 fire on tag patterns.

**Approach:** small classifier, not LLM. Cheaper, faster, more predictable. Calibrated against expert-tagged training set.

### A4. Match rule suggestion (V3)

Once rule corpus is healthy, AI suggests new rules based on observed patterns ("couples ranking communication first AND scoring <40 on conflict-handling have 12% lower 4-week retention; here's a candidate intervention rule").

### A5. Content gap detection (V3)

AI scans the rule corpus + content catalog and identifies gaps: "no rule fires for couples with priority=family AND children_age>10. Consider authoring content for this segment."

---

## Where AI must NOT be used

### N1. User-facing chat replies

The expert voice IS the product. The moment the user suspects they're chatting with a bot, the perceived value collapses to zero, and there is no recovery.

This is non-negotiable. Even if we could ship a model that's "as good as" a human reply, we wouldn't, because trust is asymmetric — one bot-feeling message costs more than 100 great human ones earn.

### N2. Auto-send anything

No outbound message — to user or coach — is generated and sent without a human approval click. AI proposes; humans dispose.

### N3. Auto-assignment of couples to coaches

Match couples to coaches based on coach specialty + couple need profile — but only as a *suggestion* to the admin. Final assignment is human-confirmed.

### N4. Crisis response

If a user response trips a "concerning" classifier (mentions of self-harm, abuse, etc.), the system MUST surface to a senior coach immediately — never to AI for response generation. AI-generated responses to crisis are a litigation event waiting to happen.

### N5. Generated content items

Mioshy's content is the IP. Author it carefully. Don't let AI generate user-facing rituals or prompts. Quality control is impossible at scale and content is the product.

---

## Preserving "human expert" feel

Three protections:

1. **Per-coach signature.** Every reply visibly signed by a specific named expert (MVP-07). The product's social fabric depends on the user knowing they have *a* coach, not "the system."
2. **Coach voice protection.** AI drafts learn from this coach's history, but the coach edits before sending. Each coach's voice grows distinct over time, not converges to model defaults.
3. **Strategic latency.** Replies don't ship in 4 minutes. Replies ship within 24 hours. Even if the coach is faster, the system holds for at least 90 minutes before delivering — preserves the perception of considered response.

---

## Coach acceleration without replacement

Pattern: AI shows the coach what to look at; coach decides what to do. Always.

Concretely:

- AI surfaces 3 couples the coach should prioritise today (ranked by risk + opportunity)
- AI summarises the past 7 days for any couple in one card
- AI drafts a reply when the coach hits compose
- AI suggests 3 content items when the coach hits push
- AI flags concerning patterns the coach can act on

Across these, the coach's role is unchanged: human judgement, human voice, human decision. The coach gets faster, more thorough, less fatigued — but every output is theirs.

---

## Data to start collecting NOW (for future AI training)

If we want to train models in 12 months, we need clean data starting today.

### Must capture (start in MVP)

- **Per-item feedback rating** (MVP-01) — labels for "did this content work for this couple?"
- **Coach send drafts vs. final messages** (V2 prep) — store drafts even when discarded; trains the draft model later
- **Coach action timestamps** — when coach opened couple, when sent message, when used quick action; trains the prioritisation model
- **Couple state transitions** — every Active → Drifting → Silent → Paused → Active transition logged with timestamp and inferred cause

### Should capture (V2)

- **Sentiment hand-tags** (V2) — coaches manually tag a sample of responses; bootstraps sentiment classifier
- **Reply sentiment self-rating** — coaches rate their own replies on "warmth / clarity / depth" 1-5; trains style models
- **Cancellation reasons** — short structured cancel survey; rare but high-signal

### Nice to have (V3)

- **Full-text search corpus** — pg_trgm or external; enables retrieval-augmented generation
- **Coach success metrics** — couple retention by coach, normalised; identifies high-performing coach styles to learn from

### Storage strategy

- All AI training data lives in a separate schema (`ai_training`) with explicit consent management.
- Every user can export or delete their own AI-training contributions (GDPR + dignity).
- Coaches can opt out of having their drafts contribute to training.

---

# PART 6 — Prioritization

## Quick wins (next 4 weeks, low risk, high impact)

1. **MVP-01 — per-item feedback** — schema add + 4 buttons. Highest infra ROI of the eight.
2. **MVP-04 — assessment interstitials** — pure copy. Ship in 3 days.
3. **MVP-07 — expert signature** — schema add + reveal. The "מיאושי is a bot" perception ends here.
4. **MVP-02 — Why this item** — schema add + 12 hand-authored rules + display. Visibility transformation.

These four can ship together in week 1-2. They unblock everything downstream and they're each reversible.

## High leverage (4-12 weeks, larger investment, structural payoff)

1. **MVP-05 — first-session screen** — moves the activation needle.
2. **MVP-06 — reminder cascade** — direct retention lift.
3. **MVP-08 — drift detection** — direct cancellation prevention.
4. **MVP-03 — pact commitment** — needs schema, intro screen, admin surfacing. Worth the work.
5. **The Coaching Room** (V2) — biggest leverage on coach productivity. Three-column UI is a 6-week build.
6. **The Match Rules Engine — full builder + simulator** (V2) — non-tech rule editing is the unlock for product agility.

## Dangerous complexity (avoid for now, even if tempting)

- **AI-generated user-facing content.** Tempting because it solves the content authoring bottleneck. Skip — voice integrity is core IP.
- **Automatic couple-coach matching.** Tempting because manual matching is admin labour. Skip — matching errors are expensive to recover from. Build the suggestion UI first.
- **Real-time messaging (websockets).** Tempting because chat-feels-instant is industry standard. Skip — async-with-24h-SLA is the *product*. Real-time would destroy the "considered response" feel.
- **Mobile native app.** Tempting because mobile engagement is high. Skip — well-designed PWA covers 95% of use cases at 5% of the cost. Web push covers reminders.
- **Rebuilding journey_v3 → v4 schema.** The current schema is good. Don't refactor it; add columns and tables alongside.

## Not worth the time right now

- Multi-language beyond HE/EN. Don't add until HE+EN have product-market fit individually.
- Custom assessment authoring (admin-defined questions). The 29-question fixed assessment is more than enough for first 1000 couples.
- Group cohort features beyond the existing schema. Cohorts are a corporate-wellness play; consumer first.
- Subscription bundles ("year-long discount, premium tier"). Single-price simplicity wins until you have 10k subscribers.
- Streak counters, points, badges. Already discussed — wrong tool for this product.

## Critical before scale (>1000 active couples)

- **Materialised views for coach dashboards.** Today's queries do live aggregation. At 1000 couples + 5 years of data, dashboards will time out. Must precompute.
- **Async expert reply queue with SLA timers.** Today coaches see who needs a reply via the inbox. At scale, you need explicit SLA tracking + alerts.
- **Backup coach assignment.** When a coach is on vacation, their couples need coverage. No-coverage causes drift.
- **Rate limiting on user response submissions.** Prevent accidental floods.
- **Structured cancel flow.** Pause / discount / talk-to-human routes. Today there's just cancel.
- **Couple data export.** GDPR/CCPA compliance.
- **Audit log on coach actions.** Compliance + post-mortem.
- **Per-coach SLA dashboards for management.** Today no admin can see "coach X has 8 replies overdue."

## What to fake first

- **Rule builder UI** — start with a forms-only editor on the 12 hand-coded rules. Build full builder when there are >30 rules.
- **AI reply drafts** — start with templated suggestions ("would you like to send: 'a check-in,' 'a content push,' 'a reflection prompt'?"). Add real LLM later.
- **Couple state model** — start with a function `getCoupleState(coupleId)` that computes from raw tables. Add the materialised `journey_couple_state` only when load demands it.
- **A/B testing on rules** — start with a single-variant model. Add A/B infrastructure when there are >5 candidate rule pairs.
- **Drift recovery automation** — start with a manual coach action ("send a check-in to this couple"). Add cron later.

This faking discipline is the difference between shipping and over-engineering. Almost every "system" in V1 should be a function. Almost every "table" should be a materialised view. Almost every "engine" should be a `if/else`. Build the abstraction when the simple version genuinely strains under real load.

---

# Closing

The schema you have is correct. The engineering is solid. The structural product gaps are:

1. The system is opaque — fix with MVP-02 + the Match Rules Engine
2. The expert is anonymised — fix with MVP-07 + Coaching Room
3. The matching is hard-coded — fix with the Rules Engine (V2)
4. The coach is overworked — fix with AI assistance (V2-V3)
5. The user is alone — fix with first-session, reminders, drift recovery (MVP)

Build the MVP in 4 weeks (Part 1). Build the Coaching Room and Rules Engine in V2 (Parts 3-4). Add AI as the multiplier in V3 (Part 5). Don't skip steps — each layer makes the next one possible.

The final dimension that nothing in this document can teach: **Mioshy will succeed when its couples can articulate why Mioshy works for them**, not because of marketing copy, but because the experience itself made them say "this thing helped." Every architectural decision should ladder up to that sentence being true for one more couple.
