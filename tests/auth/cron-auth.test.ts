/**
 * tests/auth/cron-auth.test.ts
 *
 * Audit 2026-08-05, H2 — the shared cron Bearer check.
 *
 * The two properties that matter:
 *   1. Scope isolation — the billing secret must not open a journey route, and
 *      vice versa. Before this helper, ten journey routes accepted the billing
 *      secret through their `||` cascade.
 *   2. Vercel compatibility — Vercel Cron sends `Bearer $CRON_SECRET`, so every
 *      scope must accept it or all seventeen scheduled jobs 401 on deploy.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isCronAuthorized } from "@/lib/auth/cron-auth";

const ENV_KEYS = [
  "CRON_SECRET",
  "JOURNEY_CRON_SECRET",
  "BILLING_CRON_SECRET",
  "VERCEL_ENV",
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const reqWith = (token: string | null) =>
  new Request("https://mioshy.com/api/journey/reminders", {
    headers: token === null ? {} : { authorization: `Bearer ${token}` },
  });

describe("scope isolation", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    process.env.JOURNEY_CRON_SECRET = "journey-value";
    process.env.BILLING_CRON_SECRET = "billing-value";
  });

  it("accepts each scope's own secret", () => {
    expect(isCronAuthorized(reqWith("journey-value"), "journey")).toBe(true);
    expect(isCronAuthorized(reqWith("billing-value"), "billing")).toBe(true);
  });

  it("refuses the journey secret on a billing route", () => {
    expect(isCronAuthorized(reqWith("journey-value"), "billing")).toBe(false);
  });

  it("refuses the billing secret on a journey route", () => {
    expect(isCronAuthorized(reqWith("billing-value"), "journey")).toBe(false);
  });
});

describe("Vercel's own cron token", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    process.env.CRON_SECRET = "vercel-value";
  });

  it("is accepted by both scopes — this is what Vercel actually sends", () => {
    expect(isCronAuthorized(reqWith("vercel-value"), "journey")).toBe(true);
    expect(isCronAuthorized(reqWith("vercel-value"), "billing")).toBe(true);
  });

  it("still refuses anything else", () => {
    expect(isCronAuthorized(reqWith("vercel-value-x"), "journey")).toBe(false);
    expect(isCronAuthorized(reqWith(""), "journey")).toBe(false);
    expect(isCronAuthorized(reqWith(null), "journey")).toBe(false);
  });

  it("accepts the dedicated secret alongside it", () => {
    process.env.JOURNEY_CRON_SECRET = "journey-value";
    expect(isCronAuthorized(reqWith("vercel-value"), "journey")).toBe(true);
    expect(isCronAuthorized(reqWith("journey-value"), "journey")).toBe(true);
  });
});

describe("token parsing", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
    process.env.JOURNEY_CRON_SECRET = "s3cret";
  });

  it("is case-insensitive on the Bearer prefix and tolerates padding", () => {
    const mk = (auth: string) =>
      new Request("https://mioshy.com/x", { headers: { authorization: auth } });
    expect(isCronAuthorized(mk("Bearer s3cret"), "journey")).toBe(true);
    expect(isCronAuthorized(mk("bearer s3cret"), "journey")).toBe(true);
    expect(isCronAuthorized(mk("Bearer   s3cret  "), "journey")).toBe(true);
  });

  it("rejects a prefix or extension of the real secret", () => {
    expect(isCronAuthorized(reqWith("s3cre"), "journey")).toBe(false);
    expect(isCronAuthorized(reqWith("s3cret2"), "journey")).toBe(false);
  });
});

describe("when nothing is configured", () => {
  it("fails closed in production", () => {
    process.env.VERCEL_ENV = "production";
    expect(isCronAuthorized(reqWith("anything"), "journey")).toBe(false);
    expect(isCronAuthorized(reqWith("anything"), "billing")).toBe(false);
  });

  it("stays open on local and preview so development needs no secrets", () => {
    process.env.VERCEL_ENV = "preview";
    expect(isCronAuthorized(reqWith("anything"), "journey")).toBe(true);
    delete process.env.VERCEL_ENV;
    expect(isCronAuthorized(reqWith(null), "journey")).toBe(true);
  });
});
