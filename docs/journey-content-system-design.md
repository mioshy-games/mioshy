# Journey Content System — Design Doc (Revision 2)

**Status:** Draft for review.
**Author:** Claude + Itzik, 2026-04-21.

## Revision 2 changelog (the 7 adjustments)

| # | Topic | Change |
|---|-------|--------|
| 1 | **Ownership** | Polymorphic: assignments can be owned by a **user** OR a **couple**. Exactly one of `user_id` / `couple_id` is set. Both paths work from day one. |
| 2 | **Expiration** | **Removed entirely.** No `expires_at`, no `passed` state. Items, once unlocked, stay available forever. |
| 3 | **Completion + feedback** | Completion is **optional**. New table `journey_item_responses` captures per-user text responses (multiple allowed per item). |
| 4 | **Content context** | Every item is linked to a **Category** (required) and a Category may belong to a **Program** (optional). Admin breadcrumb + user timeline chip both display `Program › Category › Item`. |
| 5 | **Automation-ready** | Assignments carry `origin` (`'admin_manual' \| 'purchase' \| 'trigger'`) + `origin_ref`. Purchase / trigger hooks can slot in without schema changes. |
| 6 | **Content edits are retroactive** | `scheduled_items` only *references* `items.id`; it never copies content. Editing title / body / task / media always flows through to existing users. |
| 7 | **Structural edits: admin chooses** | When admin adds/removes an item or changes default offsets on a program, a confirm dialog asks *"Apply to existing assigned users?"*. Default = no (safe). |
| — | **Simplification** | Dropped: `status` column, resync action, passed-vs-completed distinction. States are just `locked / available / completed`. |

---

## 1. Vocabulary

| Term | Meaning |
|------|---------|
| **Program** | Reusable template (e.g. "6-week intimacy reset"). Contains categories. |
| **Category** | Topical grouping of items. Lives inside a program, or stands alone. |
| **Item** | A single content unit (title / body / task / challenge / media / timing defaults). Reusable. Always belongs to a category. |
| **Assignment** | Link from an **owner** (user or couple) to a program / category / item. Has an anchor date + an `origin`. |
| **Scheduled item** | Materialized row per-assignment per-item with absolute `unlock_at`. Points to the item by FK — never copies content. |
| **Item state** | Optional per-assignment-per-item record holding completion + admin override. Sparse. |
| **Response** | Free-text feedback a user submits on an item. Multiple allowed. |
| **Owner** | The subject of a journey: one `user` or one `couple`. |

"Client" in the admin UI = an **owner** (a couple in most cases, a user when unpaired).

---

## 2. How this integrates with existing system

- `/journey` (user-facing) today = questionnaire. We move the questionnaire to `/journey/assessment` and repurpose `/journey` as an orchestrator that renders **marketing**, **resume-assessment**, or **timeline** based on state (§9).
- The existing `journeys` / `journey_responses` / `journey_analysis` tables (questionnaire session) stay as-is.
- `getUserEntitlements()` already returns `journey: boolean`. We light up the timeline when the owner has any active journey assignment.
- Admin dashboard: new section `/dashboard/journey` next to `/dashboard/adults`. Sidebar link gets added.

---

## 3. Database schema

New migration: `supabase/migrations/035_journey_content_system.sql`.

```sql
-- =====================================================================
-- 035_journey_content_system.sql
-- Structured content delivery. Owner = user OR couple.
-- =====================================================================

-- ── PROGRAMS ─────────────────────────────────────────────────────────
create table journey_programs (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name_he           text not null,
  name_en           text,
  description_he    text,
  description_en    text,
  cover_image_url   text,
  default_anchor    text not null default 'assignment'
                    check (default_anchor in ('assignment','purchase','fixed')),
  is_active         boolean not null default true,
  sort_weight       int not null default 0,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── CATEGORIES ───────────────────────────────────────────────────────
-- A category can belong to a program (program_id not null) or stand
-- alone (program_id null) — admins can bulk-assign a standalone
-- category to an owner directly.
create table journey_categories (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid references journey_programs(id) on delete cascade,
  slug              text not null,
  name_he           text not null,
  name_en           text,
  description_he    text,
  description_en    text,
  sort_order        int not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (program_id, slug)
);

-- ── ITEMS (content catalog) ──────────────────────────────────────────
-- Every item MUST belong to a category (adj #4). Content lives here and
-- ONLY here — scheduled rows reference items by FK so content edits
-- flow through to existing users automatically (adj #6).
create table journey_items (
  id                    uuid primary key default gen_random_uuid(),
  category_id           uuid not null references journey_categories(id) on delete restrict,
  slug                  text not null,
  title_he              text not null,
  title_en              text,
  body_he               text not null,           -- markdown
  body_en               text,
  task_he               text,
  task_en               text,
  challenge_he          text,
  challenge_en          text,
  video_url             text,
  image_url             text,
  sort_order            int not null default 0,
  default_offset_days   int not null default 0,  -- 0 = unlocks on anchor day
  is_active             boolean not null default true,
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (category_id, slug)
);

-- ── ASSIGNMENTS (owner ← program / category / item) ──────────────────
-- Owner is polymorphic: exactly one of user_id / couple_id is set.
-- Origin tracks whether this was manual or fired by a future trigger.
create table journey_assignments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  couple_id      uuid references couples(id) on delete cascade,
  source_kind    text not null check (source_kind in ('program','category','item')),
  source_id      uuid not null,                      -- program / category / item id
  anchor_kind    text not null default 'assignment'
                 check (anchor_kind in ('assignment','purchase','fixed')),
  anchor_date    timestamptz not null,
  origin         text not null default 'admin_manual'
                 check (origin in ('admin_manual','purchase','trigger')),
  origin_ref     text,                                -- e.g. subscription_id
  assigned_by    uuid references auth.users(id),     -- admin actor, if manual
  notes          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Owner must be exactly one of user_id or couple_id (adj #1).
  constraint journey_assignments_owner_xor
    check ((user_id is not null) <> (couple_id is not null))
);

create index on journey_assignments (user_id)   where user_id   is not null;
create index on journey_assignments (couple_id) where couple_id is not null;

-- ── SCHEDULED ITEMS ──────────────────────────────────────────────────
-- Materialized timeline row per (assignment × item). Only absolute
-- `unlock_at` is stored. `item_id` is a FK — content is always fresh.
-- NO expires_at, NO status column, NO per-row copy of title/body (adj #2, #6).
create table journey_scheduled_items (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null references journey_assignments(id) on delete cascade,
  item_id          uuid not null references journey_items(id)       on delete cascade,
  unlock_at        timestamptz not null,
  sort_order       int not null default 0,
  has_unlock_override   boolean not null default false,   -- set when admin edits unlock_at
  admin_notes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (assignment_id, item_id)
);

create index on journey_scheduled_items (assignment_id, unlock_at);

-- ── COMPLETION (per-owner per-scheduled-item) ────────────────────────
-- Separate from scheduled_items so sparse (most rows never get marked).
-- Completion is OPTIONAL (adj #3) — no DB constraint forces it.
create table journey_item_completions (
  scheduled_item_id   uuid primary key
                      references journey_scheduled_items(id) on delete cascade,
  completed_at        timestamptz not null default now(),
  completed_by        uuid references auth.users(id),
  created_at          timestamptz not null default now()
);

-- ── RESPONSES (feedback / reflection) ────────────────────────────────
-- Per-user, multiple allowed per scheduled item. Users on both sides of
-- a couple can each leave their own (and multiple over time).
create table journey_item_responses (
  id                  uuid primary key default gen_random_uuid(),
  scheduled_item_id   uuid not null references journey_scheduled_items(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  response_text       text not null,
  created_at          timestamptz not null default now()
);

create index on journey_item_responses (scheduled_item_id, user_id);
create index on journey_item_responses (user_id, created_at desc);

-- D2: per-response privacy inside a couple. Default = shared.
alter table journey_item_responses
  add column is_private boolean not null default false;

-- Updated-at triggers (standard pattern)
create trigger journey_programs_updated    before update on journey_programs
  for each row execute function update_updated_at();
create trigger journey_categories_updated  before update on journey_categories
  for each row execute function update_updated_at();
create trigger journey_items_updated       before update on journey_items
  for each row execute function update_updated_at();
create trigger journey_assignments_updated before update on journey_assignments
  for each row execute function update_updated_at();
create trigger journey_scheduled_updated   before update on journey_scheduled_items
  for each row execute function update_updated_at();
```

### Why this shape

- **Content edits are retroactive automatically** (#6). `scheduled_items.item_id` is an FK. Changing `journey_items.body_he` = every existing user instantly sees the new text next page load.
- **Structural edits need admin confirmation** (#7, next section). Adding an item to a program doesn't auto-create scheduled rows; removing an item doesn't auto-delete them. Admin chooses per operation.
- **Completion + responses are append-only + sparse.** Most rows never get completed or responded to. Keeping them out of `scheduled_items` keeps that table small.
- **Owner polymorphism** is a plain XOR CHECK. Postgres keeps FK integrity, queries are readable (`where user_id = $1 or couple_id = $2`).
- **No `expires_at`, no `status`.** Derived in the view layer from `(unlock_at, completion)`.

---

## 4. Scheduling logic

Centralized in `lib/journey-content/schedule.ts`.

```ts
export type AnchorKind = 'assignment' | 'purchase' | 'fixed';

export function resolveAnchorDate(
  anchorKind: AnchorKind,
  opts: { assignmentDate: Date; purchaseDate: Date | null; fixedDate: Date | null }
): Date {
  if (anchorKind === 'purchase') {
    if (!opts.purchaseDate) throw new Error('anchor=purchase but owner has no purchase date');
    return opts.purchaseDate;
  }
  if (anchorKind === 'fixed') {
    if (!opts.fixedDate) throw new Error('anchor=fixed requires admin-chosen date');
    return opts.fixedDate;
  }
  return opts.assignmentDate;
}

export function computeUnlockAt(anchor: Date, offsetDays: number): Date {
  const d = new Date(anchor);
  d.setDate(d.getDate() + offsetDays);
  return d;
}
```

**Creating an assignment** (admin server action):

```
1. Resolve anchor_date from (anchorKind, fixedDate?, owner's purchase_date?).
2. Insert into journey_assignments (owner, source, anchor_date, origin).
3. Expand source → items:
     - source_kind='program'  → all items in all categories of that program
     - source_kind='category' → all items in that category
     - source_kind='item'     → just that item
4. For each item, insert into journey_scheduled_items
     (assignment_id, item_id, unlock_at = anchor + item.default_offset_days).
```

**Per-item admin override**:

```
update journey_scheduled_items
  set unlock_at = $new, has_unlock_override = true
  where id = $id;
```

`has_unlock_override = true` means *"admin has intentionally set this; don't stomp it on structural propagation."*

---

## 5. Status derivation (UI only)

No stored `status`. Three display states (#2):

```ts
// lib/journey-content/status.ts
export type DisplayStatus = 'locked' | 'available' | 'completed';

export function deriveStatus(row: {
  unlock_at: Date;
  completed_at: Date | null;
}, now: Date = new Date()): DisplayStatus {
  if (row.completed_at)   return 'completed';
  if (row.unlock_at > now) return 'locked';
  return 'available';
}
```

UX treatments:

- **locked** — teaser-only card, padlock icon, "Unlocks in N days".
- **available** — full card, gentle pulse, primary CTAs ("Open", "Mark complete", "Write a response").
- **completed** — dimmed, green check, completion timestamp. Re-readable.

---

## 6. Admin confirmation dialogs (adj #7)

Every structural change in admin shows a two-step modal:

**Step 1** — "Are you sure you want to {edit / delete / remove from program}?"
**Step 2** — "Apply this change to existing assigned users?"
  - **No** (default) — template changes only. New future assignments pick up the change. Existing assignments keep the old structure.
  - **Yes, apply to all N existing assignments** — propagates.

Applied to these admin actions:

| Action | What "yes" does |
|--------|-----------------|
| Delete a program | Also removes all of its scheduled rows + cascading state/responses for active assignments. |
| Remove an item from a program / category | Also deletes `scheduled_items` rows (+ cascades) for existing assignments. |
| Add an item to a program / category | Also inserts `scheduled_items` for every active assignment of that program/category. `unlock_at = existing_assignment.anchor_date + newItem.default_offset_days`. |
| Change an item's `default_offset_days` | Also updates `scheduled_items.unlock_at` for existing rows where `has_unlock_override = false`. Rows with override are left alone. |
| Change a program's `default_anchor` | Only applies to future assignments. Existing ones keep their resolved `anchor_date` on the assignment row. |
| Soft-archive (`is_active = false`) any entity | Pure template change. Existing assignments still render the archived content — admins see an "archived" chip in their view. |

Plain content edits (title, body, task, media) NEVER show the second prompt — they're always retroactive by design (FK flow-through).

Implementation detail: admin actions accept an explicit `propagate: boolean` param. UI dialog turns the user's choice into that flag. No server-side magic.

---

## 7. API surface

### User-facing (JSON routes, Node runtime)

All use the **session-client-for-auth, admin-client-for-writes** pattern (per `project_supabase_ssr_rls_pattern` memory).

```
GET  /api/journey/content/timeline
  → { items: Array<{
        scheduled_item_id: string,
        assignment: { id, source_kind, anchor_kind, origin },
        program:   { id, name_he, name_en, slug } | null,
        category:  { id, name_he, name_en, slug },
        item:      { id, title_*, body_*, task_*, challenge_*, video_url, image_url },
        unlock_at: string,
        status:    'locked' | 'available' | 'completed',
        completed_at: string | null,
        response_count: number
      }> }
  Resolves caller's owner scope (user_id + possible couple_id from
  couple_members) and returns timeline items across all active assignments.
  Ordered by unlock_at asc. Program/category embedded so the UI always has
  context (adj #4).

POST /api/journey/content/complete
  body: { scheduled_item_id: string }
  UPSERT journey_item_completions(scheduled_item_id, completed_at, completed_by).
  Optional completion — same endpoint handles un-completing:
    DELETE journey_item_completions where scheduled_item_id = $id  (if body.undo)

POST /api/journey/content/respond
  body: { scheduled_item_id: string, response_text: string }
  INSERT journey_item_responses. Always appends (multiple responses allowed).
  Rate-limited 30/hr per (ip + user_id).

GET  /api/journey/content/item/[scheduledId]
  → item detail + all responses visible to the caller (own + partner's).
```

### Admin-only (server actions in `lib/journey-content/admin-actions.ts`)

```ts
// Programs
createProgram(input)
updateProgram(id, input)
deleteProgram(id, { propagate })

// Categories
createCategory(programId | null, input)
updateCategory(id, input)
deleteCategory(id, { propagate })
reorderCategories(programId, ids)

// Items (content-only edits are always retroactive — no propagate flag on update)
createItem(categoryId, input, { propagate })       // adding an item can cascade
updateItem(id, input)                               // title/body/video: always retroactive
updateItemTiming(id, { default_offset_days }, { propagate })   // needs propagate flag
deleteItem(id, { propagate })
reorderItems(categoryId, ids)

// Assignments
assignProgramToOwner({ userId?, coupleId?, programId, anchorKind, fixedDate?, origin })
assignCategoryToOwner({ userId?, coupleId?, categoryId, anchorKind, fixedDate?, origin })
assignItemToOwner({ userId?, coupleId?, itemId, unlockAt, origin })
deactivateAssignment(id)
reactivateAssignment(id)

// Per-row overrides
updateScheduledItem(id, { unlockAt?, adminNotes?, sortOrder? })
  // setting unlockAt flips has_unlock_override=true
removeScheduledItem(id)
markScheduledItemComplete(id, { asOf?, userId? })   // admin override
unmarkScheduledItemComplete(id)

// Responses (admin-side viewing only; admins don't author user responses)
listResponsesForScheduledItem(id)
```

### Automation hook (prepared now, wired later — adj #5)

Purchase-complete webhook will call:

```ts
await assignProgramToOwner({
  coupleId,
  programId: tier.defaultProgramId,
  anchorKind: 'purchase',
  origin: 'purchase',
  originRef: subscriptionId,
});
```

No schema change needed at that time. Same server action handles manual and automated.

---

## 8. RLS strategy

```sql
-- SELECTs only. All writes go through service-role admin client.

create policy journey_programs_read on journey_programs for select
  using (is_active or public.is_admin());

create policy journey_categories_read on journey_categories for select
  using (is_active or public.is_admin());

create policy journey_items_read on journey_items for select
  using (is_active or public.is_admin());

-- Assignment visible to its owner (user or couple member).
create policy journey_assignments_owner_read on journey_assignments for select
  using (
    is_active
    and (
      user_id = auth.uid()
      or couple_id in (select couple_id from couple_members where user_id = auth.uid())
      or public.is_admin()
    )
  );

-- Scheduled items visible through their assignment.
create policy journey_scheduled_owner_read on journey_scheduled_items for select
  using (
    exists (
      select 1 from journey_assignments a
      where a.id = assignment_id
        and a.is_active
        and (
          a.user_id = auth.uid()
          or a.couple_id in (select couple_id from couple_members where user_id = auth.uid())
          or public.is_admin()
        )
    )
  );

-- Completions + responses: same gate.
create policy journey_completions_owner_read on journey_item_completions for select
  using (
    exists (
      select 1 from journey_scheduled_items s
        join journey_assignments a on a.id = s.assignment_id
      where s.id = scheduled_item_id
        and (
          a.user_id = auth.uid()
          or a.couple_id in (select couple_id from couple_members where user_id = auth.uid())
          or public.is_admin()
        )
    )
  );

create policy journey_responses_owner_read on journey_item_responses for select
  using (
    exists (
      select 1 from journey_scheduled_items s
        join journey_assignments a on a.id = s.assignment_id
      where s.id = scheduled_item_id
        and (
          a.user_id = auth.uid()
          or a.couple_id in (select couple_id from couple_members where user_id = auth.uid())
          or public.is_admin()
        )
    )
  );
```

No INSERT/UPDATE/DELETE policies — that's by design. All mutations route through the admin client (per `project_supabase_ssr_rls_pattern`).

---

## 9. Folder & component structure

```
app/
  [locale]/
    journey/
      page.tsx                       ← router: marketing | resume | timeline
      assessment/
        page.tsx                     ← MOVED: existing questionnaire
      item/[scheduledId]/page.tsx    ← deep view: content + responses + complete
  dashboard/
    journey/
      page.tsx                       ← overview: program stats + recent assignments
      programs/
        page.tsx / new / [id]        ← program editor: meta / categories / items
      categories/
        page.tsx / new / [id]        ← standalone categories
      items/
        page.tsx / new / [id]        ← catalog view (all items across categories)
      clients/
        page.tsx                     ← owners list (couples + unpaired users)
        [ownerKey]/page.tsx          ← Manage Client (ownerKey = `u:<id>` or `c:<id>`)
  api/journey/content/
    timeline/route.ts
    complete/route.ts
    respond/route.ts
    item/[scheduledId]/route.ts

components/
  journey/
    marketing/
      JourneyMarketingHero.tsx
      JourneyMarketingWhy.tsx
      JourneyMarketingFaq.tsx
    timeline/
      JourneyTimeline.tsx            ← spine + ambient bg
      JourneyItemCard.tsx
      JourneyLockedCard.tsx
      JourneyCompletedCard.tsx
      JourneyMediaEmbed.tsx
      JourneyCompleteButton.tsx
      JourneyResponseComposer.tsx    ← user feedback box
      JourneyResponseThread.tsx      ← existing responses
      JourneyBreadcrumb.tsx          ← Program › Category chip
      JourneyEmptyState.tsx
  dashboard/journey/
    ProgramForm.tsx
    CategoryForm.tsx
    ItemForm.tsx
    OwnerStatusBadge.tsx
    AssignProgramDialog.tsx
    AssignCategoryDialog.tsx
    AssignItemDialog.tsx
    ScheduleOverrideDialog.tsx
    PropagateConfirmDialog.tsx       ← reusable two-step "apply to existing?" modal
    ClientTimelinePanel.tsx
    ResponsesPanel.tsx

lib/
  journey-content/
    types.ts                         ← Program, Category, Item, Assignment, Scheduled, Owner
    queries.ts                       ← SELECTs (user + admin)
    admin-actions.ts                 ← server actions (see §7)
    schedule.ts                      ← resolveAnchorDate, computeUnlockAt
    status.ts                        ← deriveStatus
    propagation.ts                   ← applies structural edits to existing assignments
    owner.ts                         ← resolveOwnerFromSession(), ownerKey helpers

supabase/migrations/
  035_journey_content_system.sql
```

---

## 10. UX flows

### 10.1 `/journey` router

```
user lands on /journey
├── not authed → marketing + "Take the assessment" CTA → /journey/assessment
├── authed, no active assignments
│   ├── has in-progress questionnaire → "Resume assessment" + marketing
│   └── otherwise                     → marketing + "Start assessment"
└── authed, active assignments exist   → timeline
```

Owner resolution (works for user-owned OR couple-owned journeys):

```ts
// lib/journey-content/owner.ts
async function resolveOwnerFromSession() {
  const user = await getUser();
  if (!user) return null;
  const coupleId = await getCoupleId(user.id);   // may be null
  return { userId: user.id, coupleId };
}
```

Timeline query fetches assignments where `user_id = me OR couple_id = myCouple`. Works for both ownership modes naturally.

### 10.2 Timeline page

Visual parity with `/games` premium aesthetic: deep indigo/violet background, aurora washes, milestone spine. Each item shows:

- A small breadcrumb chip: `Program › Category` (adj #4).
- Title + teaser (locked) OR title + body + media (available/completed).
- Available: pulse animation, "Mark complete" button, "Write a response" expander.
- Completed: check icon + timestamp, still re-openable.
- Locked: padlock + "Unlocks in N days".

Completion is optional — users can engage with content without marking anything.

### 10.3 Admin — Manage Client (`/dashboard/journey/clients/[ownerKey]`)

`ownerKey` = `u:<user_id>` or `c:<couple_id>`. Same screen handles both.

```
┌─ owner header (couple names or single user + subscription + journey status) ─┐
│                                                                              │
├─ Actions ───────────────────────────────────────────────────────────────────┤
│ [+ Assign program ▼]  [+ Assign category]  [+ Assign single item]           │
│                                                                              │
├─ Timeline (mirrors user view, with admin gear) ─────────────────────────────┤
│  Day 1 ●  program › category › item                       completed     ⚙  │
│  Day 3 ●  program › category › item                       available     ⚙  │
│  Day 7 ○  program › category › item                       locked        ⚙  │
│                                                                              │
│  (gear ⚙ opens: unlock_at override, admin notes, mark complete, remove)     │
├─ Responses ─────────────────────────────────────────────────────────────────┤
│ Alice • item X • 2d ago: "this one hit"                                     │
│ Bob   • item Y • 1d ago: "we tried it, not easy"                            │
├─ Assignments history ───────────────────────────────────────────────────────┤
│ program X — assigned 2026-04-01 by @admin (active)                          │
│ item Y   — assigned 2026-04-10 by @admin (removed)                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Clients list table has a `Type` column: `Couple (Alice & Bob)` or `User (Dana)`.

### 10.4 Program editor — structural edit flow

Admin clicks "Remove item from program":

1. `ConfirmDialog` — *"Remove '{item.title}' from this program?"* — Yes / Cancel.
2. `PropagateConfirmDialog` — *"This program is active for 12 assignments. Also remove this item from those users' timelines?"* — **No, template only** / **Yes, remove from everyone**.

The dialog reports the exact count so admins know the blast radius.

---

## 11. Security & rate limiting

- Session→admin pattern on all user API routes.
- `POST /api/journey/content/complete`: 60/hr per `(ip + user_id)`.
- `POST /api/journey/content/respond`: 30/hr per `(ip + user_id)`, plus 5KB body cap.
- Admin actions: `requireAdmin()` + server-side only.
- Markdown rendering: `react-markdown` with the default plugin set (no `rehype-raw`). Admin-authored content.
- Video URLs: allowlist YouTube / Vimeo hosts in a helper; fall through to plain link otherwise.

---

## 12. Phased implementation plan

### Phase 0 — Carve out `/journey` routing
Move questionnaire to `/journey/assessment`. Make `/journey/page.tsx` a small router. ~1-2 hrs.

### Phase 1 — Pre-purchase marketing page (task #52)
Build `JourneyMarketingHero` + `Why` + `FAQ` in the games-world premium aesthetic. Strong CTA → `/journey/assessment`. ~½ day.

### Phase 2 — Schema + catalog CRUD
Migration 035 (programs + categories + items only). `/dashboard/journey/{programs,categories,items}` CRUD. Compact admin form pattern, bilingual fields. ~2-3 days.

### Phase 3 — Assignments + scheduled materialization
Add `journey_assignments`, `journey_scheduled_items`, `journey_item_completions`, `journey_item_responses`. Server actions + propagation helpers. `PropagateConfirmDialog`. ~2-3 days.

### Phase 4 — Admin Manage-Client
`/dashboard/journey/clients/page.tsx` + `[ownerKey]/page.tsx`. Timeline view, gear override, response viewer, assignment dialogs. ~2 days.

### Phase 5 — User-facing timeline
APIs + components. Entitlement lights up when owner has active assignments. ~2 days.

### Phase 6 — Polish + automation wiring
Email notification on unlock (via existing `sent_messages` / `engagement_schedules` pipeline). Hook purchase webhook to `assignProgramToOwner`. Admin analytics (completion rate, response rate per item). ~2 days.

**Total:** ~10-12 working days.

---

## 13. What we're explicitly NOT doing in v1

- Automatic assignment by subscription tier (schema is ready; wiring is phase 6 / later).
- Per-partner separate completion state (both partners share one completion row — simplest-thing-that-works).
- Video uploads (URLs only).
- Recurring / repeating items.
- Client-side filter/search on admin catalog (add when count > 50).
- Multi-locale beyond HE/EN (column pair pattern leaves room).

---

## 14. Resolved decisions

**D1. Unpaired-user journeys → offer migration at pairing, default YES.**
When a user with an active user-owned journey pairs with a partner, we surface a one-screen modal during the pairing flow:

> *"Share your journey with your partner?"*
> *Your current progress (N unlocked items, M completions, K responses) will become visible to your partner, and future unlocked content + completions will be shared from now on. You can't undo this from the user side — ask admin if you need to split back out.*
>
> **[ Yes, share journey ] ← default, pre-selected**
> [ Keep private (partner starts fresh) ]

Implementation:
- Add a `migrateUserAssignmentsToCouple(userId, coupleId)` helper in `lib/journey-content/propagation.ts` that flips `user_id → null, couple_id → <id>` on all active assignments owned by that user. `scheduled_items`, completions, responses ride along by FK.
- Hook into the existing pairing server action — block pair completion until the user picks.
- If the partner already has their own active user-owned journey, show a merge preview (keep both timelines; dedupe happens only on conflicting `(assignment.source_kind, source_id)`).
- Log the choice in `journey_assignments.notes` (JSON snippet) for audit.

**D2. Response visibility → shared by default inside the couple, with private toggle.**
- `journey_item_responses.is_private boolean not null default false`.
- Composer has a "Private note (visible only to you and admin)" checkbox, unchecked by default.
- Thread query joins `couple_members`; private responses are filtered out unless `user_id = auth.uid() or is_admin()`.
- Admin always sees everything (used for coaching follow-up).

**D3. Archived programs → existing assignments keep rendering.**
- `journey_programs.is_active = false` is template-only. Archived programs vanish from the "Assign program" picker.
- Existing active assignments continue to unlock + display normally; admin UI shows a dim "Archived program" chip on the owner's timeline.
- If admin wants to stop an archived program for existing users, they deactivate assignments individually (or bulk) via the existing `deactivateAssignment` action — no magic cascade.

**Schema additions for D1 + D2:**

```sql
alter table journey_item_responses
  add column is_private boolean not null default false;
```

(D1 needs no schema change — just the pairing-flow server action.)
