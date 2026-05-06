# Journey - Expert Onboarding & Workflow Guide (Discovery + Spec)

**Status:** Discovery + spec only. No code in this run.
**Author:** Claude, 2026-05-02.
**Companion docs this builds on:** [docs/journey-content-system-discovery.md](docs/journey-content-system-discovery.md), [docs/journey-content-system-design.md](docs/journey-content-system-design.md).
**Audience for the guide we're proposing:** A couples therapist with admin or expert role on `/dashboard`. Computer-comfortable but not a power user. Hebrew-primary. Has never seen a CMS like this before.

---

## 0. TL;DR

The Journey admin shipped feature-complete in v3 - every workflow Itzik specified has a working surface. But the labels read like a database schema (`anchor_kind`, `default_offset_days`, `materialize`, `replace vs interleave`, `cadence engine`), the empty states say "no rows yet" instead of "here's how to start," and there's no first-day landing experience that orients a new clinician.

A new expert today opens `/dashboard` and sees a sidebar with **18 menu items** spanning Games / Journey / Adults / Users / Coaching / Marketing / System. Inside the Journey group alone there are **10 sub-pages** (Programs, Categories, Items, Assignments, Clients, Groups, Push, Health, Analytics). They have no map for which to click first, what's product-owner work vs clinical work, or what runs by itself in the background.

**Recommended fix is a UX layer, not a rebuild.** Three additions:

1. **A live setup checklist + guide hub** at `/dashboard/journey/guide` (HE-first) that detects what's done and what isn't.
2. **Inline `?` popovers** on every jargon-laden field (~40 spots identified in the audit below) linking back to the guide.
3. **Better empty-state copy + an "automatic vs manual" sidebar** on the health board so the implicit behaviour becomes legible.

The whole guide is bilingual content layered over the existing admin - no schema changes, no parallel system, no replacement for the dashboard.

One important persona split this report makes explicit (the brief used "admin" and "expert" interchangeably): the Journey admin actually serves **two distinct roles** today, and the guide should branch by role.

| Role | What they do daily | Sidebar entries they touch |
|---|---|---|
| **Product owner / content admin** (Itzik) | Build catalog, create groups, run pushes, watch health | Programs, Categories, Items, Groups, Push, Health, Analytics, Import/Export |
| **Clinician / expert** (the new persona) | Read clients' responses, reply to messages, push items to specific couples, monitor engagement | Clients, My Clients, Push, Per-couple workspace |

The guide should default to clinician framing and surface admin-only sections as "for the team that maintains the catalog" - not the expert's daily work.

---

## 1. Phase 1: Discovery

### 1.1 First-day onboarding gap

A new clinician signs in. Here's what they see, in order, with no guidance:

1. **Sidebar** ([components/dashboard/Sidebar.tsx:103-117](components/dashboard/Sidebar.tsx)): a Journey group containing **Programs · Categories · Items · Assignments · Clients · Groups · Push · Health · Analytics**. All entries are English, none have tooltips, the order doesn't match the typical workday.

2. **Dashboard root** ([app/dashboard/page.tsx](app/dashboard/page.tsx)) is a Games-themed summary: total games, recent games, KPI strip. A Journey clinician landing here sees nothing relevant. The instinct to click "Journey" in the sidebar isn't broken - it's just not signposted as the right next step.

3. **Journey hub** ([app/dashboard/journey/page.tsx](app/dashboard/journey/page.tsx)) opens with the description: *"Time-released roadmaps for couples. Build programs, categories and items here; assign to owners (user or couple) in the clients view. Content edits propagate retroactively."* Three jargon terms in two sentences (*time-released, owners, propagate retroactively*) and zero direction on what a clinician should click.

4. **Section tiles** show counts (Programs / Categories / Items / Active owners / Active assignments). Useful for an admin running ops; useless as a "where do I start" affordance for a clinician.

5. **DataTools panel** sits at the bottom of the Journey hub with three buttons: **Templates · Import CSV · Export ZIP**. A clinician will not touch these in their first month, but they're equally weighted with the rest.

**Specific frictions a new expert hits in the first 5 minutes:**

- No "Welcome - what would you like to do?" affordance.
- No persona detection; admin and clinician get the same hub.
- No mention of `/dashboard/my-clients/[coupleId]` (the actual clinical workspace) anywhere on the Journey hub.
- The Coaching sidebar group (which contains "My Clients" and "Clinician queue") is *separate* from Journey - a clinician must guess that "their" workspace is over there.
- Hebrew presence is content-only; chrome is English.

### 1.2 Per-workflow audit

Below: the exact click path today, the friction a non-engineer hits, and the missing affordances. Audit-grade detail.

#### 1.2.1 Add a new content item to an existing category

**Path today.** Sidebar → Items → "+ New item" → category picker (`/dashboard/journey/items/new`) → click a category → server-action `createAndRedirectNewItem()` mints an empty row and redirects to `/dashboard/journey/items/[id]` → fill `ItemForm` → save.

**Friction.** Two blind spots:
1. The category picker page ([items/new/page.tsx:49-51](app/dashboard/journey/items/new/page.tsx)) says "Pick a category - every item must belong to one." But a new admin landing here cold has no idea why categories matter, or that they could've started from `/dashboard/journey/categories/[id]` and skipped this step.
2. After save, no "Save and add another" button. Returning to add a second item requires `Back to items` → `+ New item` → category picker again. Adding 10 items takes ~30 navigation hops.

**Field-level gaps.** ItemForm has many fields that need a couples-therapist explanation:
- `Default offset (days)` - hint says "0 = unlocks on anchor day" ([ItemForm.tsx:171-180](components/dashboard/journey/ItemForm.tsx)) but "anchor day" is jargon defined nowhere in this form.
- `Audience` - hint *is* good ("Who in the couple sees this item. Solo timelines always see 'both'.") but the three-way enum (`both / owner / partner`) is technical: a clinician will read "owner" and wonder which partner that is.
- `kind` (assessment/reflection/content) - discriminator with no inline explanation; it's only revealed when the AssessmentEditor opens further down the page.
- `subtopic_id` - hint says "Optional. Leave as 'None' to hang directly off the category." Good copy but no model of *why* an item would be in a subtopic vs direct.

**Missing affordances.**
- "Save & add another" button.
- "Preview as the user sees it" button (renders the item card the way `/journey/timeline/[scheduledId]` would).
- "Duplicate this item" button (clinicians often want a near-copy with one tweak).

#### 1.2.2 Add a new category (with or without subtopics)

**Path today.** Sidebar → Categories → "+ New category" → `createAndRedirectNewCategory()` mints a blank row → edit form → save → scroll down to `CategoryChildrenManager` → "+ New subtopic" → blank row → edit → save → back to category page → repeat for items.

**Friction.**
- The blank-row-then-edit pattern is unusual. A clinician clicking "+ New" expects a fresh form, not a redirect to an already-saved row. The mental model is broken.
- The `CategoryChildrenManager` lives below the form, not next to it. A new admin will save the category and assume they're done - they won't scroll to see they should be adding subtopics.
- No drag-reorder for subtopics OR for items inside subtopics. The sort order is editable as a numeric field per row, which scales badly past 5 entries.
- The category form's `program_id` field (Standalone vs program) is the very first dropdown. A new admin without programs will see nothing in the dropdown and be confused - should there be programs? The page doesn't tell them programs are optional.

**Missing affordances.**
- Inline subtopic creation (modal) instead of the redirect dance.
- A "structure preview" panel showing `Category → Subtopic → Item` tree as you build it.
- A "what's a subtopic for?" inline explainer (it's a mid-tier grouping for cadence-engine targeting).

#### 1.2.3 Bulk import content from CSV (Google Sheet path)

**Path today.** `/dashboard/journey` → DataTools panel → "Templates" downloads a ZIP of three CSVs → admin fills in spreadsheet → "Import CSV" opens file picker → upload → modal shows summary (`total / created / updated / failed`) with expandable error list.

**Friction.**
- The "Templates" button doesn't say *what* templates. New admins click it expecting a list of pre-made templates ("Communication starter pack", etc.) - they get an empty CSV scaffold instead.
- The auto-detection logic ([import/route.ts:71-81](app/dashboard/journey/import/route.ts)) reads the first column header to decide if this is a programs/categories/items file. Robust, but invisible: there's no UI confirmation of "we detected this as an ITEMS file."
- Error rows say things like "category_id not found: abc-123" with no link to fix the missing category.
- No dry-run. Big imports go straight to prod.
- Assignments are *not* importable via CSV - the page doesn't say so anywhere; admins discover by trying.
- The Google Sheet URL is mentioned only in `docs/journey-content-system-discovery.md`, not in the admin. Admins don't know which Sheet to copy from.

**Missing affordances.**
- A pre-flight "Validate my CSV" button that runs the row-by-row validator without committing.
- A "Convert from Google Sheet URL" path (paste the URL, the server fetches the published CSV and runs the importer). This was deferred per the v3 brief; clinicians should at least see a clear "paste a CSV here" path.
- An import history page (last 10 imports + their summaries).

#### 1.2.4 Find a customer + inspect their state

**Path today.** Sidebar → **Clients** → search by email/name/pair-code → click row → `/dashboard/journey/clients/[ownerKey]` opens. Cadence inspector panel renders queue snapshot, eligibility verdict, recent skips.

**Friction.**
- The "Clients" list page sorts by "Last added" (when an admin assigned to them) - not by recency of customer activity. A clinician wanting "who's active this week" must read each row's progress %.
- The cadence inspector (slice 9 deliverable) is excellent in content but visually buried below the assignment cards. A clinician looking for "is this user OK?" must scroll.
- No filter for "users with unresponded items" or "users in grace" or "users with pending pushes."
- The couple workspace at `/dashboard/my-clients/[coupleId]` is a *different surface* from `/dashboard/journey/clients/couple:<id>`. Both exist, both are reachable, neither links to the other clearly. A clinician will get lost between them.

**Missing affordances.**
- Saved filters on the Clients list ("Stuck this week" / "Active in cadence" / "In grace").
- A single canonical "open customer X" entry point that lands on whichever page is most useful for the moment (probably the per-couple workspace for clinicians).
- Inline "push to this user" button on the Clients row (shortcut to `/dashboard/journey/push?recipient=user:X`).

#### 1.2.5 Create a group, add members, bind subtopics

**Path today.** Sidebar → **Groups** → "+ New group" → `createAndRedirectNewGroup()` mints a blank row → `GroupForm` (slug, label_he, label_en, description, is_active) → save → scroll to `GroupMemberPicker` (search + add) → scroll to `GroupSubtopicBinder` (subtopic dropdown + mode select).

**Friction.**
- The page description ([groups/page.tsx:45-51](app/dashboard/journey/groups/page.tsx)) reads: *"Cohorts of users bound to specific subtopics. The cadence engine respects each binding's mode - replace hides the subtopic from members' auto-cadence, interleave lets cadence pick from it normally while leaving room for admin pushes."* - every term except "cohort" is jargon.
- "Replace vs interleave" is explained in the page header but NOT on the binder row where the admin actually picks the mode. By the time they click the dropdown they've forgotten what each option does.
- Members are added one at a time. No bulk paste-emails or upload-CSV.
- `addCoupleAsGroupMembers` (the slice-7 sugar that adds both partners of a couple in one click) exists in the action layer but the picker UI label just says "Add user" - there's no obvious "add this whole couple" affordance.
- Group cadence-overrides (`curated_per_week_override`, `random_per_week_override`, `priority_weights_override`) exist in the schema but aren't surfaced in the form. A clinician who reads the column names would expect to tune cadence per group; the UI doesn't let them.

**Missing affordances.**
- Inline tooltips on "replace" / "interleave" in the binder dropdown.
- Bulk member add via paste (newline-separated emails).
- "Test cadence" preview: simulate the next 4 weeks for a sample member of this group.
- Drag-reorder for bindings.

#### 1.2.6 Push specific content to a user / couple / group

**Path today.** Sidebar → **Push** → 3-step composer (recipient → items → reason note) → submit → toast → pending pushes flow on the recipient's next delivery slot.

**Friction.**
- The page description ([push/page.tsx:57-63](app/dashboard/journey/push/page.tsx)) names *"delivery slot," "cadence engine," "pending pushes," "ranked picker"* - four jargon terms in three sentences.
- The footer preview reads: *"Will create N pending push rows (M items × K targets via [recipient])."* "Rows" is database-speak; clinicians count "items pushed," not "rows created."
- No preview of WHEN the items will land. The cadence engine drains one push per slot - for a default 1/week recipient, pushing 3 items means three weeks of delivery. The composer doesn't show this.
- Pushes are not deduplicated. Pushing item X to a user who already has X queued (or who already received X via cadence) creates a second pending row that the engine silently drops. No warning.
- No "undo push" button. Clinicians who fat-finger a recipient must SQL-edit the pending_pushes table.
- "Push to a group" sends to ALL active members. No subset selection. A 100-member group push is all-or-nothing.

**Missing affordances.**
- Schedule preview: "Item X will land approximately on Mon May 11."
- Dedup warning: "User already has this item in their queue (pushed 3 days ago)."
- Recall/undo within a 24h window.
- Subset member selection on group push.

#### 1.2.7 Reply to a customer's per-item response or general-channel message

**Path today (per-item).** Sidebar → **Coaching** → **My Clients** → couple page (`/dashboard/my-clients/[coupleId]`) → scroll to "Client Responses Inbox" → click "Reply" on a row → inline composer → "Mark as resolved" checkbox → Send. The reply lands in `journey_messages` AND the legacy `journey_item_responses.clinician_reply_text` (slice 8 dual-write).

**Path today (general channel).** **Doesn't exist for admins.** The user posts via `/my/journey` general channel; messages land in `journey_user_messages` AND `journey_messages`; the dashboard shows them in `ClientMessagesList` as **read-only**. The expert reply server action `postExpertReplyToChannel` exists (slice 6/8) but no UI surfaces it. Confirmed in the slice 6 + slice 8 reports.

**Friction.**
- Per-item replies are inline modals, not threaded conversations. The clinician sees one user response, types one reply, hits send. There's no view of the back-and-forth the user sees on `/my/journey` (slice 6 added a real thread but only on the *user* side).
- "Mark as resolved" checkbox defaults to true. Clinicians who want to reply *without* closing the case must remember to uncheck.
- No reply templates. Same boilerplate ("תודה על השיתוף - נמשיך מכאן בשבוע הבא") gets typed dozens of times.
- General channel is asymmetric: users write to clinicians, clinicians can't write back from the dashboard. They'd have to go through the per-item surface even when the conversation isn't tied to an item.
- No keyboard shortcut to send (Cmd+Enter).

**Missing affordances.**
- The general-channel admin reply UI (flagged in slice 6 + slice 8 reports as deferred).
- Reply templates per clinician.
- A "thread view" that shows the same conversation users see on `/my/journey`.
- An unread badge in the sidebar so clinicians don't have to drill to discover unanswered messages.

#### 1.2.8 Read the health board and act on a stuck-user alert

**Path today.** Sidebar → **Health** (admin-only) → page renders Cron jobs (last 24h) + Pending pushes summary + Stuck users table + (slice 10) Admin alerts banner. Click a stuck user → `/dashboard/journey/clients/user:<uid>`.

**Friction.**
- Health is admin-only by design but clinicians who DO have admin role (most do, today) will see it and have no idea what "stale" means or what to do about a failed cron.
- The cron table is read-only. No "retry" button. A clinician seeing "FAILED" is told to investigate but has no path to act.
- The stuck-user table says "5 days idle" without telling the admin *what to do*: push to them? Wait? Send a manual nudge? The header text ([health/page.tsx:127-129](app/dashboard/journey/health/page.tsx)) is helpful for an engineer ("check priority ranking + active items in their categories") but not for a clinician.
- The admin alerts banner (slice 10) renders raw HTML from the digest preview. Functional, but feels like inspector output, not a clinical surface.

**Missing affordances.**
- Per-stuck-user "send a nudge" or "push first item" one-click.
- Plain-Hebrew explanations of each cron's purpose ("כל 15 דקות: בודק מי בתור לקבל פריט חדש").
- A simple "everything is OK" or "needs attention" hero at the top, instead of three equally-weighted sections.

### 1.3 Automatic-vs-manual map

A clinician's first question is "what runs by itself, what do I have to do?" Today the answer is buried. Here's the canonical map (synthesized from the cron + action layer audit):

| Surface / outcome | Triggered by | Lives in |
|---|---|---|
| **First item delivers** the moment a user finishes the assessment | User event (assessment submit) → server-side `onPriorityRankingSubmitted` | `lib/journey-content/cadence-trigger.ts` |
| **Next item delivers** every Monday (default) at 09:00 UTC | Cron `cadence_advance` every 15 min | `app/api/journey/cadence/advance` |
| **Email "your item is ready"** lands within an hour of delivery | Cron `notify_unlocks` hourly :15 | `app/api/journey/notify-unlocks` |
| **In-app notification** for the same unlock | Side-effect of `notify_unlocks` | `lib/journey-content/notifications.ts` |
| **Subscription expiry → grace banner** | Cron `grace_watcher` hourly :00 (pass 1) | `app/api/journey/grace-watcher` |
| **Grace expiry → block banner** | Same cron, pass 2 (14 days later) | same |
| **Skipped-item flag** (item past 14 days with no response) | Cadence engine's skip-sweep on next materialize | `lib/journey-content/cadence-engine.ts` |
| **5-day idle reminder** | Cron `reminders` daily 08:00 | `app/api/journey/reminders` |
| **24h-since-expert-reply nudge** | Same cron | same |
| **Stuck-user digest email** to admin pool | Same cron | same |
| **Cron failure email** to admin pool | Side-effect of `runWithCronLog` on `ok=false` | `lib/journey-content/cron-log.ts` |
| **User scores recompute** | Cron `scores_recompute` daily 04:00 | `app/api/journey/scores/recompute` |
| **Cardcom payment success → grace columns clear → cadence resumes** | Cardcom webhook | `app/api/billing/cardcom/indicator/route.ts` |
| **Cardcom payment failure → 7-day grace_until** | Cron `renewals/run` daily 06:00 | `app/api/billing/renewals/run` |

| Surface / outcome | Triggered by | Where the admin clicks |
|---|---|---|
| **A new content item appears in the catalog** | Admin click | Items → New |
| **A category, subtopic, group, program is created** | Admin click | Each respective list page |
| **An assignment is created** (legacy v2 path) | Admin click OR purchase webhook | Assignments → New OR `cardcom/indicator` |
| **An item is pushed to a user / couple / group** | Admin click | Push composer |
| **A clinical reply is posted** | Admin/expert click | Per-couple workspace → response inbox |
| **A user is added to a group** | Admin click | Group page → member picker |
| **A subtopic is bound to a group with replace/interleave mode** | Admin click | Group page → subtopic binder |
| **CSV import** | Admin click | Journey hub → DataTools → Import |

Items NOT shown: completion (user clicks "Mark complete"), response (user types in PerItemThread), priority ranking change (user reorders on /my/journey).

This map is what should sit on `/dashboard/journey/health` (and probably also at the top of the guide hub) so clinicians know which lever moves which switch.

### 1.4 Empty-states audit

| Page | Empty-state copy today | Grade | Why |
|---|---|---|---|
| Programs list | "No programs yet - create one." | OK | Actionable button visible |
| Categories list | "No categories yet - click \"New category\" to add one." | OK | Actionable but minimal |
| Subtopics (inside category page) | (no row case handled by the picker) | n/a | |
| Items list (no filter) | "No items yet - click \"New item\" to add one." | OK | Actionable |
| Items list (filtered to category with 0 items) | "No items in this category yet." | OK | Contextual |
| Items list (filtered to subtopic with 0 items) | "No items in this category yet." | **bad** | Wrong copy - says "category" when filter is subtopic |
| Groups list | "No groups yet - click \"New group\" to create the first cohort." | OK | Actionable |
| Group members panel (empty) | "No members yet. Use the search above to add someone." | OK | Actionable |
| Group bindings panel (empty) | "No bindings. Use the picker below to bind a subtopic." | OK | Actionable |
| Assignments list | "No assignments yet. Create one to materialize a timeline." | **bad** | "materialize a timeline" is jargon |
| Clients list (no clients at all) | "No clients yet - bulk-assign a program to someone to see them here." | **bad** | "bulk-assign" is internal-tools-speak |
| Clients list (search no hits) | "No clients match \"<query>\"." | OK | Contextual |
| Per-couple workspace empty assignments | "No content assigned yet - use the form above to prescribe a program, category, or single item." | OK | Actionable + clinical tone ("prescribe") |
| Push page (no recipient picked) | "Pick a recipient and at least one item to enable the push." | OK | Helpful |
| Health → cron table | (always populated; no empty state) | OK | |
| Health → stuck users | "All clear - nobody is stuck." | **excellent** | Confidence-building copy |
| Health → admin alerts banner | (renders nothing when zero) | OK | |
| Per-item thread (no messages) | "No messages in this thread yet. Your response opens it." | OK | User-side; clinical empty state is on inbox |
| General channel (no messages) | "No messages yet. Send your first one below." | OK | User-side |
| Guide hub (proposed) | doesn't exist | - | This whole report is about adding one |

Three empty states need rewrites: items-list-with-subtopic-filter (wrong copy), assignments-list ("materialize a timeline"), and clients-list ("bulk-assign a program"). All three would be one-line fixes during the implementation slice.

### 1.5 Inline help gaps

The full audit found ~40 fields/buttons whose meaning isn't obvious to a clinician. The 20 highest-leverage gaps:

| # | Surface | Field/button | What's missing |
|---|---|---|---|
| 1 | Sidebar | "Push" entry | Tooltip: "Send specific items to a user / couple / group on their next delivery slot" |
| 2 | Sidebar | "Health" entry | Tooltip: "System status - cron jobs and stuck-user alerts" |
| 3 | Sidebar | "Assignments" entry | Tooltip: "Programs/categories/items assigned to specific clients" |
| 4 | Sidebar | "Groups" entry | Tooltip: "Cohorts of users bound to specific subtopics" |
| 5 | Journey hub | Page description | Strip "time-released roadmaps" jargon, write for clinicians |
| 6 | ItemForm | `Default offset (days)` | Define "anchor day" inline |
| 7 | ItemForm | `Audience` | Replace "owner / partner" with names ("Partner A / Partner B") and clarify when to use targeted audience |
| 8 | ItemForm | `kind` (in AssessmentEditor) | Define content / assessment / reflection inline; show example output |
| 9 | ItemForm | `Subtopic` (Optional) | Explain WHY one would use a subtopic |
| 10 | CategoryForm | `program_id` (Standalone vs program) | Explain that programs are optional bundles; standalone is normal |
| 11 | GroupForm | (no mode field on form) | Add a "before you save: don't forget to bind a subtopic" hint when bindings are empty |
| 12 | GroupSubtopicBinder | `mode` dropdown | Per-row inline tooltip on Replace and Interleave with concrete examples |
| 13 | GroupSubtopicBinder | "Save bindings" | Tooltip: "Replaces ALL bindings for this group with the list above" |
| 14 | AssignmentForm | `Anchor kind` | Define "anchor"; the existing option labels are good but the term itself isn't explained |
| 15 | AssignmentForm | `Origin` | Explain what reports use this; default is fine, when would you change? |
| 16 | AssignmentForm | "Preview materialization" | Plain-language: "Show how many items will be scheduled" |
| 17 | AssignmentForm | "Create + materialize" button | Plain-language: "Create assignment + schedule items to the timeline" |
| 18 | PushComposer | "pending push rows" preview | "items queued for delivery" instead |
| 19 | PushComposer | (no field) | Add a "next delivery is on…" preview when a recipient is picked |
| 20 | Health | Cron table headers | Tooltip on "Stale" explaining the 1.5× threshold; tooltip on "Σ rows 24h" defining the unit |

Smaller stuff (column tooltips on Categories/Items/Programs lists for `Sort` and `Offset`, `Q/D/C/S` legend on the items list, hint visibility - currently `text-[10px] text-muted-foreground` is barely readable) are mechanical fixes that should happen in the same slice.

**Hebrew/English mix.** The Sidebar, all form labels, all empty states, all hints, and every button are English. Only content (`name_he`, `title_he`, `body_he`, `label_he`) is bilingual. For a Hebrew-primary therapist, this means the chrome is a foreign-language CMS sitting on top of their actual material. Two ways to address this in the guide layer:

- **Translate the chrome.** Big lift. Out of scope for this guide.
- **Translate the GUIDE only**, write hints in HE, and keep the underlying admin chrome in English. This is what I'm proposing - minimal disruption + fast win.

---

## 2. Phase 2: Spec - what to build

The guide is a thin UX layer over the existing admin. Five components:

### 2.1 Live setup checklist + guide hub

**Path:** `/dashboard/journey/guide`. New top-level entry in the Journey sidebar group, between *Push* and *Health*.

**Default view (HE):** A two-column layout.

- **Left column:** "מתחילים כאן" - a 6-item checklist that detects current state and ticks items as they're done. Each row links to the relevant admin surface OR to a deep-dive guide page. Rows that aren't done have a "Do this →" button.
- **Right column:** "מה עובד אוטומטית" - the auto/manual map (§1.3) reformulated as 4 plain-Hebrew lines per cron.

**The 6 checklist items (default; admin can dismiss any):**

1. ✓/○ **5 קטגוריות פעילות** - detected from `count(journey_categories WHERE is_active AND assessment_priority_key IS NOT NULL)`. Should always be ticked post-install.
2. ✓/○ **לפחות פריט אחד בכל קטגוריה** - detected from `count(journey_items WHERE is_active GROUP BY category_id)` ≥ 1 for each priority category.
3. ✓/○ **לפחות לקוח אחד פעיל בקצב** - detected from `count(distinct user_id) from journey_scheduled_items where source = 'cadence' and unlock_at > now() - interval '7 days'` > 0.
4. ✓/○ **השלמתם את הסיור הראשון** - local-storage flag set when admin clicks "סיימתי את הסיור" on the welcome page.
5. ✓/○ **קבוצה ראשונה נוצרה** - detected from `count(journey_groups WHERE is_active)` > 0. Optional - the row also has a "דלג" (skip) link.
6. ✓/○ **תגובה ראשונה לחלקה** - detected from `count(journey_messages WHERE author_kind='expert')` > 0.

Each row has:
- The detection result (✓ green dot, ○ neutral dot).
- A one-line plain-Hebrew description.
- A "פתחו" link that opens the relevant admin page in a new tab so the checklist stays in view.

**The "automatic" sidebar copy:**

```
מה רץ בלי שאתם עושים כלום:

• כל 15 דקות: המערכת בודקת מי בתור לקבל פריט חדש
  ופותחת את הפריט הבא בלוח הזמנים שלהם.

• כל שעה: שליחת אימייל "פריט חדש מחכה לכם" למי
  שזה עתה נפתח לו פריט.

• כל יום ב-08:00: בדיקה של מי לא הגיב 5 ימים
  ושליחת תזכורת עדינה (אימייל + התראה באפליקציה).

• מנוי שפג: 14 יום של חסד שבהם המנוי "מוקפא".
  התוכן הקיים נשאר זמין; אין הזרמה של פריטים חדשים.
  אחרי 14 יום: חסימה מלאה. חידוש מחזיר הכל.
```

### 2.2 Per-workflow guide pages

**Path:** `/dashboard/journey/guide/[topic]` for each of:

| Slug | Topic | Audience |
|---|---|---|
| `add-item` | להוסיף פריט תוכן חדש | content admin |
| `add-category` | להוסיף קטגוריה (וגם תתי-נושאים) | content admin |
| `import-csv` | יבוא תוכן ב-CSV מהגוגל-שיט | content admin |
| `find-customer` | למצוא לקוח ולראות את המצב שלו | clinician |
| `create-group` | ליצור קבוצה ולחבר לתתי-נושאים | content admin |
| `push-content` | לדחוף פריט ספציפי ללקוח | clinician |
| `reply-to-message` | להגיב להודעה של לקוח | clinician |
| `read-health-board` | לקרוא את לוח הבריאות | content admin |

**Each page is structured as:**

1. **למה זה חשוב** - one paragraph in Hebrew on the clinical purpose (not the technical mechanism).
2. **שלב אחרי שלב** - numbered list, each step shows:
   - The Hebrew instruction.
   - A small inline screenshot embedded from the actual admin page (rendered as `<img src="/api/journey/guide/screenshot/<topic>/<n>" />` - server route generates from a curated set of pre-shot PNGs in `public/journey-guide/`).
   - A "פתחו את המסך הזה" button that deep-links to the actual admin page.
3. **טיפים** - 3-5 bullets on common mistakes and what NOT to do.
4. **מה רץ אוטומטית בעקבות הפעולה** - what the cron / system does after the admin clicks save.
5. **קישורים** - to other relevant guide topics.

The clinician/admin tagging is important: clinicians should default to seeing the 4 clinical topics first; admins see all 8.

### 2.3 Inline contextual hints

A small `<HintIcon topic="anchor-day" />` component renders next to any field that needs explanation. Click → popover with:

- The Hebrew explanation (1-3 sentences).
- A "More in the guide →" link that opens the relevant guide page.

The 20 highest-leverage spots from §1.5 get hints. Implementation pattern: a single `HintIcon` component reads from a central `lib/journey-guide/hints.ts` keyed by `topic` slug. Adding a hint is one line at the field level + one entry in the hint catalog.

The hint catalog is bilingual by default: `{ topicSlug: { he: "...", en: "..." } }`. Renders the active locale.

### 2.4 "What runs automatically" sidebar on the health board

Existing health page ([app/dashboard/journey/health/page.tsx](app/dashboard/journey/health/page.tsx)) gets a third column on `lg:` breakpoints (or a section above the cron table on mobile) that's the same plain-Hebrew copy as §2.1's "automatic" sidebar.

The intent: a clinician looking at a stuck user can reason about *why* it's stuck without having to read the cron table. "If the cadence cron is OK and I have items in the user's #1 category, why are they stuck?" becomes an answerable question because they have a model of what the cron is even *trying* to do.

### 2.5 First-day checklist for a new expert

A 5-step lightweight onboarding shown as a banner on `/dashboard` (the *root* dashboard, not Journey-specific) when a new admin/expert lands for the first time. The banner offers:

1. **קראו את המדריך הקצר (3 דקות)** → opens `/dashboard/journey/guide`.
2. **הציצו בקטלוג** → opens `/dashboard/journey/items` filtered to the first category.
3. **התבוננו בלקוח אחד** → opens `/dashboard/journey/clients/<recent active>`. If no clients exist yet, opens a placeholder explaining "כשיהיה לכם לקוח ראשון, נחזיר אתכם לכאן."
4. **השיבו להודעה אחת** → opens the per-couple workspace of the most recent unanswered response (if any).
5. **דחפו פריט אחד** → opens `/dashboard/journey/push` with a pre-selected test item.

State stored in `localStorage` key `journey_expert_first_day_checklist_v1` so admins can dismiss permanently. Server-side: a tiny field on `profiles` (not strictly needed for v3 - local storage is fine).

### 2.6 Admin vs clinician role-aware UI

The biggest source of confusion today is that admin and clinician share a Sidebar. Two surgical changes that don't require a permission overhaul:

1. The Journey sidebar group reorders for clinicians (detected via `profiles.role`):
   - Clinician order: **Clients · Push · Guide · (everything else)**.
   - Admin order: current order with **Guide** inserted near the top.
2. The Coaching sidebar group surfaces a "התראות חדשות" badge when there are unanswered per-item or general-channel messages. Slice 10 already wired the data; this is one extra sidebar query.

---

## 3. Open questions for Itzik

Before implementation:

1. **Persona detection:** clinicians vs admins. Per the schema, `profiles.role ∈ {user, admin, expert}`. Itzik is admin; experts on staff would be `expert`. Should the guide also accommodate the case where someone has BOTH roles (Itzik himself probably operates as both)? Recommend yes - show all sections, default sort by clinician priority.

2. **Bilingual scope.** Confirm: guide pages and inline hints are HE-first with EN secondary; existing admin chrome stays English. Is that the right line, or do we also want to start translating the most-clicked admin labels (Items, Categories, Push, Reply)?

3. **Screenshots for guide pages.** Two options:
   - **Static PNGs** captured manually and stored in `public/journey-guide/`. Lower fidelity (gets stale), simpler to ship.
   - **Live embeds** rendered as iframes pointing to actual admin pages with dummy state. Higher fidelity, more work.
   Recommend static for v1, with a note in each PNG saying "screenshot taken on <date>" so we know when to refresh.

4. **General-channel admin reply UI.** Flagged in slice 6 + 8 reports as deferred. Should this implementation slice include it (it's small - a `<GeneralChannelAdminReply>` component on the per-couple workspace calling the existing `postExpertReplyToChannel` action), or should it stay deferred?

5. **Empty-state copy rewrites.** Three quick fixes (Items-with-subtopic-filter wrong copy, Assignments "materialize a timeline" jargon, Clients "bulk-assign a program" jargon). Do these belong in the guide slice or as a separate polish PR? Recommend bundling - they're 5-line changes.

6. **Hint visibility.** Current `<Field hint>` renders at `text-[10px] text-muted-foreground`. The proposed `<HintIcon>` component is more visible (a `?` icon next to the label). Should we ALSO upgrade the existing hint sizes, or replace them entirely with HintIcon popovers?

7. **First-day banner on `/dashboard` root.** That route is the cross-pillar admin home (Games + Journey + Adults). Putting a Journey-specific onboarding banner there feels right but slightly imperialistic. Confirm or move to `/dashboard/journey` only.

8. **"Drag-reorder for subtopics + bindings"** - flagged in workflow #2 and #5 as missing affordances. These were listed as "deferred" in slices 2 and 7. Do they belong in this guide slice or stay deferred? Recommend deferred - the guide can handle the absence with copy ("בינתיים, סדר התצוגה נקבע לפי שדה Sort").

9. **Notification badge on Coaching sidebar.** Slice 10 wired notification data; this is wiring it into the Sidebar query. Small addition; bundle here or separate?

10. **Guide content authoring.** The guide pages need real Hebrew clinical-tone copy. Who writes it - Itzik, or do I draft and Itzik edits? Recommend draft-then-edit; faster than committee. About 2000-3000 words of Hebrew copy across 8 topics.

---

## 4. Implementation slice plan

Roughly the order I'd land PRs once approved, each independently shippable:

1. **Empty-state copy fixes + sidebar tooltips** (small, no new pages). The 3 broken empty states + 4 sidebar tooltips. Half-day.
2. **`<HintIcon>` component + hint catalog scaffold** + the 20 highest-leverage hints from §1.5. One day.
3. **Guide hub page** at `/dashboard/journey/guide` with the live setup checklist (§2.1). Sidebar entry. Plain-Hebrew automatic sidebar. One day.
4. **8 per-workflow guide pages** under `/dashboard/journey/guide/[topic]`. Bilingual content + screenshots + deep-link CTAs. Two-three days.
5. **First-day banner** on dashboard root (§2.5) with localStorage dismissal. Half-day.
6. **Health page "what runs automatically" column** (§2.4). Half-day.
7. **Sidebar role-aware reorder** (§2.6). Half-day.
8. **Notification badge on Coaching sidebar group** (open question #9). Half-day.

Total: ~6-8 working days. Could be a single PR if bundled aggressively, or 3-4 PRs if Itzik prefers smaller reviewable chunks.

---

## 5. What this guide is NOT

To make the scope explicit:

- Not a replacement for the admin. Every guide deep-links INTO the existing surfaces.
- Not a permissions overhaul. Roles already exist; we just reorder the sidebar.
- Not a chrome translation project. We translate the guide; admin chrome stays English.
- Not a feature-add. No new server actions, no new schema, no engine changes. Pure UX layer.
- Not a clinical training course. We explain the tool, not the therapy. "When to push a sexuality item to a couple" is Itzik's expertise, not the guide's.
- Not a static documentation site. The checklist detects state; the guide pages link to live admin actions.

---

**Stopping here for sign-off.** Once Itzik responds to §3, I'll start with slice 1 from §4 (empty-state copy + sidebar tooltips) and PR each slice independently.
