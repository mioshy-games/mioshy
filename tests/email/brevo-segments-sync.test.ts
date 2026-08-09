/**
 * Tests for the Brevo segmentation sync layer.
 *
 * Strategy: mock global fetch. Each test asserts:
 *   - the right Brevo endpoint(s) were called
 *   - listIds / removeFromLists in the request body match the
 *     lifecycle stage's contract (see brevo-segments-sync.ts comments)
 *   - the function returns { success: false } (never throws) on Brevo
 *     4xx/5xx responses
 *
 * Location note: tests live in tests/** per the project convention
 * (see vitest.config.ts:31). The original prompt asked for
 * lib/email/__tests__/ but that path is outside vitest's include
 * pattern, so the test would never run.
 *
 * List IDs (mocked):
 *   INTERESTED=39, REGISTERED=40, JOURNEY_MEMBER=41, JOURNEY_COUPLE=42,
 *   ADULTS=43, GAMES=44, EXISTING=45 — mirrors the actual Brevo IDs
 *   created on 2026-05-18.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ------------------------------------------------------------
// Mocks must be hoisted before importing the module under test.
// ------------------------------------------------------------
//
// Note: we import the *-core module directly (the un-guarded twin) so we
// don't have to mock `server-only`. App code imports the wrapper at
// @/lib/email/brevo-segments-sync; this test exercises the pure logic.

vi.mock("@/lib/email/brevo-segments", () => ({
  BREVO_LISTS: {
    INTERESTED: 39,
    REGISTERED: 40,
    JOURNEY_MEMBER: 41,
    JOURNEY_COUPLE: 42,
    ADULTS: 43,
    GAMES: 44,
    EXISTING: 45,
  },
  BREVO_ATTRS: {
    LANGUAGE: "LANGUAGE",
    SIGNUP_DATE: "SIGNUP_DATE",
    LAST_PURCHASE_DATE: "LAST_PURCHASE_DATE",
    TOTAL_SPENT: "TOTAL_SPENT",
    PRODUCTS_OWNED: "PRODUCTS_OWNED",
    HAS_PARTNER: "HAS_PARTNER",
    USER_SOURCE: "USER_SOURCE",
  },
}));

// Set a syntactically-valid raw key so getBrevoApiKey() succeeds without
// running base64-JSON decoding (we set the raw xkeysib- shape directly).
process.env.BREVO_API_KEY = "xkeysib-test-key-0000000000000000";

import {
  tagAsInterested,
  tagAsRegistered,
  tagAsJourneyMember,
  tagAsJourneyCouple,
  tagAsAdultsBuyer,
  tagAsGamesSubscriber,
  untagGamesSubscriber,
  addProductToContact,
} from "@/lib/email/brevo-segments-sync-core";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

type CallRecord = { url: string; method: string; body: unknown };

/**
 * Replace global.fetch with a recorder. Default behaviour:
 *   - GET /contacts/{id}        → 200 with { attributes: {} }   (new contact)
 *   - POST /contacts            → 201
 *   - POST .../contacts/remove  → 204
 *   - PUT  /contacts/{id}       → 204
 *
 * Pass `overrides` to short-circuit specific paths with different status
 * codes / payloads. Each override is checked in order — first match wins.
 */
function installFetch(
  overrides: Array<{
    matches: (url: string, method: string) => boolean;
    response: () => Response;
  }> = [],
): { fetchMock: ReturnType<typeof vi.fn>; calls: CallRecord[] } {
  const calls: CallRecord[] = [];
  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    let body: unknown = null;
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, method, body });

    for (const o of overrides) {
      if (o.matches(url, method)) return o.response();
    }

    // Defaults by route+method.
    if (method === "GET" && url.includes("/contacts/")) {
      return new Response(JSON.stringify({ attributes: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (method === "POST" && url.endsWith("/contacts")) {
      return new Response(JSON.stringify({ id: 1 }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    if (method === "POST" && url.includes("/contacts/remove")) {
      return new Response(null, { status: 204 });
    }
    if (method === "PUT" && url.includes("/contacts/")) {
      return new Response(null, { status: 204 });
    }
    return new Response("", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function postContactCall(calls: CallRecord[]) {
  return calls.find(
    (c) => c.method === "POST" && c.url.endsWith("/v3/contacts"),
  );
}

function removeListIds(calls: CallRecord[]): number[] {
  return calls
    .filter((c) => c.url.includes("/contacts/lists/") && c.url.endsWith("/contacts/remove"))
    .map((c) => {
      const m = c.url.match(/\/contacts\/lists\/(\d+)\/contacts\/remove$/);
      return m ? Number(m[1]) : -1;
    });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ------------------------------------------------------------
// 1. tagAsInterested
// ------------------------------------------------------------

describe("tagAsInterested", () => {
  it("upserts the contact with LANGUAGE + USER_SOURCE and adds to INTERESTED", async () => {
    const { calls } = installFetch();
    const res = await tagAsInterested("LEAD@example.com", "he", "homepage");

    expect(res.success).toBe(true);
    const post = postContactCall(calls);
    expect(post).toBeDefined();
    expect(post?.body).toMatchObject({
      email: "lead@example.com", // normalised to lowercase
      updateEnabled: true,
      attributes: { LANGUAGE: "he", USER_SOURCE: "homepage" },
      listIds: [39],
    });
    // tagAsInterested does NOT remove from any lists.
    expect(removeListIds(calls)).toEqual([]);
  });

  it("returns { success: false } and does not throw on 400", async () => {
    installFetch([
      {
        matches: (url, method) => method === "POST" && url.endsWith("/v3/contacts"),
        response: () =>
          new Response(JSON.stringify({ message: "invalid_email" }), {
            status: 400,
          }),
      },
    ]);
    const res = await tagAsInterested("bad@example.com", "en", "warm_list");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/POST \/contacts 400/);
  });
});

// ------------------------------------------------------------
// 2. tagAsRegistered
// ------------------------------------------------------------

describe("tagAsRegistered", () => {
  it("adds REGISTERED, removes INTERESTED, stamps SIGNUP_DATE on new contact", async () => {
    const { calls } = installFetch();
    const res = await tagAsRegistered("u@example.com", "user-uuid", "he");

    expect(res.success).toBe(true);

    const post = postContactCall(calls);
    expect(post?.body).toMatchObject({
      email: "u@example.com",
      ext_id: "user-uuid",
      updateEnabled: true,
      listIds: [40],
      attributes: {
        LANGUAGE: "he",
        USER_SOURCE: "registered",
      },
    });
    const postBody = post?.body as { attributes: { SIGNUP_DATE: string } };
    expect(postBody.attributes.SIGNUP_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(removeListIds(calls)).toEqual([39]);
  });

  it("preserves an existing SIGNUP_DATE when called again", async () => {
    const { calls } = installFetch([
      {
        matches: (url, method) =>
          method === "GET" && url.includes("/contacts/"),
        response: () =>
          new Response(
            JSON.stringify({ attributes: { SIGNUP_DATE: "2025-12-01" } }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      },
    ]);
    await tagAsRegistered("u@example.com", "user-uuid", "en");
    const post = postContactCall(calls);
    const postBody = post?.body as { attributes: { SIGNUP_DATE: string } };
    expect(postBody.attributes.SIGNUP_DATE).toBe("2025-12-01");
  });
});

// ------------------------------------------------------------
// 3. tagAsJourneyMember
// ------------------------------------------------------------

describe("tagAsJourneyMember", () => {
  it("adds JOURNEY_MEMBER + EXISTING, removes REGISTERED + INTERESTED, stamps purchase fields", async () => {
    const { calls } = installFetch();
    const res = await tagAsJourneyMember(
      "buyer@example.com",
      "user-uuid",
      "he",
      219,
    );

    expect(res.success).toBe(true);

    const post = postContactCall(calls);
    expect(post?.body).toMatchObject({
      email: "buyer@example.com",
      ext_id: "user-uuid",
      listIds: [41, 45],
      attributes: { LANGUAGE: "he", TOTAL_SPENT: 219 },
    });
    const postBody = post?.body as { attributes: { LAST_PURCHASE_DATE: string } };
    expect(postBody.attributes.LAST_PURCHASE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(removeListIds(calls).sort()).toEqual([39, 40]);
  });

  it("increments TOTAL_SPENT instead of overwriting it", async () => {
    const { calls } = installFetch([
      {
        matches: (url, method) =>
          method === "GET" && url.includes("/contacts/"),
        response: () =>
          new Response(
            JSON.stringify({
              attributes: { TOTAL_SPENT: 100, PRODUCTS_OWNED: "games" },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      },
    ]);
    await tagAsJourneyMember("buyer@example.com", "user-uuid", "en", 219);
    const post = postContactCall(calls);
    const body = post?.body as { attributes: { TOTAL_SPENT: number } };
    expect(body.attributes.TOTAL_SPENT).toBe(319);
  });

  it("returns { success: false } on Brevo 500", async () => {
    installFetch([
      {
        matches: (url, method) =>
          method === "POST" && url.endsWith("/v3/contacts"),
        response: () => new Response("boom", { status: 500 }),
      },
    ]);
    const res = await tagAsJourneyMember("x@example.com", "u", "he", 219);
    expect(res.success).toBe(false);
  });
});

// ------------------------------------------------------------
// 4. tagAsJourneyCouple
// ------------------------------------------------------------

describe("tagAsJourneyCouple", () => {
  it("adds JOURNEY_COUPLE + EXISTING, removes REGISTERED + INTERESTED, sets HAS_PARTNER=true", async () => {
    const { calls } = installFetch();
    const res = await tagAsJourneyCouple(
      "partner@example.com",
      "partner-uuid",
      "en",
      "owner-uuid",
    );

    expect(res.success).toBe(true);
    const post = postContactCall(calls);
    expect(post?.body).toMatchObject({
      email: "partner@example.com",
      ext_id: "partner-uuid",
      listIds: [42, 45],
      attributes: { LANGUAGE: "en", HAS_PARTNER: true },
    });
    expect(removeListIds(calls).sort()).toEqual([39, 40]);
  });
});

// ------------------------------------------------------------
// 5. tagAsAdultsBuyer
// ------------------------------------------------------------

describe("tagAsAdultsBuyer", () => {
  it("adds ADULTS + EXISTING, removes REGISTERED + INTERESTED", async () => {
    const { calls } = installFetch();
    const res = await tagAsAdultsBuyer(
      "ad@example.com",
      "user-uuid",
      "he",
      "single",
      127,
    );

    expect(res.success).toBe(true);
    const post = postContactCall(calls);
    expect(post?.body).toMatchObject({
      listIds: [43, 45],
      attributes: { LANGUAGE: "he", TOTAL_SPENT: 127 },
    });
    expect(removeListIds(calls).sort()).toEqual([39, 40]);
  });

  it("accepts each AdultsTier without throwing", async () => {
    installFetch();
    await expect(
      tagAsAdultsBuyer("a@example.com", "u", "he", "monthly", 87),
    ).resolves.toMatchObject({ success: true });
    await expect(
      tagAsAdultsBuyer("a@example.com", "u", "he", "annual", 570),
    ).resolves.toMatchObject({ success: true });
  });
});

// ------------------------------------------------------------
// 6. tagAsGamesSubscriber
// ------------------------------------------------------------

describe("tagAsGamesSubscriber", () => {
  it("adds GAMES + EXISTING, removes REGISTERED + INTERESTED", async () => {
    const { calls } = installFetch();
    const res = await tagAsGamesSubscriber(
      "g@example.com",
      "user-uuid",
      "he",
      37,
    );

    expect(res.success).toBe(true);
    const post = postContactCall(calls);
    expect(post?.body).toMatchObject({
      listIds: [44, 45],
      attributes: { LANGUAGE: "he", TOTAL_SPENT: 37 },
    });
    expect(removeListIds(calls).sort()).toEqual([39, 40]);
  });
});

// ------------------------------------------------------------
// 7. untagGamesSubscriber
// ------------------------------------------------------------

describe("untagGamesSubscriber", () => {
  it("removes only from GAMES; leaves EXISTING intact", async () => {
    const { calls } = installFetch();
    const res = await untagGamesSubscriber("g@example.com");

    expect(res.success).toBe(true);
    expect(removeListIds(calls)).toEqual([44]);

    // No listIds added, no attributes payload required.
    const post = postContactCall(calls);
    const body = post?.body as { listIds?: number[]; attributes?: unknown };
    expect(body?.listIds).toBeUndefined();
    expect(body?.attributes).toBeUndefined();
  });

  it("returns { success: false } on Brevo failure", async () => {
    installFetch([
      {
        matches: (url, method) =>
          method === "POST" && url.endsWith("/v3/contacts"),
        response: () => new Response("err", { status: 502 }),
      },
    ]);
    const res = await untagGamesSubscriber("g@example.com");
    expect(res.success).toBe(false);
  });
});

// ------------------------------------------------------------
// Helper: addProductToContact
// ------------------------------------------------------------

describe("addProductToContact", () => {
  it("merges into the existing comma-separated list without duplicates", async () => {
    const { calls } = installFetch([
      {
        matches: (url, method) =>
          method === "GET" && url.includes("/contacts/"),
        response: () =>
          new Response(
            JSON.stringify({
              attributes: { PRODUCTS_OWNED: "games,journey" },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      },
    ]);
    const result = await addProductToContact("u@example.com", "adults");
    expect(result.split(",").sort()).toEqual(["adults", "games", "journey"]);

    const put = calls.find((c) => c.method === "PUT");
    expect(put).toBeDefined();
    const body = put?.body as { attributes: { PRODUCTS_OWNED: string } };
    expect(body.attributes.PRODUCTS_OWNED.split(",").sort()).toEqual([
      "adults",
      "games",
      "journey",
    ]);
  });

  it("is a no-op when the product is already present", async () => {
    const { calls } = installFetch([
      {
        matches: (url, method) =>
          method === "GET" && url.includes("/contacts/"),
        response: () =>
          new Response(
            JSON.stringify({ attributes: { PRODUCTS_OWNED: "journey,adults" } }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      },
    ]);
    const result = await addProductToContact("u@example.com", "adults");
    expect(result.split(",").sort()).toEqual(["adults", "journey"]);

    const put = calls.find((c) => c.method === "PUT");
    expect(put).toBeUndefined();
  });
});

// ------------------------------------------------------------
// Cross-cutting: no public function ever throws
// ------------------------------------------------------------

describe("never throws", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
  });

  it("tagAsInterested swallows network errors", async () => {
    const res = await tagAsInterested("a@b.com", "he", "homepage");
    expect(res.success).toBe(false);
    expect(typeof res.error).toBe("string");
  });

  it("tagAsRegistered swallows network errors", async () => {
    const res = await tagAsRegistered("a@b.com", "u", "he");
    expect(res.success).toBe(false);
  });

  it("untagGamesSubscriber swallows network errors", async () => {
    const res = await untagGamesSubscriber("a@b.com");
    expect(res.success).toBe(false);
  });
});
