# /my Page Redesign - Spec & Implementation Plan

**Status**: MVP scope locked - 3-day build
**Owner**: itzik
**Last updated**: 2026-05-01

## 0. MVP - the 3-day plan (LOCKED)

> **One sentence**: turn a noisy dashboard into a clear coaching path
> - without building a new system underneath.
>
> **Hard rules for the MVP**:
> - **No DB migrations**. Use only the schema we already have.
> - **No clinician / admin features**. No Inbox, no "view as user".
> - **No notifications system**. No sparkles, no toasts, no dots.
> - **No analytics, no KPIs**. Just ship the visual change.
> - **Journey only**. Games and Adults stay simple - they get the
>   open/locked badge and nothing else.

### Day 1 - "Clear statuses"

1. **Pillars** - add a single state badge to each card. One of:
   - 🔓 פתוח
   - ⏳ בתהליך
   - 🔒 לא נרכש

   Implementation: replace the leading emoji icon with the badge.
   Don't touch the entitlement / billing logic.

2. **Journey CTA** - 3 derived labels:
   - assessment not started → "להתחיל אבחון"
   - assessment in progress → "להמשיך"
   - assessment completed → "כניסה לליווי עם מיאושי"

   Implementation: a derived label inside `EntitledPillar` and the
   marketing-mode `ServicePanel`. No state machine, no new tables.

3. **Games card flashing fix** - find the offending element in dev
   tools, remove the `animate-pulse` / overlay. One commit.

### Day 2 - "Process feeling"

4. **Static rail above the pillar grid** - exactly six pills,
   left-to-right (or right-to-left in RTL):

   ```
   אבחון → תובנות → תקשורת זוגית → אינטימיות → אהבה → משפחה
   ```

   Rules:
   - No dates.
   - No admin coupling.
   - No DB queries beyond the assessment status we already have.
   - Static order baked into the component.
   - Only the current step is highlighted; the rest are dim.

5. **Current step computed from**:
   - `journeys.status === 'completed'` → step "אבחון" is `completed`,
     step "תובנות" is `current`.
   - `journeys.status` exists but not completed → step "אבחון" is
     `current`, all others are `pending`.
   - No `journeys` row → step "אבחון" is `current`, others `pending`.
   - On user-with-active-assignment we still keep the simple model;
     the rail is purely a sense-of-progression UI, not a content
     scheduler.

### Day 3 - "Order & cleanliness"

6. **Bottom tabs** - three tabs: נעשה · פעיל עכשיו · בדרך.
   - Filtered locally on the client from data the page already has.
   - No new fetches, no status engine.
   - Day-1 version: read from the existing `getTimelineForOwner`
     helper. If it returns nothing yet, the tab body is a quiet
     "אין עדיין כלום באזור הזה" caption - never an error.

7. **UI cleanup**:
   - Remove marketing voice strings on the dashboard ("מגניב!",
     game-style copy on Journey card, etc.). Tone moves toward
     calm/professional everywhere on Journey. Games and Adults
     stay light - but no exclamation marks.
   - Unify RTL spacing on the new components.
   - Remove the diagnostic `console.log("[/my] DEBUG", ...)` block
     and `[/my] PILLAR DECISIONS` log - they were for the billing
     debug session, not production code.

### What we are NOT doing in MVP (worth saying out loud)

- ❌ Clinician Inbox / "View as user" / dashboard for psychologists
- ❌ sparkles / notification dots / new-content toasts
- ❌ `journey_user_planned_categories` table or any new migration
- ❌ Formal state machine (it's a local enum in the rail)
- ❌ KPI dashboards / analytics events
- ❌ Sync between admin's calendar and user's rail
- ❌ Per-user dynamic timelines (synthetic days from registration)

These are all in **Part II** of this document - the roadmap for
later phases.

### What you ship at end of day 3

- Clear: user knows where they are, what's open, what's locked, what's next.
- Process feeling: a path lives above the cards.
- Smart button: changes per assessment stage.
- Clean UI: less noise, fewer marketing words.

That's the MVP.

---

## 0.5 Future direction - multiple assessments (Phase 2)

The user said clearly: "the journey isn't only about the initial
assessment. We will add **more** assessments that admins assign to
clients, and the client responds, and we see in their account the
tools they got and what's coming and arrange everything together."

This document already accommodates this - the rail and tabs treat
"assessment" as just one type of journey item. To enable multiple
assessments later, we will:

1. Add an `assessment` discriminator on `journey_items` (or use the
   existing `task_he` / response model - TBD).
2. The rail items naturally include any item with a "diagnostic" kind
   alongside content items.
3. Admin tooling to author and assign new assessments - separate
   PR, post-MVP.

The MVP doesn't need any of this. The architecture just doesn't
paint itself into a corner.

---

## 1. Why we're redoing this

The logic on `/[locale]/my` already works (entitlements, couple context, journey
status). The page **doesn't communicate** what we're building:

- An experience tool where everything is **clear**, no surprises.
- A personal coach view that says "we are working on your answers" even
  before any content is unlocked.
- A tight, owned, predictable rhythm: every 4 days a new milestone.

Visual problems on the live page today (from user feedback 2026-05-01):

1. Pillar cards above the fold show empty space on the right column on
   wide screens, dashboard feels half-built.
2. The Games-for-couples card has a **white flashing element** on the
   right side that's distracting (per user: "ההבהוב … מציק").
3. The CTA copy on Journey says "להתחיל אבחון חינם" even for users who
   already completed it. Should switch to "כניסה לליווי עם מיאושי".
4. There's no visible signal of what the user has done vs. what's
   locked. Missing the lock metaphor entirely.
5. There's no timeline / sense-of-progression for new users.

This document fixes all of the above.

## 1.5 Tone & authority - ה-Journey הוא לא משחק

This is the most important part of the redesign and it shapes every
visual choice below.

When a user clicks into "ליווי עם מיאושי", they are crossing a threshold
that matters. They've decided **the time has come to do something real**
about their relationship - and that decision deserves a setting that
reflects it. Everything in the Journey surface (the card on `/my`, the
rail above the cards, the tabs below, the `/my/journey` private space)
should feel like **a clinical, expert-led program**:

- A coach is reading their answers.
- Real insights are being prepared.
- Each milestone is intentional, not random.
- Privacy is total.

### What this means in concrete UI choices

| Dimension | Games / Adults pillars | Journey pillar |
|---|---|---|
| Tone of copy | playful, inviting, light | calm, professional, present |
| Typography weight on titles | regular / semibold | semibold / bold + slightly larger leading |
| Color accents | fuchsia / rose (warmth, fun) | cool teal / slate-blue (focus, trust) |
| Iconography | playful (sparkles, hearts) | clinical (steady ✓, calendar, journal) |
| Imagery | none | none - empty space is part of the calm |
| Animation | hover-scale, color pulses | static, no motion. Only state changes. |
| Microcopy verbs | "לגלות", "להתחיל לשחק" | "להמשיך", "לפתוח", "לקרוא", "לרשום" |
| What it should remind users of | a curated app store | a therapist's journal / case file |

### Concrete copy guidelines (Hebrew)

The Journey card ALWAYS uses formal, present-tense, calm phrasing.
Examples that pass:

> ✓ "המומחים שלנו עובדים על התשובות שלך."
> ✓ "התוכן הבא ייפתח ב-3 במאי."
> ✓ "בחדר הזה יש 3 כלים חדשים שטרם נפתחו."

Examples that **fail** the tone (rewrite required):

> ✗ "מגניב! יש לך 3 דברים חדשים 🎉" - too playful
> ✗ "תפוס את ההזדמנות עכשיו!" - sales pressure
> ✗ "התחל את ההרפתקה שלך" - game framing

When in doubt, ask: "would a clinical-psychology practice send this
sentence to a client?" If no, rewrite.

### Specific copy on the rail (revised from §4)

The reassurance line under the rail (was generic) becomes:

> "אנחנו עובדים על התובנות האישיות שלכם. כל פגישה כאן בנויה על
> התשובות שלך - הן מטופלות ביד מקצועית. אין הפתעות, אין מסחר. רק
> תוכן שנכתב במיוחד עבורכם."

This explicitly does three things:
1. Names what the user gets (תובנות אישיות, מטופלות ביד מקצועית).
2. Promises calm, not surprise (אין הפתעות).
3. Disowns the marketing register (אין מסחר).

### Visual mood - the surface itself

The Journey-specific surfaces use a different ambient treatment than
the rest of the dashboard:

```css
/* The Games / Adults panels keep the existing fuchsia-tinted glass */
games  panel  → bg-white/[0.04] over the global gradient backdrop
adults panel  → bg-white/[0.04] over the global gradient backdrop

/* Journey panels get a deeper, cooler glass - feels like entering
   a quieter room within the same building */
journey panel → bg-slate-950/40 border border-slate-300/[0.08]
                backdrop-blur-md ring-1 ring-inset ring-white/[0.02]
```

That tiny treatment change is enough. The user instantly senses they
walked into a different mode without us shouting.

### Naming

Stop calling the Journey card "ליווי" by itself. The full name on the
card title is:

> **ליווי עם מיאושי** - *תוכנית עבודה אישית*

The subtitle ("תוכנית עבודה אישית") is small, white/55, sits directly
under the main title. It positions the offering as a program, not a
feature.

---

## 2. Goals (and non-goals)

### Goals

- Every pillar card communicates its state visually (open / locked /
  not-purchased) using a clear badge - no decoding required.
- A dedicated **journey rail** between the title and the pillar cards
  showing 4 upcoming milestones for users who registered (2 days, 6
  days, 10 days, 14 days), even before admin content is assigned.
- Past milestones are clickable; future are disabled.
- Smart CTA text on the Journey card based on assessment status.
- Removed the white flashing element on the Games card.

### Non-goals (out of scope for this PR)

- Building a new admin tool to add content. Current admin
  (`/[locale]/dashboard/admin/...`) is reused as-is. We only sync to it.
- Push notifications / emails when a milestone unlocks. The
  `notify-unlocks` cron is already running - this PR is UI only.
- Changing the entitlement / billing logic. Pillar visibility rules
  stay the same (`getUserEntitlements`).

## 3. States - the four pillar states

Every pillar card on `/my` is in exactly **one** of these states. The
state determines the badge, the CTA copy, and the click behavior.

| State | When | Badge | Card body | CTA |
|---|---|---|---|---|
| **OPEN** | User has active subscription/entitlement, content is ready | 🔓 *פתוח עבורך* (emerald) | what's inside in plain language | "כניסה" → live route |
| **IN_PROGRESS** | User has access but isn't done yet (assessment started, not completed) | ⏳ *באמצע מסלול* (amber) | "המשך מהמקום שעצרת" - never "התחל" | "להמשיך" → resume route |
| **NOT_PURCHASED** | Logged-in user that hasn't bought this pillar | 🔒 *עדיין לא רכשת* (zinc) | brief tagline | "לגלות" → marketing |

> **Important - what we removed**: an earlier draft had a fourth pillar
> state "COMING_SOON". We removed it because **every pillar we ship is
> available** (Games, Journey, Adults). Putting "בקרוב" on a pillar the
> user can buy right now is misleading. "בקרוב" only ever appears on
> **individual content items inside the Journey rail** - never on the
> three pillar cards themselves.

### Badge rules (tokens)

```css
/* Tailwind utility shorthand - verbatim copy-paste */
OPEN          → bg-emerald-500/15 text-emerald-300 border border-emerald-400/30
IN_PROGRESS   → bg-amber-400/15   text-amber-200   border border-amber-300/30
NOT_PURCHASED → bg-white/5        text-white/60    border border-white/10
/* For rail items only - see §4 */
ITEM_LOCKED   → bg-slate-500/10   text-slate-300   border border-slate-400/20
```

All badges share the same shape: `rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide`.

### Replacing the leading icon

Current code has emoji icons (🎮, 🧭, 💜) in the pillar header. Per user
spec §1, replace these with the state badge above the title. The icon
real-estate becomes the badge real-estate. Cleaner, communicates state.

## 4. The journey rail - "what's coming"

This is the core new component. **Goal**: never show an empty Journey
card again.

### Layout

A horizontal strip ABOVE the pillar grid, full-width, dark translucent
panel:

```
[ ✓ אבחון ראשוני ]  [ ▶ תקשורת זוגית ]  [ • מיניות ואינטימיות ]  [ • אהבה וחיבור רגשי ]  [ • חברות ושותפות יומיומית ]  [ • משפחה הורות ולחצים ]
   הושלם              פתוח לצפייה          ייפתח בהמשך               ייפתח בהמשך              ייפתח בהמשך                   ייפתח בהמשך
```

Visual: pill cards in a `flex gap-3 overflow-x-auto snap-x`, each pill
is ~190px wide. RTL-aware.

**Critical**: pills NEVER show specific calendar dates ("ב-3 במאי"
etc.) for content the user hasn't reached yet. The journey is a
multi-month, individualized path - promising specific dates when the
clinician hasn't decided yet would erode trust the moment a date
shifts. Locked pills say "**ייפתח בהמשך**" or, when the admin has
already set a `display_at` date in the next 7 days, "**ייפתח בקרוב**".
That's it. Never a specific date.

### State per pill

| Status | Icon | Bar color | Click | Label suffix |
|---|---|---|---|---|
| `completed` | `CheckCircle2` ✓ | emerald | open the completed item | "הושלם" |
| `available` | `Sparkles` (one-shot, see §22) | white | open the item | "פתוח לצפייה" |
| `coming_soon` (within 7 days) | `Clock` | amber | tooltip with general timeframe | "ייפתח בקרוב" |
| `planned` (more than 7 days, or admin hasn't fixed a date) | dimmed dot `•` | slate | inert tooltip | "ייפתח בהמשך" |

### Timeline source - admin-driven, not synthetic

**Revised from earlier draft.** I'm killing the "synthetic timeline
based on registration date" idea. It's tempting but wrong: it makes
us promise things the clinical team hasn't actually scheduled, and
the SaaS only feels professional when the clinician is the one in
control of the calendar.

**Source of truth for the rail entries:**

```sql
-- Rail entries = (a) categories the user has ANY items scheduled for
-- (admin-driven via journey_assignments → journey_scheduled_items)
-- UNION
-- (b) categories the admin has marked as "queued for this user" via
-- a new lightweight journey_user_planned_categories link table (see
-- §13 for schema), regardless of whether items have been materialised
-- yet.
```

This means:
- A user signs up → assessment is added by an admin trigger → user
  sees `[ ✓ אבחון ראשוני ]` in `available` until they take it, then
  `completed` after.
- Admin assigns the standard six-pillar program → six categories
  appear immediately in the rail, all in `planned` state.
- Admin sets a `display_at` date for "תקשורת זוגית" within the next
  7 days → that pill flips from `planned` to `coming_soon`.
- The day arrives, items unlock, pill flips to `available`, and a
  one-shot sparkle plays on the user's next page load (§22).

### What the user sees on day 0 (just signed up)

A trigger seeds an initial `journey_user_planned_categories` row for
each pillar topic, all in `planned` state. The rail is **never empty**
for any user who's logged in:

> אבחון ראשוני · תקשורת זוגית · מיניות ואינטימיות · אהבה וחיבור רגשי · חברות ושותפות יומיומית · משפחה הורות ולחצים פנימיים

This isn't fake. These six topics ARE the program - admins are pre-
authorising us to show them. Item bodies/dates are filled in by the
clinical team for each individual user as they get to know them.

### Reassurance footer line

Below the rail (small caption-text, white/60):

> "המומחים שלנו עובדים על התשובות שלך. בכל שלב נעלה לך תוכן אישי
> חדש. אין הפתעות - אנחנו כאן."

This line explicitly addresses the user's request: "they need to know
that experts are working on their answers".

## 5. Smart CTA copy on Journey card

Replace the static `ctaLabel` with a derived label that honors the
user's exact stage. Critical principle: **never invite a user who
already started**. They've crossed the threshold; we welcome them in.

```ts
type AssessmentStage =
  | "not_started"     // no journeys row
  | "in_progress"     // journeys row, status != 'completed'
  | "completed"       // journeys row, status = 'completed'

function journeyCtaLabel(args: {
  isHe: boolean
  stage: AssessmentStage
  hasActiveAssignments: boolean
}): string {
  const { isHe, stage, hasActiveAssignments } = args

  // Active program → enter directly
  if (hasActiveAssignments) {
    return isHe ? "כניסה לחדר הפרטי" : "Enter your private space"
  }

  // Assessment done, awaiting clinical content → welcome them in
  if (stage === "completed") {
    return isHe ? "כניסה לליווי עם מיאושי" : "Enter coaching with Mioshy"
  }

  // Mid-assessment → resume, never restart
  if (stage === "in_progress") {
    return isHe ? "להמשיך מהמקום שעצרת" : "Continue where you left off"
  }

  // First-time, never started
  return isHe ? "להתחיל אבחון אישי" : "Start your assessment"
}
```

**Notes**:

- "להתחיל אבחון אישי" replaced "להתחיל אבחון חינם" - we don't lead
  with the price tag on the dashboard. The price was a marketing
  hook on `/journey`; here we're past that.
- `in_progress` users get welcomed back, never asked to "start". This
  matches the user feedback verbatim: "מי שהתחיל את התהליך של האבחון
  צריך להגדיל לו שיכנס מי שלא צריך להזמין אותו להיכנס".
- All three "entry" copies share the `<ArrowLeft>` chevron in RTL
  (or `<ArrowRight>` in LTR). The button visually pulls the user **in**.

### Helper update needed

`getOwnerJourneyStatus` currently returns `hasActiveAssignments` and
`hasInProgressAssessment` only. We add `hasCompletedAssessment` as a
separate signal so the CTA logic above is purely derived:

```ts
// lib/journey-content/owner-status.ts (add field)
export interface OwnerJourneyStatus {
  owner: JourneyOwner
  hasActiveAssignments: boolean
  hasInProgressAssessment: boolean
  hasCompletedAssessment: boolean   // NEW
}
```

Computed from `journeys.status === 'completed'` on the most-recent row.

## 6. The white-flashing bug on the Games card

### Suspected cause

The `EntitledPillar` notification badge uses `bg-rose-500` (red), but
the user reports white. Likely culprits to verify in dev:

1. A `<Loading.tsx>` skeleton flashing through during navigation (look
   for `animate-pulse` on a child of the games card).
2. A `data-testid="online-indicator"` blip from a presence component.
3. A `transition-opacity` on the pair-code widget that's mounted but
   hidden.

### Fix path

Open dev tools → Elements panel → hover over the flashing region →
record the class names. Then:

- If `animate-pulse` skeleton: gate behind `Suspense` proper boundary
  so it only flashes once on first render.
- If presence dot: move it to `bottom-2 left-2` and make it muted
  (`bg-emerald-400/40` not `bg-white`).

Phase B for this - needs reproduction. We instrument first, fix
second. (Spec §10.4.)

## 7. The "work-tool" lower section

Below the pillar grid, replace the current quick-link footer with a
tabbed work-area with three tabs:

```
[ ✓ נעשה ]  [ ▶ פעיל עכשיו ]  [ ⏳ בדרך ]
```

### Tab 1 - נעשה ("Done")

List of items the user has completed (`journey_item_completions`),
ordered by `completed_at desc`. Each row: title + date + small "↩
לחזור" link to revisit.

### Tab 2 - פעיל עכשיו ("Active")

Items where `unlock_at <= now AND no completion row`. These are
"available". Click goes straight into the item.

### Tab 3 - בדרך ("Upcoming")

Items where `unlock_at > now`. Show countdown (X days, Y hours).
Click does nothing - disabled state with tooltip showing the unlock
date.

Visual: dark glass card (`bg-white/[0.035] border border-white/10
backdrop-blur-md`), one tab active at a time, tab buttons same style
as the badge tokens above.

## 8. Admin sync - what's the contract

The user wants to ensure that "what the admin adds shows up". This is
**already wired** through `journey_assignments` →
`journey_scheduled_items`. We need to expose two operator affordances:

### 8.1 Diagnostic on the user page (footer, dev-only)

A small "powered by ..." caption under the rail that, in dev mode,
shows: "rail mode: synthetic | real (N items)" so the team can verify
the cutover when admin attaches a program.

### 8.2 Admin link to "view as user" (admin-only)

In `dashboard/admin/clients/[id]/journey` (already exists), add a
button "View as this user" that opens `/my?as=<user_id>` in a new tab.
Service-role can then render the page from this user's perspective for
QA. Gated on `system_admins`. (Phase D.)

## 9. Decisions log

| Decision | Why |
|---|---|
| Synthetic rail when no assignments | "Never empty" - user explicitly asked for a sense of progression even before admin attaches anything. |
| Cadence: 0/2/6/10/14 days | Matches user spec ("first in 2 days, then every 4 days") with day-0 anchored on registration. |
| Badge replaces emoji icon | User said "במקום האייקונים מעל הכותרת". |
| Tabs (done/active/upcoming) replace footer links | Page becomes a work tool, not a settings page. |
| No localStorage for tab selection | Server-rendered page; default tab = "פעיל עכשיו". |
| Reuse existing entitlement / status helpers | They work - we only redress the UI. |

## 10. Implementation phases

### Phase A - Spec sign-off (this document)

✅ → User reviews this file and confirms the four states + the rail
cadence + the CTA copy rules.

### Phase B - Quick wins (1-2 hours)

- B.1 Smart CTA copy on Journey card - code in §5 above.
- B.2 Replace emoji icons with state badges - code in §3 above.
- B.3 Investigate + fix flashing white on Games card - instrument
  first (browser dev tools) then fix.

These are isolated to `/my/page.tsx` and `EntitledPillar`. No new
queries.

### Phase C - Journey rail (3-5 hours)

- C.1 New component `components/my/JourneyRail.tsx` with:
  - props: `entries: RailEntry[]`, `mode: 'synthetic' | 'real'`,
    `userCreatedAt: string`
  - renders horizontal pill list with state styles per §4.
- C.2 Helper `lib/journey-content/synthetic-rail.ts` that builds the
  fallback timeline from registration date.
- C.3 Render rail above the pillar grid in `/my/page.tsx`.
- C.4 Reassurance footer line under the rail (§4).

No DB changes, no migrations.

### Phase D - Work-tool tabs (4-6 hours)

- D.1 New component `components/my/JourneyWorkArea.tsx` with three
  tabs (§7).
- D.2 Server-side tab data: pull completions, available items, upcoming
  items via `getTimelineForOwner` (already exists).
- D.3 "View as user" admin shortcut - Phase D-2 separately.

### Phase E - Polish & QA

- E.1 RTL audit - every new component tested in `dir="rtl"`.
- E.2 Mobile layout - rail becomes a horizontal carousel
  (`overflow-x-auto snap-x`).
- E.3 Empty / failure states - every fetch has a fallback that doesn't
  break the layout.
- E.4 Dark/light contrast - WCAG AA on every badge.

## 11. Files we'll touch

```
app/[locale]/my/page.tsx               (modify - add rail + work-area, smart CTA)
components/my/JourneyRail.tsx          (NEW)
components/my/JourneyWorkArea.tsx      (NEW)
components/my/PillarBadge.tsx          (NEW - extracted from EntitledPillar)
lib/journey-content/synthetic-rail.ts  (NEW)
lib/journey-content/owner-status.ts    (modify - also return `hasAssessmentCompleted`)
```

No DB migrations. No new tables. No env-var changes.

## 12. Acceptance checklist (for sign-off)

A reviewer should be able to verify each of these on staging:

- [ ] User who never paid sees: 3 pillar cards, all with NOT_PURCHASED badge.
- [ ] User who paid for Journey but never took the assessment sees: rail
      with day 0 in `available` state ("התחל אבחון"), days 2/6/10/14 locked.
- [ ] User who finished assessment, no admin content yet: rail is in
      synthetic mode showing "התובנות הראשונות שלך - בעוד 2 ימים", and
      so on. Footer reassurance line is visible.
- [ ] After admin attaches a program (test seed): rail switches to real
      content, dates align with `unlock_at` from `journey_scheduled_items`.
- [ ] Journey card CTA changes per assessment state (§5 truth table).
- [ ] No flashing element on the Games card.
- [ ] Tab "נעשה" lists completed items in reverse-chronological order.
- [ ] Tab "בדרך" shows countdown to unlock + can't be clicked.
- [ ] RTL layout perfect on iOS Safari (smallest screen tested).

When all 9 are ✅, we ship.

---

# Part II - Roadmap (post-MVP)

> **Important**: nothing in Part II is in the MVP scope (§0). These
> sections are the **target architecture** we're building toward over
> the next quarters. They're documented here so we can refer back to
> them when we expand. **Do not implement anything from Part II in
> the first 3 days.**

The first 12 sections are the UX/UI spec for MVP. The next sections
are what eventually makes this a SaaS, not a website: data contracts,
state machines, edge cases, performance, observability, and the
clinician side. They're for **Phase 2** and beyond.

## 13. Data contract - single source of truth per state

For every UI state you see on `/my`, there is **exactly one** SQL
function that derives it. UI never invents state. If the page renders
a badge as "OPEN", it's because `viewer_state(user, pillar)` returned
the literal string `'open'` - nothing more, nothing less.

### 13.1 The pillar state function

```ts
// lib/dashboard/pillar-state.ts (NEW)
export type PillarState =
  | { kind: "open"; ctaLabel: string; ctaHref: string }
  | { kind: "in_progress"; ctaLabel: string; ctaHref: string }
  | { kind: "not_purchased"; ctaLabel: string; ctaHref: string }

export type PillarKey = "games" | "journey" | "adults"

export interface PillarStateInputs {
  pillar: PillarKey
  entitlement: boolean
  // Journey-specific
  hasActiveAssignments?: boolean
  assessmentStage?: AssessmentStage
  // Adults-specific
  ownedGameCount?: number
}

export function derivePillarState(input: PillarStateInputs, isHe: boolean): PillarState
```

This is a pure function. Tested with table-driven unit tests. **Every
caller** of pillar state goes through this function. We delete every
`if (entitlements.X) { ... } else { ... }` ad-hoc branch elsewhere.

### 13.2 Journey rail entries - the link table

We need a new lightweight table to represent "this category is on
this user's plan, even if items haven't been materialized yet".

```sql
-- supabase/migrations/049_journey_user_planned_categories.sql
create table public.journey_user_planned_categories (
  id           uuid        primary key default gen_random_uuid(),
  -- One of user_id / couple_id MUST be set, never both. Mirrors
  -- journey_assignments.
  user_id      uuid        references auth.users(id)        on delete cascade,
  couple_id    uuid        references public.couples(id)    on delete cascade,
  category_id  uuid        not null references public.journey_categories(id) on delete cascade,
  display_at   timestamptz,                  -- null = "ייפתח בהמשך", set = "ייפתח בקרוב"
  sort_order   integer     not null default 0,
  origin       text        not null default 'admin_manual',  -- 'admin_manual' | 'program_seed'
  created_by   uuid        references auth.users(id)        on delete set null,
  created_at   timestamptz not null default now(),
  -- Idempotency: each (owner, category) pair appears at most once.
  unique (user_id, category_id),
  unique (couple_id, category_id),
  check ((user_id is null) <> (couple_id is null))
);

create index on public.journey_user_planned_categories (user_id);
create index on public.journey_user_planned_categories (couple_id);
create index on public.journey_user_planned_categories (display_at)
  where display_at is not null;

alter table public.journey_user_planned_categories enable row level security;

-- service role only - admins write, scheduler reads
create policy "planned categories: service_role full access"
  on public.journey_user_planned_categories
  for all to service_role using (true) with check (true);

-- viewer can read their own
create policy "planned categories: viewer reads own"
  on public.journey_user_planned_categories
  for select to authenticated
  using (
    user_id = auth.uid()
    or couple_id in (
      select couple_id from public.couples_members where user_id = auth.uid()
    )
  );
```

**On signup trigger** - the existing `assignJourneyOnPurchase` flow
already creates the right `journey_assignments`. We extend it to also
seed the planned-categories table with the six standard topics so
the rail is populated from minute one (§4).

### 13.3 Rail entry derivation

```ts
// lib/journey-content/rail.ts (NEW)
export type RailEntryStatus =
  | "completed"
  | "available"
  | "coming_soon"  // display_at within next 7 days OR has scheduled item with unlock_at within 7 days
  | "planned"      // no specific date

export interface RailEntry {
  categoryId: string
  title: string
  status: RailEntryStatus
  href: string | null  // null when not clickable
  unlockHint: string | null  // "ייפתח בקרוב" / "ייפתח בהמשך" / null when active
  hasNewContent: boolean      // unread (see §22)
}

export async function buildRailForOwner(opts: {
  owner: JourneyOwner
  isHe: boolean
}): Promise<RailEntry[]>
```

The function does **two queries** in parallel:

1. `journey_user_planned_categories` joined to `journey_categories`
2. `journey_scheduled_items` joined to `journey_items` and
   `journey_categories`, restricted to `unlock_at >= now() - 30 days`

Then merges by `category_id`. If a category has at least one
scheduled item with `unlock_at <= now()`, status is `available`. If
the earliest unscheduled item has `display_at` (or its category's
`display_at`) within 7 days, status is `coming_soon`. Otherwise
`planned`. Completed status is overridden by checking
`journey_item_completions` for the latest scheduled item in the
category.

## 14. State machine

```
┌────────────┐   pay         ┌─────────────────────┐
│ Anonymous  │─────────────▶│ Subscribed,        │
└────────────┘               │ AssessmentNotStart │
                             └────────┬────────────┘
                                      │ click "התחל אבחון"
                                      ▼
                             ┌─────────────────────┐
                             │ Subscribed,         │
                             │ AssessmentInProgress│
                             └────────┬────────────┘
                                      │ submit final answer
                                      ▼
                             ┌─────────────────────┐
                             │ Subscribed,         │
                             │ AssessmentCompleted │
                             └────────┬────────────┘
                                      │ admin attaches program / first item unlocks
                                      ▼
                             ┌─────────────────────┐
                             │ Subscribed,         │
                             │ ActiveProgram       │
                             └────────┬────────────┘
                                      │ all items completed for current period
                                      ▼
                             ┌─────────────────────┐
                             │ Subscribed,         │
                             │ AwaitingNextRelease │
                             └─────────────────────┘
```

### 14.1 Transitions

| From | Event | To | Side effects |
|---|---|---|---|
| Anonymous | signup | Subscribed_NotStart | seed planned categories (§13.2) |
| NotStart | begin_assessment | InProgress | insert `journeys` row |
| InProgress | abandon (60+ days idle) | NotStart_Stale | flag for clinician review |
| InProgress | submit_complete | Completed | trigger admin notification |
| Completed | admin_assigns_program | ActiveProgram | materialize scheduled items |
| ActiveProgram | finish_all_items | AwaitingNextRelease | notify clinician |
| AwaitingNextRelease | admin_adds_item | ActiveProgram | unlock + sparkle on next visit |
| Any Subscribed | cancel_subscription | Cancelled | stop scheduled unlocks (rail freezes) |

### 14.2 Why this matters for the UI

The CTA logic in §5 is the SURFACE of this state machine. Every label
choice maps to exactly one state. If we ever add a new state, we add
exactly one new arm to `journeyCtaLabel`. No drift.

## 15. Edge cases - exhaustive list

| # | Case | Handling |
|---|---|---|
| 15.1 | User has no `created_at` (auth row corrupted) | Rail still renders - synthetic anchor falls back to `now()`. Log incident to `journey_state_anomalies`. |
| 15.2 | User in non-IL timezone | All timestamps stored UTC. UI renders relative ("ייפתח בעוד 3 ימים"), never localized DD/MM. Dates shown only in detail view, formatted to user's `Accept-Language`. |
| 15.3 | User had old "journey" subscription, switched to new program | `journey_assignments` are scoped per-user; old ones are simply deactivated (`is_active=false`). Rail filters by `is_active`. |
| 15.4 | Admin adds item mid-program | Materializer creates a `journey_scheduled_item` with `unlock_at`. If `unlock_at <= now()`, sparkle on user's next visit. If future, slots into rail as `coming_soon`. |
| 15.5 | Partial entitlement (paid Games only) | Each pillar evaluates independently; no cross-pillar coupling. Journey rail only renders if user has Journey entitlement; otherwise it's hidden entirely. |
| 15.6 | User deleted then re-signed up | `auth.users.id` changes - new row, new state. Old `journeys`/`journey_assignments` rows have FK with ON DELETE CASCADE, so they vanish. Fresh start. |
| 15.7 | Couple separated (one partner removed) | `couple_id` retained, removed partner's view falls back to `user_id`-scoped state. Their rail entries become solo. |
| 15.8 | Admin deletes a category | Cascades to `journey_user_planned_categories` and `journey_scheduled_items`. Rail re-renders without that pill. No error toast - silent. |
| 15.9 | Two devices open simultaneously | Both fetch independently. State is read-only on the user side; no conflict. Sparkle dedupe via `notified_at` column on `journey_scheduled_items` (already exists from migration 036). |
| 15.10 | `notified_at` updated by one tab, other tab still shows sparkle | Acceptable. Sparkle is a one-shot animation on page load; if it plays once on either tab, mission accomplished. |
| 15.11 | Admin sets `display_at` to a date in the past | Treat as "now" - pill becomes `available` immediately on next page load. |
| 15.12 | Admin uses a category that has zero items | Pill renders as `planned`, click is inert. Tooltip: "התוכן בהכנה." |
| 15.13 | Subscription cancelled mid-rail | All future unlocks halt. Rail entries freeze at their last state. User sees a banner: "המנוי שלך פג. כדי להמשיך את המסע, יש לחדש." |
| 15.14 | Rail query times out | Render skeleton for 3 s, then a quiet "טוענים את התוכן שלכם…" line. After 10 s, render the rail collapsed with a "Try again" link. |

## 16. Performance & rendering strategy

### 16.1 Rendering budget

| Component | Mode | Rationale |
|---|---|---|
| `/my/page.tsx` | RSC, `force-dynamic` | Data is per-viewer, can't be cached across users. |
| Pillar grid | RSC | Only 3 cards, derived from already-loaded entitlements. |
| Journey rail | RSC | Single fetch, ≤ 10 rows expected per user. Inlined into the same RSC tree as the page. |
| Work-area tabs | Lazy / client | Tab content is heavy; load on click via `Suspense`. |
| Comment box | Client | Form input, optimistic update. |

### 16.2 Caching

- `getUserEntitlements`: already memoized per request via `cache()`.
- `getOwnerJourneyStatus`: same.
- `buildRailForOwner`: SAME - wrap in `cache()` so multiple components
  on the same page share one fetch.

No HTTP-level caching (`revalidate`); per-user data with personal
implications can't be cached at the edge.

### 16.3 Query budget

`/my` should hit the DB **at most 7 times** per render:

1. `auth.users` lookup (Supabase session middleware)
2. `getCurrentCoupleContext`
3. `getUserEntitlements`
4. `getOwnerJourneyStatus` → 2 sub-queries (assignments + assessment)
5. `buildRailForOwner` → 2 sub-queries (planned + scheduled)
6. `countUnreadJourneyItems`
7. (Adults only) `listOwnedGamesForCouple`

Anything more is a regression. CI test: snapshot the network panel
and assert ≤ 7 Supabase requests on `/my` page load.

### 16.4 Sparkle / animation

The new-content sparkle (§22) is a CSS-only animation gated by
`prefers-reduced-motion`. Plays once per item per session via
`localStorage["mioshy:sparkled"] = JSON array of scheduled_item_ids`.

## 17. Design system primitives

We extract three shared components so the same visual rule can't
drift across pages.

```
components/ui/
├─ StateBadge.tsx       (§3 - exhaustive variants)
├─ Pillar.tsx           (the dark glass card primitive)
├─ JourneyRailPill.tsx  (§4 - single rail item)
├─ NotificationDot.tsx  (§22)
├─ SparkleBurst.tsx     (§22)
└─ ResponseBox.tsx      (§21)
```

### 17.1 Pillar primitive

```tsx
<Pillar
  variant="games" | "journey" | "adults"  // controls ambient color
  state={pillarState}                     // §3
  title="ליווי עם מיאושי"
  subtitle="תוכנית עבודה אישית"           // small slate caption
  description="…"
  cta={{ label, href, variant: "primary" | "ghost" }}
  notificationCount={3}                   // optional
  // Journey only - composes the rail INSIDE the card on mobile
  embedded={<JourneyRailMobile entries={...} />}
/>
```

### 17.2 Motion rules

- **Static by default**. The dashboard does not move.
- **Allowed motion**:
  - Hover lift on clickable pillar cards (`hover:-translate-y-0.5
    transition-transform duration-200`)
  - One-shot sparkle for newly-unlocked items (§22)
  - Tab-content fade-in on `Suspense` reveal
- **Not allowed**:
  - Pulsing badges
  - Auto-rotating carousels
  - Color-cycling loaders (use a static spinner)

### 17.3 Spacing scale

The page uses Tailwind's default spacing tokens, but only these
multipliers: `2, 3, 4, 5, 6, 8, 10, 12, 16`. No `7`, no `14`. This
gives a consistent rhythm; PR reviewers can flag deviations.

## 18. Migration strategy for existing users

### 18.1 Backfill

Single migration script seeds `journey_user_planned_categories` for
**every existing user with a Journey subscription** with the six
standard topics, all `display_at = null` (status `planned`):

```sql
-- supabase/migrations/050_backfill_planned_categories.sql
insert into public.journey_user_planned_categories (user_id, category_id, sort_order, origin)
select s.user_id, c.id, c.sort_order, 'program_seed'
from public.subscriptions s
cross join public.journey_categories c
where s.product = 'journey'
  and s.status in ('active', 'past_due')
  and c.slug in (
    'communication', 'intimacy', 'love-and-connection',
    'friendship-and-daily-life', 'family-and-stress', 'assessment'
  )
on conflict do nothing;
```

Idempotent. Safe to re-run.

### 18.2 In-flight users

Users mid-assessment OR with an active assignment **see no change in
behavior** on day 1 - the rail merges existing scheduled items with
the new planned categories. The only new visual is the rail; nothing
about `/my/journey` itself changes.

## 19. Observability & debugging

### 19.1 Structured events

Every state evaluation, CTA click, and rail render emits a structured
log line via the existing Vercel runtime logger:

```
[my:page] {
  "event": "page_rendered",
  "user_id": "f3d0...",
  "couple_id": "c2a1...",
  "pillar_states": { "games": "not_purchased", "journey": "in_progress", "adults": "not_purchased" },
  "rail": { "mode": "real" | "planned_only", "entry_count": 6, "available_count": 1 },
  "render_ms": 412
}

[my:cta_clicked] {
  "user_id": "...",
  "pillar": "journey",
  "from_state": "in_progress",
  "destination": "/he/my/journey"
}

[journey:rail_entry_unlocked] {
  "user_id": "...",
  "scheduled_item_id": "...",
  "category": "communication",
  "first_view": true,
  "sparkle_played": true
}
```

These flow through Vercel logs. Optional: pipe to PostHog (if env
`POSTHOG_KEY` is set) for analytics.

### 19.2 Admin debug overlay

Behind the existing `system_admins` check, `/my?debug=1` enables a
small fixed overlay at the bottom-right:

```
┌────────────────────────────────────────┐
│ DEBUG (system_admin)                   │
│ user: test2@gmail.com                  │
│ couple: solo                           │
│ pillar.journey: in_progress            │
│ rail.mode: planned_only                │
│ rail.entries: 6 (0 available, 0 next)  │
│ next unlock: -                         │
│ render_ms: 412                         │
└────────────────────────────────────────┘
```

Not visible to regular users. Lets clinicians see exactly what
state the user is in without DB access.

### 19.3 Anomaly table

```sql
-- supabase/migrations/051_journey_state_anomalies.sql
create table public.journey_state_anomalies (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade,
  kind         text        not null,    -- 'corrupt_created_at', 'cta_no_match', 'race_unlock', etc.
  detail       jsonb,
  created_at   timestamptz not null default now()
);
```

Any time `derivePillarState` falls into a default branch it shouldn't,
or `buildRailForOwner` sees inconsistent data, we insert a row here.
A daily cron emails the on-call clinician an aggregate. This is the
"smoke detector" of the SaaS - silent in success, loud in failure.

## 20. Admin / clinician workflow

The professionals using this product are psychologists and relationship
coaches. The admin surface must let them work fast: read clients,
respond to clients, schedule content. Today the admin is at
`/[locale]/dashboard/admin/...`. We expand it.

### 20.1 Client list - daily landing

Top-level tab shows every client (or every couple) with a row per
client. Columns:

- Name / email
- Pillar status (badges, same as the user-facing dashboard)
- Last activity (in days)
- Pending responses count (red dot if > 0)
- Next scheduled item (date / category)
- CTA: "פתח" → `/dashboard/admin/clients/<id>/journey`

Sortable by pending responses (default). The clinician's first job
each morning is "who needs a reply?"

### 20.2 Client detail - journey tab

Inside the client view, the Journey tab shows three columns:

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ Assessment          │ Active Items        │ Planned             │
│  (read-only,        │  (set unlock,       │  (drag categories,  │
│   collapsed)        │   add notes)        │   set display_at)   │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

The clinician composes the user's journey here. Drag a category from
"Planned" to "Active Items"; choose items inside; set `unlock_at`.
Save. The user's rail picks it up on next page load.

### 20.3 Inbox - recent responses across all clients

A separate tab that is the **clinical heartbeat** of the app:
real-time list of `journey_item_responses` rows from any client,
newest first. Each card shows:

- Client name + couple
- Item title + category
- Response text (truncated)
- Tags: "Concerning" (admin-set), "Resolved", "Open"
- Inline reply box

This is critical to the "expert is reading" promise we make to users
in §1.5. If admins can't easily find responses, the promise is empty.

### 20.4 "View as user"

Toolbar button on every client detail page: "View as this user".
Opens `/[locale]/my?as=<user_id>` in a new tab, rendering the
client-side dashboard from that user's perspective (service-role
impersonation, gated on `system_admins`). Lets clinicians SEE what
their client sees without phone calls.

## 21. Reactions / response system

The user said: "לכל מקום שהם חשופים נאפשר להם להגיב, ואנחנו צריכים
למשוך את התגובה ולהציג מי הגיב, מאיזה חלק, שנוכל לנהל את זה".

### 21.1 Where the user can respond

- Every `journey_scheduled_item` detail page
- The post-assessment summary screen
- Each "active" rail item, via the work-area tab

A `<ResponseBox>` component is dropped into all three. Same
component, same UX:

```
┌─────────────────────────────────────────────────┐
│ מה עולה לכם מהפריט הזה?                          │
│ ┌─────────────────────────────────────────────┐ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ □ פרטי - רק אני והמלווה רואים                    │
│                                       [שלח →]   │
└─────────────────────────────────────────────────┘
```

### 21.2 Storage

`journey_item_responses` already exists from migration 035. Schema:
- `id`
- `scheduled_item_id`
- `user_id`
- `response_text`
- `is_private`
- `created_at`

We extend it for clinician workflow:

```sql
-- supabase/migrations/052_journey_responses_clinician_fields.sql
alter table public.journey_item_responses
  add column if not exists clinician_status text
    check (clinician_status in ('open', 'resolved', 'concerning'))
    default 'open',
  add column if not exists clinician_id uuid references auth.users(id) on delete set null,
  add column if not exists clinician_reply_text text,
  add column if not exists clinician_replied_at timestamptz;

create index on public.journey_item_responses (clinician_status)
  where clinician_status = 'open';
create index on public.journey_item_responses (created_at desc);
```

### 21.3 User-side indicator

When a clinician replies, the user sees:
- Notification dot on the relevant rail entry
- A small "תגובה חדשה מהמומחה שלכם" toast on next page load
- Inline reply visible inside the item view

### 21.4 Clinician-side surfacing

§20.3's Inbox is powered by:

```sql
select jir.*, ji.title_he, jc.name_he as category, au.email as client_email
from public.journey_item_responses jir
join public.journey_scheduled_items jsi on jsi.id = jir.scheduled_item_id
join public.journey_items ji on ji.id = jsi.item_id
join public.journey_categories jc on jc.id = ji.category_id
join auth.users au on au.id = jir.user_id
where jir.clinician_status = 'open'
order by jir.created_at desc
limit 100;
```

## 22. Notifications & "new content" indicator

### 22.1 Three signals

| Signal | Where | When |
|---|---|---|
| Notification dot | Pillar card top-right | Any unread items in that pillar |
| Sparkle burst | On rail entry that's newly available | One-shot, first view after unlock |
| Toast banner | Top of `/my` page | Clinician posted a new reply since last visit |

### 22.2 Implementation

- Dot count: `countUnreadJourneyItems` (already exists; we plug it
  into both pillar card AND each rail entry).
- Sparkle: server passes `firstViewItemIds: string[]` to a client
  component; that component renders a `<SparkleBurst>` for each id
  on mount, then writes the ids to the existing `notified_at`
  column so it doesn't repeat. (Bonus: also writes to
  `localStorage["mioshy:sparkled"]` so a quick second tab in the
  same session doesn't double-fire.)
- Toast: a server fetch of `journey_item_responses` rows where
  `clinician_replied_at > user.last_seen_at` triggers a `<Toast>`.

### 22.3 Sparkle visual

A 600 ms animation: 5 small white dots radiating from the center of
the rail pill, fading out. Respects `prefers-reduced-motion` -
motion-reduced users see a static `Sparkles` icon instead.

## 23. KPIs / definition of "shipped"

Engineering "done" is in §12. Product "done" is here. We don't ship
this redesign without an answer to each of these.

| Metric | Target | Measure how |
|---|---|---|
| Activation rate | ≥ 65% | % of paid users who finish the assessment within 7 days of subscribing |
| Time-to-first-content | ≤ 24h | Median time between assessment completion and first item unlocked |
| Rail engagement | ≥ 40% weekly | % of subscribed users who click a rail entry per week |
| Response rate | ≥ 25% per item | % of unlocked items that get a `journey_item_responses` row |
| Clinician SLA | ≤ 48h | Median hours between user response and clinician reply |
| Support tickets ("איך נכנסים…?") | ↓ 50% | Compare 30 days before/after launch |
| Rail "broken state" rate | < 1% | `journey_state_anomalies` rows / unique users |

After launch, we revisit these numbers weekly for the first month.
Any metric below target gets its own design exercise.

## 24. Open questions / decisions still needed

These are the things I (the engineer) couldn't decide on my own. Tag
each with an owner and resolve before Phase D ships:

| # | Question | Suggested default | Decide who |
|---|---|---|---|
| 24.1 | Are couple-level responses shown to both partners? | Yes if `is_private=false`, no otherwise | Product |
| 24.2 | When a clinician marks a response "concerning", does the user know? | No - internal flag only | Product / Clinical |
| 24.3 | Do we show the rail to users on `cancelled` subscriptions? | Yes, frozen, with "renew" CTA on the pillar card | Product |
| 24.4 | Mobile: rail above pillars, OR rail tucked inside the journey pillar card? | Above (consistent across breakpoints) | Design |
| 24.5 | Internationalization - when do we ship the English version? | After the Hebrew version proves out (post-launch) | Product |
| 24.6 | Is there a length cap on `response_text`? | 2000 chars, soft warning at 1500 | Product |
| 24.7 | Should clinicians see auth user email in the Inbox? | Yes, clinicians have signed clinical-care agreements | Legal / Compliance |

