/**
 * tests/billing/cardcom-indicator-session-binding.test.ts
 *
 * Audit 2026-08-05, CRITICAL #3.
 *
 * The Cardcom indicator callback derives its idempotency key from
 * `LowProfileCode`, but used to pick the checkout session from `ReturnValue` —
 * a plain URL query parameter that the payer controls. Nothing compared the
 * two. So an attacker could:
 *
 *   1. open a cheap checkout   → session S_CHEAP, low_profile_code LP_CHEAP
 *   2. open an expensive one   → session S_EXPENSIVE, low_profile_code LP_EXP
 *   3. actually pay only the cheap one
 *   4. call the callback by hand with LowProfileCode=LP_CHEAP (which really is
 *      paid) and ReturnValue=S_EXPENSIVE
 *
 * …and the expensive session would be marked paid and its entitlements granted.
 *
 * These tests lock the binding: `low_profile_code` is authoritative, and
 * `ReturnValue` may only ever resolve a session whose stored code is absent —
 * never one that mismatches.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Module mocks ────────────────────────────────────────────────────────────
// Factories must stay free of top-level variables (vi.mock is hoisted).

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.9",
  checkRateLimit: () => ({ ok: true, retryAfterSec: 0 }),
}));

vi.mock("@/lib/cardcom", () => ({
  pullLowProfileIndicator: vi.fn(async () => ({
    paid: true,
    operationResponse: 0,
    dealNumber: "DEAL-1",
    parsed: {},
    raw: "",
  })),
  extractToken: () => null,
  normalizeExpiry: () => null,
}));

vi.mock("@/lib/tokenCrypto", () => ({
  encryptToken: (t: string) => t,
  tokenHashSha256: (t: string) => t,
}));

vi.mock("@/lib/billing", () => ({
  addPlanPeriod: (d: Date) => new Date(d.getTime() + 30 * 86400_000),
}));

vi.mock("@/lib/uxellent-api", () => ({
  createBillingDocumentWithRetry: vi.fn(async () => ({
    success: false,
    message: "skipped in test",
    errorCode: "unknown",
  })),
}));

vi.mock("@/lib/uxellent-billing-helpers", () => ({
  productNameForSession: async () => "Journey",
  brandToPaymentMethod: () => "כרטיס אשראי",
  extractCardcomCustomerInfo: () => ({ name: null, phone: null, brand: null }),
}));

vi.mock("@/lib/auth/is-test-user", () => ({ isTestUser: async () => true }));

vi.mock("@/lib/journey-content/auto-assign", () => ({
  assignJourneyOnPurchase: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/journey-content/notifications", () => ({
  notifyAdminNewSubscription: vi.fn(async () => undefined),
}));

vi.mock("@/lib/email/brevo-segments-sync", () => ({
  tagAsJourneyMember: vi.fn(async () => ({ success: true })),
  tagAsGamesSubscriber: vi.fn(async () => ({ success: true })),
  tagAsAdultsBuyer: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/analytics/meta-capi", () => ({
  sendMetaCapiEvent: vi.fn(async () => undefined),
  metaEventId: { purchase: (id: string) => `purchase.${id}` },
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: vi.fn(async () => globalThis.__mioshyTestDb),
}));

// ── Fake Supabase client ────────────────────────────────────────────────────

type RecordedOp = {
  table: string;
  op: string;
  payload: Record<string, unknown> | undefined;
  filters: Record<string, unknown>;
};

declare global {
  // eslint-disable-next-line no-var
  var __mioshyTestDb: unknown;
}

function makeDb(fixtures: {
  sessionsByLp?: Record<string, Record<string, unknown>>;
  sessionsById?: Record<string, Record<string, unknown>>;
}) {
  const ops: RecordedOp[] = [];

  function resolveData(
    table: string,
    op: string,
    filters: Record<string, unknown>,
  ): unknown {
    if (table === "checkout_sessions" && op === "select") {
      if (typeof filters.low_profile_code === "string") {
        return fixtures.sessionsByLp?.[filters.low_profile_code] ?? null;
      }
      if (typeof filters.id === "string") {
        return fixtures.sessionsById?.[filters.id] ?? null;
      }
      return null;
    }
    // No prior billing_event → never short-circuits as already-processed.
    if (table === "billing_events") return null;
    // No existing subscription → the insert branch runs.
    if (table === "subscriptions" && op === "select") return null;
    if (table === "subscriptions" && op === "insert") return { id: "sub-1" };
    if (table === "subscription_charges") return { id: "chg-1", invoice_url: null };
    if (table === "customer_payment_methods") return { id: "pm-1" };
    return null;
  }

  function from(table: string) {
    const filters: Record<string, unknown> = {};
    let op = "select";
    let payload: Record<string, unknown> | undefined;

    const finish = () => {
      ops.push({ table, op, payload, filters: { ...filters } });
      return Promise.resolve({ data: resolveData(table, op, filters), error: null });
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return builder;
      },
      insert: (p: Record<string, unknown>) => {
        op = "insert";
        payload = p;
        return builder;
      },
      upsert: (p: Record<string, unknown>) => {
        op = "upsert";
        payload = p;
        return builder;
      },
      update: (p: Record<string, unknown>) => {
        op = "update";
        payload = p;
        return builder;
      },
      maybeSingle: () => finish(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        finish().then(res, rej),
    };
    return builder;
  }

  return {
    from,
    rpc: async () => ({ data: "couple-1", error: null }),
    __ops: ops,
  };
}

/** Did any write mark this checkout session as paid? */
function markedPaid(ops: RecordedOp[]): string[] {
  return ops
    .filter(
      (o) =>
        o.table === "checkout_sessions" &&
        o.op === "update" &&
        (o.payload as { status?: string } | undefined)?.status === "paid",
    )
    .map((o) => String(o.filters.id));
}

const S_CHEAP = {
  id: "sess-cheap",
  low_profile_code: "LP_CHEAP",
  user_id: "user-1",
  email: "buyer@example.com",
  amount: 37,
  currency: "ILS",
  plan: "monthly",
  product: "journey",
  purchase_type: "subscription",
  is_israeli: true,
};

const S_EXPENSIVE = {
  ...S_CHEAP,
  id: "sess-expensive",
  low_profile_code: "LP_EXPENSIVE",
  amount: 1990,
};

async function callIndicator(query: string) {
  const { GET } = await import("@/app/api/billing/cardcom/indicator/route");
  return GET(new Request(`https://mioshy.com/api/billing/cardcom/indicator?${query}`));
}

beforeEach(() => {
  vi.resetModules();
});

describe("ReturnValue can never select a session bound to another LowProfileCode", () => {
  it("ignores a forged ReturnValue and settles the session the code really belongs to", async () => {
    const db = makeDb({
      sessionsByLp: { LP_CHEAP: S_CHEAP },
      sessionsById: { "sess-expensive": S_EXPENSIVE, "sess-cheap": S_CHEAP },
    });
    globalThis.__mioshyTestDb = db;

    const res = await callIndicator(
      "LowProfileCode=LP_CHEAP&ReturnValue=sess-expensive",
    );
    expect(res.status).toBe(200);

    const paid = markedPaid(db.__ops);
    // The cheap session — the one actually paid for — is settled.
    expect(paid).toContain("sess-cheap");
    // The expensive session the attacker pointed at is never touched.
    expect(paid).not.toContain("sess-expensive");
  });

  it("grants nothing when the code matches no session and ReturnValue mismatches", async () => {
    const db = makeDb({
      // LP_FAKE is bound to nothing.
      sessionsByLp: {},
      sessionsById: { "sess-expensive": S_EXPENSIVE },
    });
    globalThis.__mioshyTestDb = db;

    const res = await callIndicator(
      "LowProfileCode=LP_FAKE&ReturnValue=sess-expensive",
    );
    expect(res.status).toBe(200);

    // Nothing was marked paid and no subscription was created.
    expect(markedPaid(db.__ops)).toHaveLength(0);
    expect(db.__ops.filter((o) => o.table === "subscriptions" && o.op === "insert")).toHaveLength(0);

    // The rejection is recorded on the billing event.
    const err = db.__ops.find(
      (o) =>
        o.table === "billing_events" &&
        o.op === "update" &&
        typeof (o.payload as { error?: string } | undefined)?.error === "string",
    );
    expect((err?.payload as { error: string }).error).toMatch(/mismatch/i);
  });
});

describe("the legitimate callback still works", () => {
  it("settles the session and creates the subscription when the code matches", async () => {
    const db = makeDb({
      sessionsByLp: { LP_CHEAP: S_CHEAP },
      sessionsById: { "sess-cheap": S_CHEAP },
    });
    globalThis.__mioshyTestDb = db;

    const res = await callIndicator(
      "LowProfileCode=LP_CHEAP&ReturnValue=sess-cheap",
    );
    expect(res.status).toBe(200);

    expect(markedPaid(db.__ops)).toContain("sess-cheap");
    expect(
      db.__ops.filter((o) => o.table === "subscriptions" && o.op === "insert"),
    ).toHaveLength(1);
  });

  it("still accepts a legacy session whose low_profile_code was never stamped", async () => {
    const legacy = { ...S_CHEAP, id: "sess-legacy", low_profile_code: null };
    const db = makeDb({
      sessionsByLp: {},
      sessionsById: { "sess-legacy": legacy },
    });
    globalThis.__mioshyTestDb = db;

    const res = await callIndicator(
      "LowProfileCode=LP_NEW&ReturnValue=sess-legacy",
    );
    expect(res.status).toBe(200);

    expect(markedPaid(db.__ops)).toContain("sess-legacy");
  });
});
