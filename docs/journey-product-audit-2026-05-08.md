# Journey — Deep Product Audit

**Date:** 2026-05-08
**Author:** Product+UX deep-audit
**Scope:** Mioshy Journey content-delivery system (v3 shipped 2026-05-02)
**Audience:** Itzik (founder), future Head of Product, future product designer

---

## TL;DR

Journey already has a strong technical spine: polymorphic assignments, per-item threads, priority ranking, day-1 unlock override, cadence engine scaffolding. Where it falls short — and what this audit addresses — is **product clarity**. Three structural problems block scale:

1. **No "why this content" surface.** The user sees an item appear in their timeline with zero explanation of why it was selected for them right now. The expert sees the same opacity from the other side: there's no readable trail from "user's assessment answers + priorities + history" → "this item, this week."
2. **The expert is a triage worker, not a coach.** Today's admin dashboards optimise for inbox throughput (response queues, status dropdowns). Coaches don't think in inboxes — they think in *clients* and *interventions*. The data model supports better, the UI doesn't expose it.
3. **The matching engine is a black box.** Content selection is split across `cadence-engine.ts`, `priority-routing.ts`, `auto-assign.ts`, with overrides scattered. There's no place where a coach (or Itzik) can say "this user always gets the conflict-recovery thread first" without writing code.

Every recommendation below ladders up to one of these.

---

## 1. Product Analysis

### What Journey actually is, in plain terms

A subscription product that, after a one-time questionnaire, drips relationship-coaching content to a couple over time. Each piece of content is a small ritual ("ask your partner X," "do this together," "notice this in yourselves"). The user reflects in writing inside the platform. A human expert from the Mioshy pool reads those reflections and replies inside a private thread tied to that specific content piece.

So it's three things stacked, and the design has to keep all three legible:

- **A content engine** — picks the right item at the right time
- **An asynchronous coaching channel** — turns reflections into a real dialogue
- **A progress narrative** — gives the couple a sense that "we're moving"

### What's strong today

- The data model is correct. Polymorphic owner (user XOR couple), separate "what is assigned" vs "what was materialized into the timeline," reactions as JSONB, append-only responses. These are decisions that aged well.
- The pre-launch trim — removing 3 family-domain questions and rebuilding the assessment — was the right call. 29 questions is at the upper edge of acceptable; 32 was too long.
- The day-1 override is a critical UX win. Without it, a paying user lands on /my/journey and sees "your first item unlocks in 1 day," which is fatal on day zero.
- The wine-on-dark visual identity (post-B11) finally feels like a coherent product, not a Tailwind starter.

### What's structurally weak

- **Content origin is invisible.** The user can't see "this item was picked because you ranked communication #1 and your conflict-handling score is 42." They just see an item title.
- **Expert effort doesn't compound.** Every reply lives inside the thread it was written in. There's no notion of "expert wrote a great response to this scenario in another couple's thread three weeks ago — surface it."
- **No couple-level state model.** The user-level `journeys` table tracks status, but there's no "couple is at week 3, focus area is intimacy, last engagement 4 days ago, drift risk = medium" object. Every dashboard reconstructs this on the fly.
- **Assessment is a one-shot.** The system never re-asks. Six months in, the user's relationship may look completely different from the day they signed up — but the content engine is still anchored to that initial ranking.
- **Cadence engine is half-built.** Slice 3 has the schema (groups, settings, delivery_days) but the actual cron isn't wired. Right now content unlocks via static `default_offset_days` from purchase date — fine for week 1, broken by week 12.

---

## 2. UX Problems (current user flow)

Tracing the user from `/journey` marketing → first reflection on a content item, here are the friction points in order:

### P-1. Marketing-to-assessment handoff is a dead drop

Today: user reads `/journey`, clicks CTA → lands directly on a 29-question assessment with no warm-up. The first screen is a question, with no greeting, no "before we begin," no idea how long it will take.

**Why it matters:** Assessment completion rate is the gate to *everything*. Every percent lost here multiplies through the funnel.

### P-2. The questionnaire feels like a form, not a conversation

Today: question → response → next. No commentary, no "we hear you," no signal that the answer changed the system's understanding.

**Why it matters:** The user is paying for personalisation. If the assessment doesn't feel personalised, the rest of the product can't feel personalised either.

### P-3. Post-purchase landing is overwhelming

Today: `/my/journey` shows kickoff cards (B11.5), rail, desk, activity history, priority ranking, expert channel — six surfaces stacked vertically. A new user has no idea what to do first.

**Why it matters:** First-session bounce on `/my/journey` is the highest-stakes UX moment in the entire product. The user just paid. They want to feel that paying was correct.

### P-4. "Why this item?" is missing everywhere

Today: items appear in the timeline with title + body. No explanation of why this one, why now, why for this couple.

**Why it matters:** Personalisation that you can't see isn't experienced as personalisation. It's experienced as "the website gave me a thing."

### P-5. The expert's voice has no fingerprint

Today: a reply from the expert appears in the thread with a small avatar circle ("מ") and the label "מיאושי." It reads like a chatbot.

**Why it matters:** The single most expensive thing in this product is human expert time. If the user can't tell whether they're talking to a real person, the perceived value of that human collapses.

### P-6. No feedback loop on content quality

Today: reactions on messages exist (heart, thinking, etc.) but reactions on *content items themselves* do not. The user can say "this reply helped" but not "this content was useful / not for us / made things worse."

**Why it matters:** Without per-item feedback, the matching engine can't learn. Every user is treated like a fresh installation forever.

### P-7. Timeline gaps feel like absence, not pacing

Today: item unlocks Mon, next one Mon a week later. In between, the user has nothing to do on the platform.

**Why it matters:** Six days of silence on a paid product is what cancellations are made of. There must be *something* worth opening the app for in between unlocks — even if it's review, reflection prompts, or partner check-ins.

### P-8. Partner asymmetry is hidden

Today: when a couple uses the product, each partner has their own /my/journey but neither one sees the other's progress.

**Why it matters:** A relationship product whose explicit theory is "shared work" but whose implementation hides the partner's state is fighting itself. The two partners need a *shared surface* showing what they've done together.

---

## 3. UX Opportunities (psychological + engagement levers)

These are organised by what behavioural mechanism they activate.

### O-1. **Commitment anchoring** — onboarding pact

Before the assessment starts, ask the couple to make a small joint commitment: "We agree to spend 10 minutes a week on this for 4 weeks." Two thumbs-tap to confirm. Saves a `journey_couple_commitments` row.

**Why it works:** Pre-commitment is the single best-evidenced lever in behavioural change literature. Costs nothing, lifts completion materially.

**Surface in expert dashboard:** Show the commitment date and "weeks remaining in initial pact" at the top of the couple's coach view. Gives the coach a natural conversation opener at week 4.

### O-2. **Variable-ratio reinforcement** — personalised surprises

Every 3rd or 4th unlock, insert one item that wasn't on the predicted path — a "your expert thought of you this week" piece. Marked with a different visual treatment.

**Why it works:** Predictable schedules create habituation. Occasional unpredictability re-engages attention. The whole gambling industry is built on this.

**Implementation:** A new `journey_items.is_surprise` flag + a cadence rule that selects from `is_surprise=true` once every N deliveries.

### O-3. **Loss aversion** — streak gentleness

Show "you and your partner have been showing up for 3 weeks" with a small marker, not a counter. Avoid streak-counting (which creates anxiety when broken). Instead, frame it as continuity recognition.

**Why it works:** Loss aversion lifts retention but harsh streaks (Duolingo-style) create the opposite effect on a couples product — guilt undermines the relationship the product is supposed to repair.

### O-4. **Identity reinforcement** — "the kind of couple who…"

Every 4th completed item, surface a one-line identity statement: "You're the kind of couple who talks about hard things on purpose." Pull from a curated list, signed by the expert.

**Why it works:** Identity-based motivation outperforms outcome-based motivation in repeated-behaviour contexts (Atomic Habits, BJ Fogg). A couple working on their relationship needs an identity to grow into.

### O-5. **Asymmetric visibility** — partner whisper

Let each partner write a private note to the expert that the other partner does NOT see. Already supported by `is_private=true` on responses but not surfaced clearly.

**Why it works:** Couples therapy works because the therapist can hear things from each partner that the other partner can't hear yet. Mioshy without this is a watered-down version of itself.

**Risk:** Must be unmistakably labelled. Privacy violations here are catastrophic.

### O-6. **Closure rituals** — weekly recap

End every Sunday with a 60-second recap card on /my/journey: "this week you reflected on X, you reacted to Y, your expert said Z." Auto-generated, expert-reviewed.

**Why it works:** Memory consolidation. Couples who can articulate progress feel progress. The recap becomes the artefact they show their friends ("look what we're doing").

### O-7. **Threshold reveals** — milestones unlock surfaces

At 5 completed items, unlock a "couple insight" page that shows aggregated patterns from their reflections. At 10, unlock "your story so far" — a written narrative drawn from their own words. At 20, unlock "expert's letter to you."

**Why it works:** Time-gated rewards create *something to keep going for*. Each unlocked surface re-anchors the relationship to the product.

---

## 4. Admin Architecture (expert-facing)

### Mental model: stop thinking "admin," start thinking "coaching room"

The current admin dashboards are organised around the **system's** entities (programs, categories, items, assignments). Coaches think in **clients** (this couple, week 3, intimacy focus, last contact 2 days ago).

Reorganise the surface around the coach's mental model. Items/categories/programs are content authoring — that's a separate space, used by content ops, not by working coaches.

### Proposed top-level expert navigation

```
מיאושי קואצ'ינג / Mioshy Coaching
├── הזוגות שלי (My Couples)              ← landing page
│   └── [couple] → Coaching Room
├── תיבת ההתערבויות (Intervention Inbox) ← cross-couple work queue
└── ספריית הניסיונות שלי (My Library)    ← reusable replies, notes, content suggestions
```

Authoring (programs/categories/items) lives in a separate `/dashboard/content/` space, only accessed by admins, not coaches.

### A. The "My Couples" landing page

Replaces today's `/dashboard/my-clients`. A list/grid of couples assigned to this expert, sorted by **risk + urgency**, not alphabetically.

Each couple card shows, at a glance:

- Couple display name (first names)
- Week number in their journey
- Current focus area (their #1 ranked priority)
- Engagement state — colour-coded:
  - Green: posted a response in the last 7 days
  - Amber: 7-14 days since last response
  - Red: 14+ days, or completion rate dropping
- A single one-word "next coach action" tag — *Reply / Check-in / Push / Wait*. Computed from a small rules engine the coach can override.

Key behavioural design: the cards are **never empty**. A couple in "wait" state still shows on the page so the coach feels coverage, not abandonment. They're just sorted to the bottom.

### B. The "Coaching Room" — couple deep view

This is where the coach spends 80% of their time. Replaces `/dashboard/my-clients/[coupleId]`. Three-column layout (single column on mobile):

**Left column — Couple file (always visible)**
- Names, partnership length, kids count, employment context
- Initial assessment summary: 3 score bars + top priority
- Current week + next scheduled unlock
- Pact commitment status
- Quick-jump: assessment answers, full timeline, message history

**Centre column — The conversation**
- Unified thread of every interaction the coach can have with this couple, in chronological order:
  - User reflections (per-item)
  - User messages (general channel)
  - Coach replies
  - System events ("item unlocked," "item completed," "assessment retake answered")
- Each event has a single-action affordance: reply, react, suggest content, escalate to human review
- Filter pills at the top: All / Needs me / Sent / This week

**Right column — The dashboard**
- Engagement sparkline (responses per week, last 8 weeks)
- Score evolution: friendship / conflict-handling / passion-risk over time
- Heatmap: which items each partner has and hasn't completed
- "Risk indicators" — a small panel that lights up when:
  - Both partners completion rate diverges by >40%
  - Response sentiment shifts negative (auto-tagged)
  - 14+ days of silence
- Open the right column at all times. Coaches need ambient awareness.

### C. The Intervention Inbox

Cross-couple queue, replaces today's `/dashboard/clinician`. Three lanes:

- **Mine to reply** — responses + messages where the coach is on the hook
- **Watching** — couples flagged "watch this thread" by the coach (manual flag)
- **Triage** — anything auto-flagged as concerning (sentiment, keywords, distress signals)

Each row collapses; clicking opens the Coaching Room scrolled to that conversation. Never lose context.

### D. The "My Library"

A coach's personal library of:

- Saved replies they've written that worked well — taggable, searchable, insertable into new conversations
- Saved content items they often suggest — quick "send this" button from inside a conversation
- Personal notes on couples — markdown notepad, indexed per couple

This is the most under-built thing in the existing system. Coaches doing this work daily develop strong patterns. The product should harvest those patterns and surface them back to the same coach faster.

---

## 5. User Flows (ideal end-to-end)

### Flow A — First-time visitor → activated subscriber

```
/journey marketing
  └─ "Start by understanding where you are" CTA
      └─ Pre-assessment intro screen (NEW)
          - "10 minutes for both of you, separately"
          - "We don't share your individual answers with each other"
          - Pact commitment: 10 min/week × 4 weeks
              └─ Assessment (29 q, with conversational micro-copy between sections)
                  ├─ Section 1: "We're learning about your day-to-day" (5 q)
                  ├─ Section 2: "How you handle the hard moments" (7 q)
                  ├─ Section 3: "What's most alive in your bond right now" (6 q)
                  ├─ Section 4: "Where each of you is right now" (4 q, family domain)
                  └─ Section 5: "Where you want focus" (priority ranking)
                      └─ Live-generated micro-summary screen (NEW)
                          - "We see X stands out. Here's what month 1 looks like."
                          - One sentence per priority, written in advance per priority
                          └─ Pricing wall
                              └─ Country popup (B11.2 ✓)
                                  └─ Cardcom checkout
                                      └─ /billing/success (B11.3 ✓)
                                          └─ /my/journey
                                              ↓
```

### Flow B — Steady-state weekly engagement

```
Day 0  Mon 09:00 — Item unlocks. Push notification.
Day 0  User opens, reads, marks intent ("we'll do this Wednesday")  ← NEW intent capture
Day 2  Wed evening — gentle reminder ("planning to do tonight?")
Day 2  Couple completes the ritual offline
Day 3  Either partner posts reflection
Day 3  Optional partner reaction to reflection                       ← NEW per-item partner reactions
Day 4  Expert replies (within 24h SLA)
Day 5  User reads expert reply, reacts
Day 6  Sunday recap card surfaces                                     ← O-6
Day 7  Next item unlocks. Loop.
```

The crucial new piece is **intent capture** on day 0. The user planning *when* they'll do the ritual is itself a behavioural intervention (implementation intentions, Gollwitzer 1999). It also gives the system a reminder anchor.

### Flow C — Drift recovery

If 14 days pass with no response from a couple, the system shouldn't just sit there. Cascading interventions:

- Day 14: gentle in-app notification when next opened
- Day 17: expert receives a "drift alert" in their My Couples view
- Day 21: expert sends a hand-written check-in (template-assisted)
- Day 28: pause subscription with "we'll be here when you're ready" — billing pause, not cancellation

This is dignity engineering. The drift recovery flow communicates that the product knows life happens.

---

## 6. Expert Flows

### Daily coach session (15-30 min)

```
1. Open /dashboard/coaching → My Couples
2. Scan: any reds? any new ambers?
3. Open Intervention Inbox → "Mine to reply"
4. For each thread:
   a. Read in Coaching Room (full context auto-loads)
   b. Compose reply (with /library to insert saved replies)
   c. Optionally: suggest a content item, push, or flag for watch
   d. Mark resolved
5. Return to My Couples, work down the priority queue
```

### Weekly coach review (per couple, 5 min × 12 couples)

```
For each couple this expert owns:
  - Open Coaching Room
  - Look at sparkline + score evolution
  - Read the auto-generated weekly digest (NEW — system-summarised activity)
  - Decide: continue current path / add a custom assignment / switch focus area
  - Optional: write a one-line note in /library/couple-notes
```

The system-generated weekly digest is the highest-leverage feature in the entire expert dashboard. It turns 5 minutes of reading into 30 minutes of insight.

### Content authoring (separate role)

Coaches do not author. Content ops author. The /dashboard/content/ surface is:

- Item editor with live preview (existing)
- "Where is this item being used?" — every assignment using it (NEW)
- "How is this item performing?" — completion rate, response sentiment, expert reply length avg (NEW)
- Coach suggestions feed: when coaches suggest an item from the field, content ops sees the trend (NEW)

---

## 7. Content Matching Logic

### The current implicit model

Today, an item reaches a user through one of these paths:

1. Admin explicitly assigns a program/category/item to that owner
2. Auto-assign on purchase materialises the default program's items, day-1 override forces first item to now
3. Cadence engine (partial) selects per-week items based on user's priority ranking

There is no place where you can read the rules. Coaches have to reverse-engineer them.

### Proposed: a transparent rules engine

Introduce a new concept: a **Match Rule**. A row in `journey_match_rules`:

```
id, label, when_condition (JSONB), then_action (JSONB), priority, is_active
```

`when_condition` is a small DSL evaluating against three sources:
- User's assessment (scores, ranking, structured answers)
- User's history (completions, reactions, response sentiment)
- Time anchors (week N, days since last unlock, days since last response)

`then_action` is one of:
- Schedule item X with offset Y
- Boost category C in priority weighting
- Suspend cadence for N days
- Notify expert
- Surface celebration UI

Example rule, expressed in the coach's words:

> "If conflict-handling score < 40 AND user ranked communication #1, schedule item `conflict-recovery-101` to unlock at week 1, day 2."

Coach builds this in a no-code rule builder. The match engine evaluates active rules in priority order, ties broken by `sort_weight`. Every materialised `journey_scheduled_items` row carries a `matched_by_rule_id` so any item in the timeline can answer "why am I here?"

### A/B testing on rules

Two rules can fire in the same context. The system shadow-evaluates both, randomly assigns 50/50, records which one led to higher completion or longer response. Over time, the winning rule overtakes the losing one (multi-armed bandit).

This is **far** more useful than A/B testing item content. The matching is the personalisation; the content is mostly stable.

### LLM-assisted matching (V2-V3)

Once the rule corpus is healthy, an LLM can read a couple's full state and propose a *next item*. Not autonomously — the coach reviews and accepts. Over time the model learns from coach acceptances.

This is the right place for AI in this product. **Not in the user-facing chat** (where authenticity of expert voice is the entire value prop), but in the coach's tooling, accelerating their decisions.

---

## 8. Suggested Database Structure (gaps to fill)

The existing schema is strong. Don't refactor what works. Add these tables/columns:

### New tables

```
journey_couple_state
  couple_id PK
  week_number              -- weeks since assessment completed
  current_focus_priority   -- denormalised top priority
  engagement_score         -- rolling 28-day, 0-100
  drift_state              -- enum: active|drifting|paused
  last_response_at
  last_expert_touch_at
  next_unlock_at
  -- Updated on completions/responses via trigger; the source of truth for "where is this couple."
```

```
journey_couple_pacts
  id PK
  couple_id FK
  committed_minutes_per_week INT
  committed_weeks INT
  agreed_at
  honoured_through_week INT  -- last week where both partners showed up
```

```
journey_match_rules
  id PK
  label TEXT
  when_condition JSONB
  then_action JSONB
  priority INT
  is_active BOOL
  created_by FK profiles
  ab_variant TEXT -- nullable, for A/B
```

```
journey_intent_plans
  id PK
  scheduled_item_id FK
  user_id FK
  intent_at TIMESTAMP -- "I'll do this Wednesday evening"
  declared_at
  completed BOOL  -- did they actually do it?
```

```
journey_item_feedback  -- per-item user feedback
  id PK
  scheduled_item_id FK
  user_id FK
  rating ENUM (helpful|neutral|not_for_us|made_things_worse)
  optional_text TEXT
  created_at
```

```
journey_expert_library
  id PK
  expert_id FK
  kind ENUM (saved_reply|content_pin|couple_note)
  payload JSONB
  tags TEXT[]
```

```
journey_weekly_digests  -- coach-facing, auto-generated
  id PK
  couple_id FK
  week_starting DATE
  summary_md TEXT  -- machine-generated
  notable_signals JSONB
  reviewed_by_expert_at TIMESTAMP
```

### New columns on existing tables

```
journey_items
  ADD is_surprise BOOL DEFAULT false      -- O-2 variable reinforcement
  ADD is_milestone_reveal BOOL DEFAULT false  -- O-7 threshold rewards

journey_scheduled_items
  ADD matched_by_rule_id FK journey_match_rules NULL  -- "why this item"
  ADD seen_at TIMESTAMP NULL  -- view tracking (column exists in 055, wire it)
  ADD opened_count INT DEFAULT 0

journey_messages
  ADD expert_signed_by FK profiles NULL  -- which specific expert wrote this
  -- distinguishing from "the pool" matters psychologically (P-5)
```

### Materialised views (read paths)

```
mv_couple_engagement_28d  -- per-couple rolling stats, refresh hourly
mv_item_performance       -- per-item completion + response rates
mv_expert_workload        -- per-expert open queue + SLA timers
```

These prevent the dashboards from doing expensive aggregations at request time.

---

## 9. UI Recommendations

### Core principles

- **One main verb per screen.** /my/journey today asks the user to do six things. The first session screen should ask exactly one thing: open the day-1 item.
- **Show the why.** Every personalised element should expose its reasoning on tap. Like an iOS Smart Stack: tap to see why this is here.
- **Use motion to communicate state, not delight.** A score bar moving from 38 to 41 should be the only animation on that screen — it carries meaning. Spinning gradients are noise.
- **Hebrew-first, but optimise the en/he switch.** Today switching locale reloads everything. Worth investing in client-side translation cache.

### Screen-by-screen — verbal wireframes

#### Screen: post-purchase first session (replaces /my/journey for week-1 visits)

```
┌─────────────────────────────────────────────┐
│  ← my mioshy           [Itzik] [partner: --] │
├─────────────────────────────────────────────┤
│                                             │
│   [WINE GRADIENT BLOCK, 60vh]               │
│                                             │
│   ⌐  ברוכים הבאים                            │
│                                             │
│   הצעד הראשון שלכם השבוע                    │
│                                             │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━                  │
│   [item title H2]                            │
│                                             │
│   2 דקות יחד · אופציונלי לשניכם              │
│                                             │
│   [TAP TO OPEN — full-width pill]            │
│                                             │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━                  │
│                                             │
│   "מומחית הזוגיות שלכם"                      │
│   ┌─────┐                                   │
│   │ AVA │  שלום, אני יעל. אני אהיה בקשר     │
│   └─────┘  איתכם בכל שלב.                    │
│                                             │
│   [tap to message Yael]                     │
│                                             │
└─────────────────────────────────────────────┘
```

After the user opens the day-1 item, /my/journey switches to its dashboard mode (rail + activity etc.) on subsequent visits.

#### Screen: item detail (the unit of value)

Add a "why this item is here" disclosure beneath the body:

> ⓘ Yael chose this for you because friendship was your #2 priority and you mentioned in the assessment that you "rarely have unhurried time together."

This single line, populated from `matched_by_rule_id`, transforms the whole experience.

#### Screen: weekly recap (Sundays)

A single tall card on /my/journey showing:

- Week N
- One image (item that got the most engagement)
- "This week you reflected on X, and Yael said Y."
- 3 streak markers (small dots, no count): item completed / response posted / reaction received
- "Coming Monday: [next item title]"

#### Coach: Coaching Room

Three-column desktop, single-column mobile (collapse left column to a sticky header strip). The centre conversation should mirror exactly what the user sees, not reformat — coaches must feel they're in the same room as their couple.

### Micro-interactions worth building

- **Item completion** — when both partners mark an item complete, a single small wine-coloured glyph appears in the rail and a one-line confirmation across the bottom: "you both finished this together." Three-second auto-dismiss. No confetti. Adults using a serious product.
- **Expert reply arrives** — a soft pulse on the item card in the rail, plus the unread dot in the channel badge. Don't pop a notification toast unless the user is on /my (would compete with the rest of the page).
- **Score change** — when assessment retake updates a score, animate the change inline ("38 → 42") with a subtle direction arrow. No celebration; this is information, not gamification.

### Gamification — what to reach for and what to avoid

Avoid: streaks with counters, points, badges, leaderboards. They infantilise the product and break under the realistic cadence of relationship work.

Reach for: identity reinforcement (O-4), threshold reveals (O-7), couple milestones (anniversary of starting Mioshy, 10 reflections together, etc.), narrative artefacts (auto-generated "your story so far" at the 10-item mark).

The vibe: "the journal you and your partner are keeping together," not "the app that gives you stickers."

---

## 10. Roadmap — MVP → V2 → V3

Each version should ship complete, defensible value. No half-shipped phases.

### MVP (next 4 weeks) — fix the structural gaps blocking scale

Goal: the system is observable, explainable, and has a healthy first-week onboarding.

**Must:**

1. **"Why this item" disclosure on every item** — `matched_by_rule_id` column + simple rule-name surfacing on item detail. Even before a real rules engine, hand-author 6-10 rule labels, retroactively tag historical assignments. Don't wait for the engine.
2. **Pre-assessment intro screen** — pact commitment, "10 minutes a week," explicit privacy note about partner-private answers. Adds one screen, lifts completion measurably.
3. **Live assessment feedback micro-screens** — 4 mid-questionnaire screens reflecting back what's been heard. Pure copy work; no schema change.
4. **First-session onboarding screen on /my/journey** — replaces the current 6-stack of widgets for week-1 visits. Single goal: open the day-1 item.
5. **Day-1, Day-2 evening reminders** — push (or email if no push) for users who haven't opened the day-1 item by 24h post-purchase.
6. **Expert signature on replies** — `expert_signed_by` column + display name on each reply. End the "מיאושי is a bot" perception.
7. **Drift detection rule** — single hard-coded rule: if no response in 14 days, surface drift alert on coach's My Couples. Don't wait for full rules engine.
8. **Per-item feedback (4 buttons)** — `journey_item_feedback` table + a small "did this help?" row at item bottom after completion.

These eight items unblock everything downstream.

### V2 (months 2-3) — the rules engine and the coaching room

Goal: coaches can compose interventions without engineering, the system explains itself.

**Build:**

1. **`journey_match_rules` table + admin UI** — no-code rule builder for engineers and content ops. Conditions over assessment fields, score thresholds, history flags.
2. **The Coaching Room** — replace `/dashboard/my-clients/[coupleId]` with the three-column design. Centre column unifies all events; right column is always-on dashboard.
3. **`journey_couple_state` + materialised view** — single source of truth for couple progress. All dashboards read from this.
4. **Weekly recap card on /my/journey** — auto-generated Sunday digest for users.
5. **Coach's library** — saved replies, content pins, per-couple notes.
6. **Intent capture** — "when will you do this together?" prompt on item open. Reminder hook.
7. **Cadence engine completion** — finish slice 3. Per-user delivery_days respected, priority-weighted selection live.
8. **Couple pacts** — table, UI, and "weeks remaining in pact" surfacing in coach view.

### V3 (months 4-6) — engagement compounding

Goal: the product gets better the more couples use it.

**Build:**

1. **A/B testing on match rules** — bandit-driven optimisation. Coach proposes rule variants, system finds winners.
2. **LLM-assisted coach replies** — draft replies for the coach to edit/accept. Trained on the corpus of accepted past replies. Speed lift, not quality compromise.
3. **Threshold reveals** — couple insight pages, "your story so far," expert letters at 5/10/20 completed items.
4. **Surprise items** — `is_surprise` cadence rule, expert-curated, breaks the rhythm in a good way.
5. **Assessment retake at week 8** — short version, 8-10 questions, drives re-anchoring of priorities. Score evolution becomes visible.
6. **Cross-couple anonymous insights** — "couples like yours often work on…" without exposing individual data. Powerful social proof without privacy violation.
7. **Coach metrics dashboard** — per-coach SLA performance, couple retention, response quality (length, sentiment, time-to-reply). Performance management surface.
8. **Expert pool routing** — couples explicitly matched to coaches based on coach specialty + couple need profile. Today it's effectively round-robin.

---

## Closing notes

Three things to internalise above all else:

1. **The product is not an app, it's a coaching practice with a software layer.** Every architectural decision should be made from the coach's frame, not the engineer's. The schema is great. The dashboards are not coach-shaped yet.

2. **Stop optimising the assessment. Optimise what happens after it.** Assessment completion rate is solved by intro screens and live feedback (MVP items 2-3). Nine months from now nobody will care about the assessment — they'll care about whether week 12 felt like progress.

3. **Privacy is the product.** A relationship platform that handles partner-private content has to lead with privacy in copy, in UI, in defaults. Today it's a footnote (`is_private` toggle, easy to miss). It should be the visual centrepiece of every screen where it applies. No couples-coaching product survives a privacy violation; every couples-coaching product wins by being unmistakably trustworthy.

The MVP list is the real ask. Eight items, four weeks, every one of them measurable.
