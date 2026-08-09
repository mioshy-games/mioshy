/**
 * tests/rate-limit-ip.test.ts
 *
 * Audit 2026-08-05, H3 — client IP derivation for rate limiting.
 *
 * getClientIp used to return the LEFTMOST X-Forwarded-For entry. Every proxy
 * APPENDS to that header, so the leftmost value is whatever the client sent.
 * One request carrying `X-Forwarded-For: 1.2.3.4` got a fresh bucket, and
 * rotating that header gave unlimited attempts against every rate-limited
 * route — including the Cardcom callback.
 *
 * The rightmost entry is the hop appended by our own edge, which is the only
 * one a client cannot forge.
 */

import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/rate-limit";

const reqWith = (headers: Record<string, string>) =>
  new Request("https://mioshy.com/api/billing/cardcom/indicator", { headers });

const EDGE = "203.0.113.9";
const SPOOFED = "1.2.3.4";

describe("a spoofed X-Forwarded-For cannot choose the bucket", () => {
  it("uses the rightmost entry — the hop our edge appended", () => {
    // What an attacker sends:            what the edge appends:
    //   X-Forwarded-For: 1.2.3.4    →      "1.2.3.4, 203.0.113.9"
    const ip = getClientIp(reqWith({ "x-forwarded-for": `${SPOOFED}, ${EDGE}` }));
    expect(ip).toBe(EDGE);
    expect(ip).not.toBe(SPOOFED);
  });

  it("is not fooled by a long forged chain", () => {
    const ip = getClientIp(
      reqWith({ "x-forwarded-for": `1.1.1.1, 2.2.2.2, 3.3.3.3, ${EDGE}` }),
    );
    expect(ip).toBe(EDGE);
  });

  it("gives the SAME bucket key however the attacker varies the header", () => {
    const a = getClientIp(reqWith({ "x-forwarded-for": `9.9.9.9, ${EDGE}` }));
    const b = getClientIp(reqWith({ "x-forwarded-for": `8.8.8.8, ${EDGE}` }));
    const c = getClientIp(reqWith({ "x-forwarded-for": `evil, ${EDGE}` }));
    expect(new Set([a, b, c]).size).toBe(1);
  });

  it("tolerates padding and empty entries", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": `  ${SPOOFED} ,  ${EDGE}  ` }))).toBe(EDGE);
    expect(getClientIp(reqWith({ "x-forwarded-for": `${EDGE},` }))).toBe(EDGE);
  });
});

describe("header precedence", () => {
  it("prefers cf-connecting-ip, which the client cannot set", () => {
    const ip = getClientIp(
      reqWith({
        "cf-connecting-ip": EDGE,
        "x-real-ip": "5.5.5.5",
        "x-forwarded-for": `${SPOOFED}, 6.6.6.6`,
      }),
    );
    expect(ip).toBe(EDGE);
  });

  it("falls back to x-real-ip before x-forwarded-for", () => {
    const ip = getClientIp(
      reqWith({ "x-real-ip": EDGE, "x-forwarded-for": `${SPOOFED}, 6.6.6.6` }),
    );
    expect(ip).toBe(EDGE);
  });

  it("returns 'unknown' when nothing identifies the caller", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
    expect(getClientIp(reqWith({ "x-forwarded-for": "  " }))).toBe("unknown");
  });

  it("handles a single-entry X-Forwarded-For", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": EDGE }))).toBe(EDGE);
  });
});
