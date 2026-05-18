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
 *   5. With BREVO_WEBHOOK_SECRET set and wrong Authorization → 401.
 *   6. With BREVO_WEBHOOK_SECRET set and right Authorization → 200.
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
  // Ensure no secret is set unless a test opts in.
  delete process.env.BREVO_WEBHOOK_SECRET;
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
    const json = (await res.json()) as { ok: boolean; matched: boolean };
    expect(json.ok).toBe(true);
    expect(json.matched).toBe(true);

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
    const json = (await res.json()) as { ok: boolean; matched: boolean };
    expect(json.ok).toBe(true);
    expect(json.matched).toBe(false);
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
  it("returns 401 when BREVO_WEBHOOK_SECRET is set but the request omits it", async () => {
    process.env.BREVO_WEBHOOK_SECRET = "topsecret";
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(profilesUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token doesn't match", async () => {
    process.env.BREVO_WEBHOOK_SECRET = "topsecret";
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
      headers: { authorization: "Bearer wrong" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 when the bearer token matches", async () => {
    process.env.BREVO_WEBHOOK_SECRET = "topsecret";
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
      headers: { authorization: "Bearer topsecret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(profilesUpdateMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 when the ?secret= query param matches", async () => {
    process.env.BREVO_WEBHOOK_SECRET = "topsecret";
    const req = makeRequest({
      body: { event: "unsubscribed", email: "known@example.com" },
      url: "https://mioshy.com/api/brevo/unsubscribe-webhook?secret=topsecret",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
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
    const json = (await res.json()) as { ok: boolean; ignored?: string };
    expect(json.ok).toBe(true);
    expect(json.ignored).toBe("non_unsubscribe_event");
    expect(profilesUpdateMock).not.toHaveBeenCalled();
  });
});
