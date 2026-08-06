/**
 * Tests for POST /api/brevo/unsubscribe-webhook.
 *
 * Strategy: mock the Supabase admin client. Build a Request manually and
 * pass it to the route handler. Assert on the profiles update payload
 * and HTTP status.
 *
 * Scenarios covered:
 *   1. Valid webhook for an existing user → 200, marketing_consent=false stamped.
 *   2. Webhook for an unknown email → 200 (idempotent, no update).
 *   3. Missing/invalid email → 400.
 *   4. Invalid JSON body → 400.
 *   5. Wrong secret → no work done, and a body indistinguishable from a miss.
 *   6. Right secret → 200 and the update happens.
 *   7. No secret configured → 503 (audit H1: this used to serve everyone).
 *
 * CONTRACT CHANGE — audit 2026-08-05, H1. The handler used to answer
 * `{ ok, matched: true|false }`, which told any unauthenticated caller whether
 * a given address had an account. Every authenticated outcome now returns the
 * same `{ ok: true }`, and the secret is mandatory. Assertions below were
 * rewritten to encode that contract rather than the old one.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------- hoisted mocks ----------

const listUsersMock = vi.fn();
const profilesUpdateMock = vi.fn(async () => ({ data: null, error: null }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    auth: { admin: { listUsers: listUsersMock } },
    from: (_table: string) => ({
      update: (payload: unknown) => ({
        eq: (_col: string, val: unknown) => {
          profilesUpdateMock(payload, val);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    }),
  }),
}));

// ---------- import handler after mocks ----------

import { POST } from "@/app/api/brevo/unsubscribe-webhook/route";

// ---------- helpers ----------

function makeRequest(opts: {
  body?: unknown;
  bodyText?: string;
  headers?: Record<string, string>;
  url?: string;
}): Request {
  const body =
    opts.bodyText !== undefined
      ? opts.bodyText
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : "";
  return new Request(opts.url ?? "https://mioshy.com/api/brevo/unsubscribe-webhook", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      // Authenticated by default — individual tests override or drop it.
      authorization: "Bearer topsecret",
      ...(opts.headers ?? {}),
    },
  });
}

beforeEach(() => {
  listUsersMock.mockReset();
  profilesUpdateMock.mockClear();
  // Default: a single known user.
  listUsersMock.mockResolvedValue({
    data: {
      users: [
        { id: "user-uuid-A", email: "Known@Example.com" },
        { id: "user-uuid-B", email: "other@example.com" },
      ],
    },
    error: null,
  });
  // The secret is now mandatory, so it is the default for every test; the
  // "not configured" case opts OUT by deleting it.
  process.env.BREVO_WEBHOOK_SECRET = "topsecret";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.BREVO_WEBHOOK_SECRET;
});

// ------------------------------------------------------------
// 1. Happy path — known email, no secret configured
// ------------------------------------------------------------

describe("POST /api/brevo/unsubscribe-webhook — happy path", () => {
  it("flips marketing_consent to false on an existing profile", async () => {
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    expect(profilesUpdateMock).toHaveBeenCalledTimes(1);
    const [payload, userId] = profilesUpdateMock.mock.calls[0];
    expect(payload).toMatchObject({
      marketing_consent: false,
      marketing_consent_source: "brevo_unsubscribe",
    });
    // Timestamp present
    expect(
      typeof (payload as { marketing_consent_at: string }).marketing_consent_at,
    ).toBe("string");
    // Resolved to user A (case-insensitive match against "Known@Example.com")
    expect(userId).toBe("user-uuid-A");
  });

  it("matches case-insensitively on the inbound email", async () => {
    const req = makeRequest({
      body: { event: "unsubscribed", email: "KNOWN@EXAMPLE.COM" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(profilesUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("accepts event='unsubscribe' (singular) as an alias", async () => {
    const req = makeRequest({
      body: { event: "unsubscribe", email: "known@example.com" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(profilesUpdateMock).toHaveBeenCalledTimes(1);
  });
});

// ------------------------------------------------------------
// 2. Unknown email — still 200, no update
// ------------------------------------------------------------

describe("unknown email", () => {
  it("returns 200 and skips the update when the email is not in auth.users", async () => {
    const req = makeRequest({
      body: { event: "unsubscribed", email: "nobody@example.com" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Byte-identical to the "known email" response — see the enumeration test.
    expect(await res.json()).toEqual({ ok: true });
    expect(profilesUpdateMock).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------
// 3. Validation
// ------------------------------------------------------------

describe("validation", () => {
  it("returns 400 when email is missing", async () => {
    const req = makeRequest({ body: { event: "unsubscribed" } });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(profilesUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 400 when email is not a string", async () => {
    const req = makeRequest({ body: { event: "unsubscribed", email: 123 } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const req = makeRequest({ bodyText: "{not json" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ------------------------------------------------------------
// 4. Shared-secret guard
// ------------------------------------------------------------

describe("shared-secret guard", () => {
  it("does no work when the request omits the secret", async () => {
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
      headers: { authorization: "" },
    });
    const res = await POST(req);
    expect(profilesUpdateMock).not.toHaveBeenCalled();
    // Deliberately NOT a 401: an error status is itself a signal. See H1.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does no work when the bearer token doesn't match", async () => {
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
      headers: { authorization: "Bearer wrong" },
    });
    const res = await POST(req);
    expect(profilesUpdateMock).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects a token that is a prefix of the real secret", async () => {
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
      headers: { authorization: "Bearer topsecre" },
    });
    await POST(req);
    expect(profilesUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 200 and updates when the bearer token matches", async () => {
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
      headers: { authorization: "Bearer topsecret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(profilesUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 when the ?secret= query param matches", async () => {
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
      headers: { authorization: "" },
      url: "https://mioshy.com/api/brevo/unsubscribe-webhook?secret=topsecret",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(profilesUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("fails CLOSED with 503 when no secret is configured", async () => {
    delete process.env.BREVO_WEBHOOK_SECRET;
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
    });
    const res = await POST(req);
    // Before H1 this returned 200 and processed the request — the endpoint was
    // open to anyone who knew the URL, and the variable was never set.
    expect(res.status).toBe(503);
    expect(profilesUpdateMock).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------
// 4b. Account enumeration must be impossible
// ------------------------------------------------------------

describe("no account-enumeration oracle", () => {
  it("answers identically for a registered and an unregistered address", async () => {
    const known = await POST(
      makeRequest({ body: { event: "unsubscribed", email: "known@example.com" } }),
    );
    const knownBody = await known.text();

    profilesUpdateMock.mockClear();

    const unknown = await POST(
      makeRequest({ body: { event: "unsubscribed", email: "nobody@example.com" } }),
    );
    const unknownBody = await unknown.text();

    expect(known.status).toBe(unknown.status);
    expect(knownBody).toBe(unknownBody);
  });

  it("answers the same again when the secret is wrong", async () => {
    const good = await POST(
      makeRequest({ body: { event: "unsubscribed", email: "nobody@example.com" } }),
    );
    const bad = await POST(
      makeRequest({
        body: { event: "unsubscribed", email: "known@example.com" },
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(good.status).toBe(bad.status);
    expect(await good.text()).toBe(await bad.text());
  });
});

// ------------------------------------------------------------
// 5. Non-unsubscribe event — ack without changes
// ------------------------------------------------------------

describe("non-unsubscribe event", () => {
  it("returns 200 + ignored marker without flipping consent", async () => {
    const req = makeRequest({
      body: { event: "delivered", email: "known@example.com" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // Same opaque body as every other authenticated outcome.
    expect(await res.json()).toEqual({ ok: true });
    expect(profilesUpdateMock).not.toHaveBeenCalled();
  });
});
