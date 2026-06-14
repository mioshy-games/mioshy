# C0 — Weekly Billing Audit (2026-06-13)

Scope: document the existing Cardcom weekly billing flow, verify the
payment-failure display path, and record known reliability bugs. No code
changed. Precondition for the billing rework (gate C → C1 → C2).

Context: **no active subscriptions exist — only test accounts.** Reliability
was therefore audited by reading the code path, not by observing real traffic.

---

## 1. Weekly billing flow (end-to-end)

### Initial purchase
1. `app/api/billing/checkout/create/route.ts` — validates `plan === "weekly"`
   and a valid pillar (`games | journey | adults`); computes price via
   `getPlanPrice()` (`lib/billing.ts`); opens a Cardcom LowProfile session
   (`lib/cardcom.ts → openLowProfile`, Operation=2 = charge + create reusable
   token). `getPlanPrice` is called **only here** (single caller).
2. Webhook `app/api/billing/cardcom/indicator/route.ts` — confirms payment,
   extracts + encrypts the token (`lib/tokenCrypto.ts`), creates the
   `subscriptions` row (`status='active'`, `next_billing_date`),
   `customer_payment_methods`, and the invoice. Idempotent via `billing_events`.

### Weekly renewal — daily cron `0 6 * * *`
`app/api/billing/renewals/run/route.ts`:
- Selects `subscriptions` where `status IN ('active','past_due')` and
  `next_billing_date <= now`, ordered by `next_billing_date`, **`.limit(20)`**.
- **Skips test users** (`profiles.is_test_user = true`, lines 71–80) — they are
  never charged.
- Per subscription: idempotency check on `uniq_asmachta`; `chargeToken`
  (`JParameter=5` = standing order).
  - **Success:** `status='active'`, advance `current_period_end` +
    `next_billing_date` by 7 days (`addPlanPeriod`), reset `failed_attempts`
    and `grace_until`, clear journey grace columns, issue invoice.
  - **Failure:** `status='past_due'`, `failed_attempts++`,
    `grace_until = now + 7d` (`GRACE_PERIOD_DAYS`).
- End of run (lines 320–326): any `past_due` past its `grace_until` →
  `status='blocked'`.
- Auth: bearer `CARDCOM_BILLING_CRON_SECRET`; `GET = POST` alias (Vercel cron
  invokes via GET).

---

## 2. Payment-failure display — verified in code

`app/[locale]/account/page.tsx` reads `subscriptions.status` (line 120) and:
- **Status pill** (lines 196–251): active=emerald, past_due=amber, blocked=rose,
  frozen=sky.
- **past_due banner** (lines 286–291): `graceNotice` = *"חיובכם האחרון נכשל. יש
  לעדכן אמצעי תשלום בקרוב אחרת החשבון ייחסם."*
- **blocked banner** (lines 292–297): `blockedNotice` = *"החשבון חסום עקב כשלי
  חיוב. נא לעדכן אמצעי תשלום."*

**Manual verification caveat:** the renewals cron skips test users, so a real
failed charge cannot be triggered on a test account. To verify the banner,
manually set the status on a test subscription and load `/account`:
```sql
update subscriptions set status='past_due', grace_until = now() + interval '7 days' where user_id = '<test-user>';
-- then:
update subscriptions set status='blocked' where user_id = '<test-user>';
-- restore:
update subscriptions set status='active', grace_until = null where user_id = '<test-user>';
```

---

## 3. Known reliability bugs (fix during C1/C2 — tracked as TODOs)

1. **`.limit(20)` per daily renewal run** (`renewals/run/route.ts:48`) — hard cap
   of 20 charges/day. Fine pre-launch (no real subs); must be paginated/raised
   before scale.
2. **`/account` shows only the latest subscription** (`account/page.tsx:125`,
   `.limit(1)`) — a user with multiple pillars (games + journey) whose
   non-latest sub is past_due won't see its banner.
3. **Failed-charge retry reuses the same `asmachta`** — on failure
   `current_period_end` doesn't advance, so the next day's retry computes the
   same `makeAsmachta(userId, periodStart)`; Cardcom may treat repeated calls
   as a duplicate. Validate retry behavior when reworking.

---

## 4. Why migration 092 removed monthly/annual (relevant to C2)

Commit `a3b313a` (2026-05-22) — **deliberate pricing simplification, not a bug
fix.** Reason: monthly/annual "were never used in production." Implications:
- C2 (reinstate monthly/quarterly/yearly with weekly *display*) is a **fresh
  build**, not a restore of battle-tested code.
- Old code recoverable via `git show a3b313a^:lib/billing.ts`. **Avoid its
  `addPlanPeriod` bug** — it used `setMonth(+1)`/`setFullYear(+1)` (month-end
  edge cases, e.g. charging on the 31st). Use safe date math.
- **Quarterly (רבעוני) never existed** even in the old code — genuinely new, and
  per spec is **Journey-only**.
- Old amounts (ILS): games 9/37/369, journey 57/219/2199 — historical reference
  only, not authoritative for new pricing.
