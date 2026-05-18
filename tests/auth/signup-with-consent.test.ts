/**
 * Tests for the consent-gated signup flow added in Step C1.
 *
 * Strategy:
 *   - Mock the Brevo sync layer (tagAsRegistered).
 *   - Mock the Supabase admin client + the user-facing server client.
 *   - Mock the session-cookie / single-session module.
 *   - Mock next/headers cookies + headers helpers.
 *   - Invoke signupAction(FormData) with various consent + locale values.
 *   - Assert on the upsert payload to profiles AND whether tagAsRegistered
 *     was called.
 *
 * What we are explicitly testing:
 *   1. consent=true → profiles row carries consent fields AND
 *      tagAsRegistered is invoked exactly once with (email, userId, lang).
 *   2. consent=false → profiles row carries consent=false, marketing_consent_at
 *      is NULL, AND tagAsRegistered is NOT called.
 *   3. consent=true but Brevo sync throws → signup STILL succeeds
 *      (fire-and-forget). This is the load-bearing guarantee.
 *   4. Both signup paths use signupAction now (modal vs page) — verified
 *      by passing source='registration_modal' vs 'signup' and asserting
 *      the value lands in profiles.marketing_consent_source.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------- hoisted mocks ----------

vi.mock("server-only", () => ({}));

const tagAsRegisteredMock = vi.fn(async () => ({ success: true as const }));
vi.mock("@/lib/email/brevo-segments-sync", () => ({
  tagAsRegistered: tagAsRegisteredMock,
}));

// Profiles upsert spy
const profilesUpsertMock = vi.fn(async () => ({ data: null, error: null }));
const createUserMock = vi.fn(async () => ({
  data: { user: { id: "user-uuid-123", email: "x@x.com" } },
  error: null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    auth: { admin: { createUser: createUserMock } },
    from: (_table: string) => ({
      upsert: (payload: unknown, _opts: unknown) => {
        profilesUpsertMock(payload, _opts);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: {
      signInWithPassword: async () => ({ data: { user: {} }, error: null }),
    },
  }),
}));

vi.mock("@/lib/auth/session-enforcement", () => ({
  SESSION_COOKIE: "mioshy_session",
  SESSION_MAX_AGE: 60 * 60 * 24 * 30,
  createSession: async () => "fake-session-token",
  invalidateAllSessions: async () => {},
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (_k: string) => "test-agent",
  }),
  cookies: async () => ({
    set: () => {},
    delete: () => {},
  }),
}));

// ---------- import after mocks ----------

import { signupAction } from "@/app/actions/auth-actions";

// ---------- helpers ----------

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  tagAsRegisteredMock.mockClear();
  tagAsRegisteredMock.mockImplementation(async () => ({ success: true as const }));
  profilesUpsertMock.mockClear();
  createUserMock.mockClear();
  createUserMock.mockImplementation(async () => ({
    data: { user: { id: "user-uuid-123", email: "x@x.com" } },
    error: null,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ------------------------------------------------------------
// 1. consent=true → both Supabase + Brevo updated
// ------------------------------------------------------------

describe("signupAction with marketing_consent=true", () => {
  it("persists consent fields to profiles AND calls tagAsRegistered once", async () => {
    const fd = makeFormData({
      fullName: "Test User",
      email: "consent-true@example.com",
      phone: "+972500000000",
      password: "hunter22",
      marketing_consent: "true",
      preferred_language: "he",
      source: "signup",
    });

    const result = await signupAction(fd);
    expect(result.success).toBe(true);

    // profiles.upsert called with all consent fields set
    expect(profilesUpsertMock).toHaveBeenCalledTimes(1);
    const [payload] = profilesUpsertMock.mock.calls[0];
    expect(payload).toMatchObject({
      id: "user-uuid-123",
      full_name: "Test User",
      phone: "+972500000000",
      marketing_consent: true,
      marketing_consent_source: "signup",
      preferred_language: "he",
    });
    // marketing_consent_at is the current ISO date — just verify shape
    expect(typeof (payload as { marketing_consent_at: string }).marketing_consent_at).toBe(
      "string",
    );

    // tagAsRegistered called with right args
    expect(tagAsRegisteredMock).toHaveBeenCalledTimes(1);
    expect(tagAsRegisteredMock).toHaveBeenCalledWith(
      "consent-true@example.com",
      "user-uuid-123",
      "he",
    );
  });

  it("respects the registration_modal source value", async () => {
    const fd = makeFormData({
      fullName: "Modal User",
      email: "modal@example.com",
      phone: "",
      password: "hunter22",
      marketing_consent: "true",
      preferred_language: "en",
      source: "registration_modal",
    });

    const result = await signupAction(fd);
    expect(result.success).toBe(true);

    const [payload] = profilesUpsertMock.mock.calls[0];
    expect(payload).toMatchObject({
      marketing_consent: true,
      marketing_consent_source: "registration_modal",
      preferred_language: "en",
    });
    expect(tagAsRegisteredMock).toHaveBeenCalledWith(
      "modal@example.com",
      "user-uuid-123",
      "en",
    );
  });
});

// ------------------------------------------------------------
// 2. consent=false → Supabase only, no Brevo
// ------------------------------------------------------------

describe("signupAction with marketing_consent=false", () => {
  it("persists consent=false with null timestamp AND does NOT call tagAsRegistered", async () => {
    const fd = makeFormData({
      fullName: "No Consent",
      email: "no-consent@example.com",
      phone: "",
      password: "hunter22",
      marketing_consent: "false",
      preferred_language: "he",
      source: "signup",
    });

    const result = await signupAction(fd);
    expect(result.success).toBe(true);

    const [payload] = profilesUpsertMock.mock.calls[0];
    expect(payload).toMatchObject({
      marketing_consent: false,
      marketing_consent_at: null,
      marketing_consent_source: null,
      preferred_language: "he",
    });

    expect(tagAsRegisteredMock).not.toHaveBeenCalled();
  });

  it("defaults missing fields to consent=false / he / signup (backward compat)", async () => {
    const fd = makeFormData({
      fullName: "Legacy Caller",
      email: "legacy@example.com",
      phone: "",
      password: "hunter22",
      // intentionally omitting marketing_consent / preferred_language / source
    });

    const result = await signupAction(fd);
    expect(result.success).toBe(true);

    const [payload] = profilesUpsertMock.mock.calls[0];
    expect(payload).toMatchObject({
      marketing_consent: false,
      marketing_consent_at: null,
      preferred_language: "he",
    });
    expect(tagAsRegisteredMock).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------
// 3. Brevo failure must NOT fail the signup
// ------------------------------------------------------------

describe("signupAction Brevo resilience", () => {
  it("returns success=true even if tagAsRegistered throws", async () => {
    tagAsRegisteredMock.mockImplementationOnce(async () => {
      throw new Error("brevo down");
    });

    const fd = makeFormData({
      fullName: "Resilience Test",
      email: "resilience@example.com",
      phone: "",
      password: "hunter22",
      marketing_consent: "true",
      preferred_language: "he",
      source: "signup",
    });

    const result = await signupAction(fd);
    expect(result.success).toBe(true);
    expect(tagAsRegisteredMock).toHaveBeenCalledTimes(1);
    // Profile was still upserted with consent=true even though Brevo blew up.
    const [payload] = profilesUpsertMock.mock.calls[0];
    expect(payload).toMatchObject({ marketing_consent: true });
  });

  it("returns success=true even if tagAsRegistered returns success=false", async () => {
    tagAsRegisteredMock.mockImplementationOnce(async () => ({
      success: false as const,
      error: "brevo 500",
    }));

    const fd = makeFormData({
      fullName: "Soft Fail",
      email: "soft-fail@example.com",
      phone: "",
      password: "hunter22",
      marketing_consent: "true",
      preferred_language: "he",
      source: "signup",
    });

    const result = await signupAction(fd);
    expect(result.success).toBe(true);
  });
});

// ------------------------------------------------------------
// 4. Surface auth errors normally
// ------------------------------------------------------------

describe("signupAction validation + auth errors", () => {
  it("rejects an empty fullName", async () => {
    const fd = makeFormData({
      fullName: "",
      email: "a@a.com",
      phone: "",
      password: "hunter22",
    });
    const result = await signupAction(fd);
    expect(result.success).toBe(false);
    expect(profilesUpsertMock).not.toHaveBeenCalled();
    expect(tagAsRegisteredMock).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 6", async () => {
    const fd = makeFormData({
      fullName: "Short Pass",
      email: "a@a.com",
      phone: "",
      password: "12345",
    });
    const result = await signupAction(fd);
    expect(result.success).toBe(false);
    expect(tagAsRegisteredMock).not.toHaveBeenCalled();
  });

  it('surfaces "already registered" from Supabase', async () => {
    createUserMock.mockImplementationOnce(async () => ({
      data: { user: null as never },
      error: { message: "User already registered" } as never,
    }));

    const fd = makeFormData({
      fullName: "Dup",
      email: "dup@example.com",
      phone: "",
      password: "hunter22",
    });
    const result = await signupAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.toLowerCase()).toContain("already");
    }
    expect(tagAsRegisteredMock).not.toHaveBeenCalled();
  });
});
