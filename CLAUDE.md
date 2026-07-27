# mioshy — working rules

## 🚨 Supabase reads and the Next.js Data Cache

**Rule: never build a Supabase client by hand. Always use one of the shared
factories** — `createAdminClient()` / `createServiceRoleClient()`
(`lib/supabase-admin.ts`), `createAdminSupabaseClient()` (`lib/supabase/admin.ts`),
or `createServerSupabaseClient()` (`lib/supabase/server.ts`). The admin factories
pass a `cache: "no-store"` fetch, and that is the only thing standing between us
and silently frozen data.

**If you ever do call `createClient()` directly, it MUST pass:**

```ts
global: { fetch: (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, cache: "no-store" }) }
```

### The mechanism (so nobody has to rediscover it)

supabase-js talks over plain `fetch`, and Next patches global fetch. From
`next/dist/server/lib/patch-fetch.js`:

```
autoNoCache = (authorization/cookie header || non-GET/HEAD method)
              && staticGenerationStore.revalidate === 0
```

- supabase-js always sends `Authorization`, so the left side is always true.
- `revalidate === 0` is set **only** when the route exports a non-static method
  (POST/PUT/PATCH/DELETE — see `route-modules/app-route/module.js`), or when
  something called `cookies()` / `headers()` / `unstable_noStore()` *before* the
  query.
- **`export const dynamic = "force-dynamic"` does NOT set it.** It only sets
  `forceDynamic`. This is the trap.

So in a **GET-only route handler that never touches cookies**, a Supabase read is
stored with `revalidate: false` → cached forever, and the Vercel **Data Cache
survives deployments**. Redeploying does not clear it.

### It has already bitten us twice

- **Poll counter (2026-07-14 → 07-27).** `/api/poll/tally` is GET-only and never
  read a cookie, so production replayed a 13-day-old response: "1 answered"
  against a table holding 19 votes. Local dev never reproduced it — its Data
  Cache starts empty.
- **Cardcom callback.** `/api/billing/cardcom/indicator` is a GET-only payment
  callback whose idempotency guard reads
  `billing_events?idempotency_key=eq.<key>`. A cached "not found" on a retried
  payment would have let the same transaction be processed twice.

### Symptom to recognise

Production shows a plausible but *unmoving* number, while the database and
localhost agree on a different one. **Always check a suspicious production number
against the DB before believing it** — and before concluding "there is no bug".

### Writes are safe

POST/PUT/PATCH/DELETE are never cached. This is a read-only hazard.

---

## Consent on every lead-capture / account-creation point

Terms acceptance is **mandatory** (gates the CTA and is re-checked server-side);
marketing consent is **optional, never pre-checked**, and the real choice is what
gets stored. Both use the one approved wording from `getOtpConsentCopy()`
(CMS: page `journey`, keys `journeyAssessment.inlineAuth.*`) — do not write
surface-specific consent copy. Consents are written to `profiles`
(`terms_accepted`/`_at`, `marketing_consent`/`_at`/`_source`) and, when marketing
is ticked, synced to Brevo.

Applies to: `/auth`, the journey + assessment inline signups, the survey end
screen, `SubscriptionModal`, `MarathonForm`, and the partner-invite claim.

## Environment

There is **one** Supabase project for every environment — local writes hit
production data. Treat every migration, delete and backfill accordingly.
