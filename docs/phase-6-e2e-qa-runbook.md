# Phase 6 - End-to-End QA Runbook

A step-by-step validation guide for the five real-world flows that must pass
cleanly before Phase 6 (Journey polish + purchase automation) is considered
production-ready.

- **Audience** - Itzik, running against staging or a local preview deploy.
- **Prereqs** - admin account for the dashboard, one fresh test email for
  the buyer, one more fresh email for the partner (solo→couple flow), access
  to the Supabase project (SQL editor) and Brevo inbox, mobile device or
  Chrome devtools device emulation.
- **Env** - `JOURNEY_UNLOCK_CRON_SECRET` (falls back to
  `CARDCOM_BILLING_CRON_SECRET`) must be set in Vercel for the notification
  cron to be callable. `NEXT_PUBLIC_SITE_URL` / `PUBLIC_BASE_URL` must point
  at the deployed host used by the email links.
- **Reset between runs** - see “Test data reset” at the bottom.

Pass/fail is recorded inline with each step. A flow passes only when every
step passes.

---

## Pre-flight (once, before starting)

1. Pick a journey program in the admin (`/dashboard/journey/programs`) and
   confirm:
   - `product_slug = "journey"` is set (migration 036).
   - `is_active = true`.
   - At least 3 items are attached, with `unlock_offset_days` of `0`, `1`,
     and `7` (or similar - we just need a mix so the first item is
     immediately available and the others are future-locked).
2. In Supabase SQL editor run:

   ```sql
   select id, title_he, product_slug, is_active
   from journey_programs
   where product_slug = 'journey' and is_active = true;
   ```

   Record the program id - you’ll use it later as `<PROGRAM_ID>`.
3. In `checkout_sessions`, confirm the `product` column exists (added by
   migration 036) and the column is populated for recent rows.

Pass ☐ / Fail ☐

---

## Flow 1 - Full purchase flow

**Goal** A brand new user completes the assessment, purchases a journey
subscription, lands with a program auto-assigned, and the first item is
clearly visible and actionable.

### 1A. Assessment → checkout

1. Sign up with a new email at `/[locale]/journey/assessment`.
2. Complete the assessment end-to-end. The questionnaire should push you
   toward a results screen with a CTA to buy.
3. Open the SubscriptionModal, pick a plan, and complete Cardcom payment
   with test card `4580-4580-4580-4580` exp `12/30` cvv `123`.

Pass ☐ / Fail ☐

### 1B. Landing at `/billing/success` → auto-assignment

1. After Cardcom redirect, you land on `/[locale]/billing/success` with a
   spinner, then the “Payment confirmed 🎉” view.
2. The page should show two CTAs: **Open my journey** (primary, pointing at
   `/journey/timeline`) and **My library** (secondary, pointing at `/my`).
   *If the CTAs say “Back to questionnaire”, the new success-page copy did
   not deploy - pull latest and retry.*
3. Click **Open my journey**.

Pass ☐ / Fail ☐

### 1C. Auto-assignment correctness (DB check)

Run, replacing `<USER_ID>` with your signup’s auth user id (find it by
email in `auth.users`):

```sql
select
  a.id as assignment_id,
  a.source_id as program_id,
  a.anchor_kind,
  a.anchor_date,
  a.origin,
  a.origin_ref,
  a.is_active,
  count(si.id) as scheduled_items
from journey_assignments a
left join journey_scheduled_items si on si.assignment_id = a.id
where a.user_id = '<USER_ID>' and a.is_active = true
group by a.id
order by a.created_at desc;
```

Expected:
- Exactly one row.
- `origin = 'purchase'`, `origin_ref` begins with `cardcom:`.
- `anchor_kind = 'purchase'`, `anchor_date` ≈ now (UTC midnight of today).
- `scheduled_items` count matches the number of items in `<PROGRAM_ID>`.

Pass ☐ / Fail ☐

### 1D. Idempotency

In the SQL editor, pretend the webhook fires again by re-running the
`/api/billing/cardcom/indicator` call logic manually - easier: just reload
the billing success page (the webhook will not re-fire, but you can verify
no duplicate was ever created). Re-run the query from 1C. Expected: still
exactly one row.

Pass ☐ / Fail ☐

### 1E. First item visible + actionable on `/journey/timeline`

1. On `/journey/timeline` the NextUpHero appears above the categorized
   list.
2. The hero’s pill reads **הצעד הבא** / **Next up** (amber theme) and the
   kicker reads **הגיע הזמן** / **Ready now**.
3. The primary CTA reads **פתיחת הפרק** / **Open this chapter** and
   navigates to `/journey/timeline/<scheduledId>`.
4. The item detail page loads with the title, body, image (if any), and
   response form.
5. Filing a response → the response appears in the list; marking complete
   flips the hero to the next available (or to the VictoryHero if it was
   the only one).

Pass ☐ / Fail ☐

### 1F. `/my` smart routing

1. Navigate to `/[locale]/my`.
2. The Journey pillar card shows the “active” chip and its CTA reads
   **לציר הזמן** / **Open timeline** pointing at `/journey/timeline` (NOT
   at `/journey`, NOT at `/journey/assessment`).

Pass ☐ / Fail ☐

---

## Flow 2 - Unlock flow

**Goal** A scheduled item flips from locked → available, appears correctly
in the timeline, and triggers an email exactly once.

### 2A. Pick a locked item

Still logged in as the buyer from Flow 1. Run:

```sql
select id, item_id, unlock_at, notified_at
from journey_scheduled_items si
where si.assignment_id in (
  select id from journey_assignments where user_id = '<USER_ID>'
    and is_active = true
)
order by unlock_at asc;
```

Pick one row whose `unlock_at` is in the future and `notified_at` is NULL.
Record `<SCHEDULED_ID>`.

Pass ☐ / Fail ☐

### 2B. Simulate the unlock

```sql
-- Move the unlock to the recent past + ensure notified_at is clear
update journey_scheduled_items
set unlock_at = now() - interval '2 minutes',
    notified_at = null
where id = '<SCHEDULED_ID>'
returning id, unlock_at, notified_at;
```

### 2C. Verify timeline UI reflects the unlock

1. Reload `/journey/timeline`. The NextUpHero may now feature this item
   (if its unlock_at is the earliest among available ones), or it appears
   as **available** further down the list (green “מוכן לפתיחה” pill / green
   dot) with its **פתיחת הפרק** CTA enabled.
2. `/journey/timeline/<SCHEDULED_ID>` is now openable without the lock
   message.

Pass ☐ / Fail ☐

### 2D. Trigger the unlock cron manually

Replace `$SECRET` with `JOURNEY_UNLOCK_CRON_SECRET` (or
`CARDCOM_BILLING_CRON_SECRET` if the dedicated one isn’t set) and
`$SITE_URL` with the deployed site URL:

```bash
curl -s -X POST "$SITE_URL/api/journey/notify-unlocks" \
  -H "authorization: Bearer $SECRET" | jq
```

Expected response shape:

```jsonc
{
  "ok": true,
  "scanned": 1,
  "dispatched": 1,
  "skipped": 0,
  "errors": [],
  "recipients": [
    { "email": "<your_test_email>", "items": 1, "status": "sent" }
  ]
}
```

Pass ☐ / Fail ☐

### 2E. Email delivery

1. Check the Brevo transactional log (Brevo dashboard → Transactional →
   Logs). Locate the “A new chapter is open on your journey” / Hebrew
   equivalent, tagged `journey-unlock`.
2. Open the email in your inbox (or Brevo preview). Verify:
   - Subject: `פרק חדש נפתח במסע שלכם 💜` / `A new chapter is open on
     your journey 💜`.
   - Body: chapter title + category name rendered, CTA **פתיחת הפרק** /
     **Open this chapter** linking to `<SITE_URL>/<locale>/journey/timeline/
     <SCHEDULED_ID>`.
   - Footer branded **Mioshy**.
3. Click the CTA - you land on the item detail page, authenticated if
   your session cookie is still valid, or on the sign-in page otherwise.

Pass ☐ / Fail ☐

### 2F. No duplicate send (idempotency)

Immediately re-run the curl from 2D. Expected:

```jsonc
{
  "ok": true,
  "scanned": 0,    // notified_at is now set, so it no longer matches
  "dispatched": 0,
  "skipped": 0,
  ...
}
```

Re-check your inbox - no second email should arrive.

SQL sanity check:

```sql
select id, unlock_at, notified_at
from journey_scheduled_items
where id = '<SCHEDULED_ID>';
```

Expected: `notified_at` ≈ the timestamp of the first cron run (non-null).

Pass ☐ / Fail ☐

### 2G. Multi-item aggregation

1. Roll the first 3 future items’ `unlock_at` into the past:

   ```sql
   update journey_scheduled_items si
   set unlock_at = now() - interval '1 minute',
       notified_at = null
   where id in (
     select id
     from journey_scheduled_items
     where assignment_id in (
       select id from journey_assignments where user_id = '<USER_ID>'
         and is_active = true
     )
     and notified_at is null
     order by unlock_at asc
     limit 3
   );
   ```

2. Trigger the cron again (curl from 2D). Expected: **one** email with
   the multi-chapter layout (3 cards + “Open my timeline” CTA at the
   bottom), not three separate emails.

Pass ☐ / Fail ☐

---

## Flow 3 - Solo → couple transition

**Goal** A user who started solo shares their journey with a partner
without losing responses or scheduled items, and no duplicates appear.

### 3A. Setup - confirm solo state

Using the Flow 1 buyer (still solo), open `/account` and issue a couple
invitation to a **new** email you control.

Verify:

```sql
select id, status, invitee_email, couple_id
from couple_invitations
where couple_id in (
  select couple_id from couple_members where user_id = '<USER_ID>'
)
order by created_at desc;
```

Wait - the buyer is not in a couple yet, so `couple_members` has nothing
yet. Instead, the `couple_invitations` row should exist with
`status = 'pending'` and a freshly-minted `couple_id` placeholder. Record
`<INVITE_TOKEN>` from the email or `invitation_token` column.

Pass ☐ / Fail ☐

### 3B. Partner accepts the invite

1. Open an incognito window, visit `/invite/<INVITE_TOKEN>`.
2. Complete the “New user” tab with the partner’s email + password +
   full name + mobile.
3. Land on `/my` as the partner, signed in.

Pass ☐ / Fail ☐

### 3C. Journey is shared (both partners see the same timeline)

1. In the partner’s `/my`, the Journey pillar card shows the same
   “active” chip + **לציר הזמן** / **Open timeline** CTA.
2. Open `/journey/timeline` - same chapters, same progress, same NextUp
   as the buyer.

SQL confirmation:

```sql
-- Assignment ownership should be the couple, not the original user
select id, user_id, couple_id, is_active
from journey_assignments
where source_id = '<PROGRAM_ID>' and is_active = true;
```

Expected: `user_id` is NULL, `couple_id` is set. The solo row was promoted
in place (same assignment id; scheduled_items followed by FK).

Pass ☐ / Fail ☐

### 3D. No duplication

```sql
-- Look for orphaned solo assignments for the original buyer
select id, user_id, couple_id, is_active, source_kind, source_id
from journey_assignments
where (user_id = '<USER_ID>' or couple_id = '<COUPLE_ID>')
order by created_at asc;
```

Expected: exactly one active row for the program, couple-owned. No solo
duplicate. If the partner brought their own solo journey for the same
program, that row should have `is_active = false` with a note like
“Deactivated on pairing - couple already owned …”.

Pass ☐ / Fail ☐

### 3E. Data persistence - responses + completions

1. From Flow 1E you may have filed responses and completed at least one
   item. Open `/journey/timeline/<SCHEDULED_ID>` as the buyer again and
   confirm your response is still there.
2. Switch to the partner’s window and open the same URL. Responses made
   by the buyer should be visible (unless marked private). Completions
   should show as completed for both partners (single scheduled_item, one
   completion row).

Pass ☐ / Fail ☐

### 3F. `notified_at` history doesn’t resurface emails

```sql
select id, unlock_at, notified_at
from journey_scheduled_items
where assignment_id = '<ASSIGNMENT_ID>' and notified_at is not null;
```

Trigger the cron again. Expected: no email sent, `scanned` count reflects
only rows that still match the filter.

Pass ☐ / Fail ☐

---

## Flow 4 - Admin control

**Goal** Assign, override, remove, re-materialize from
`/dashboard/journey/clients/<ownerKey>` and see the changes reflected
immediately on the user timeline.

### 4A. Assign

1. As admin, open `/dashboard/journey/clients/couple:<COUPLE_ID>` (or
   `user:<USER_ID>` for a solo owner).
2. Use **New assignment** to add a second program or category.
3. Confirm - the new AssignmentCard appears on the page, with its own
   list of ScheduledItemRows.
4. In a second tab, reload `/journey/timeline` as the user. The new items
   should appear under their category section immediately.

Pass ☐ / Fail ☐

### 4B. Override unlock_at on one item

1. In the admin, click the **Edit** icon on one ScheduledItemRow, change
   the unlock date, and save. `UnlockEditDialog` should show the resolved
   date preview.
2. In the user tab, reload. The row’s unlock time should reflect the new
   date. If it was pushed into the past, it now shows as available; if
   pushed into the future, it shows as locked with the countdown.

Pass ☐ / Fail ☐

### 4C. Re-materialize

1. In the admin **Program catalog**, add a new item to the program the
   user is assigned to.
2. The PropagateConfirmDialog should offer to add this item to existing
   assignments - apply.
3. Back on the client’s AssignmentCard, click **Re-materialize** (or
   confirm via the propagation dialog). Scheduled item count goes up by
   one.
4. In the user tab, reload. The new item appears on the timeline.

Pass ☐ / Fail ☐

### 4D. Remove

1. Admin: set an AssignmentCard to **cancel** (sets `is_active = false`).
2. User tab: reload. The cancelled assignment’s items disappear from the
   timeline (or the timeline becomes empty if that was the only one).

Pass ☐ / Fail ☐

### 4E. Re-activate

1. Admin: re-activate the cancelled assignment.
2. User tab: reload. Items return to the timeline with the same statuses
   (completions preserved).

Pass ☐ / Fail ☐

---

## Flow 5 - Mobile experience

**Goal** Timeline is readable, CTAs are obvious, scrolling and hierarchy
feel premium on a phone.

Run in Chrome devtools with iPhone 14 emulation (390×844), then confirm
on a real device.

### 5A. `/my`

- Three pillar cards stack vertically, no horizontal scroll.
- Journey pillar card’s CTA is thumb-reachable, full-width, min-height
  48px.

Pass ☐ / Fail ☐

### 5B. `/journey/timeline`

- Page header shrinks on mobile (`text-3xl` on <sm:, `text-5xl` on ≥lg:).
- Progress chip lives below the title, not squeezed next to it.
- NextUpHero image is ~280px wide, centered, with the title/body/CTA
  stacked below it (media-above-text on mobile, media-beside-text on
  desktop).
- NextUpHero CTA is a full pill, min-height 48px.
- Category sections use one column on mobile.
- Each ScheduledItemRow: image on the right (RTL) / left (LTR), text
  wraps cleanly, the CTA button is at least 44×44.

Pass ☐ / Fail ☐

### 5C. `/journey/timeline/<id>` item detail

- Title doesn’t overflow.
- Image fills width with rounded corners.
- Response form stays readable and the submit button is thumb-sized.

Pass ☐ / Fail ☐

### 5D. Email rendering on mobile

1. Open the unlock email on your phone (native mail client).
2. Confirm:
   - Layout is single-column, no side scroll.
   - CTA button fills the card, high contrast.
   - RTL renders correctly for the Hebrew version.

Pass ☐ / Fail ☐

---

## Test data reset

Use between runs if you want a clean slate for a buyer:

```sql
-- 1. Get the user id
select id from auth.users where email = '<TEST_EMAIL>';

-- 2. Undo journey state
delete from journey_item_completions where completed_by = '<USER_ID>';
delete from journey_item_responses   where user_id      = '<USER_ID>';
delete from journey_scheduled_items
  where assignment_id in (select id from journey_assignments where user_id = '<USER_ID>' or couple_id in (select couple_id from couple_members where user_id = '<USER_ID>'));
delete from journey_assignments
  where user_id = '<USER_ID>'
     or couple_id in (select couple_id from couple_members where user_id = '<USER_ID>');

-- 3. Undo couple (careful - this also affects the partner)
delete from couple_invitations
  where couple_id in (select couple_id from couple_members where user_id = '<USER_ID>');
delete from couple_members where user_id = '<USER_ID>';
delete from couples where id in (
  select id from couples c
  where not exists (select 1 from couple_members cm where cm.couple_id = c.id)
);

-- 4. Undo subscription (leaves auth.users intact)
delete from subscriptions where user_id = '<USER_ID>';
delete from checkout_sessions where user_id = '<USER_ID>';
```

---

## Known minor items (non-blocking)

- The billing success copy was updated in this phase to
  `goJourney → /journey/timeline` (primary) and `goAccount → /my`
  (secondary) - the old copy said “Back to questionnaire”. Re-deploy if
  you still see the old strings.
- The unlock cron scan re-visits already-completed-before-notified rows
  each hour (skipped immediately, but wastes one row-scan). Optional
  optimization: stamp `notified_at` on the completion path too. Not a
  correctness issue.
- The solo → couple migration helper is wired on invite-accept only. If a
  couple is created by some OTHER code path (none exist today), the
  helper must be called there too.

---

## Sign-off

- Flow 1 - Purchase ☐
- Flow 2 - Unlock ☐
- Flow 3 - Solo → Couple ☐
- Flow 4 - Admin control ☐
- Flow 5 - Mobile ☐

When all five are ☑, Phase 6 is production-ready.
