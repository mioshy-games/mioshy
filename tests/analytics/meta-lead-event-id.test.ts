/**
 * tests/analytics/meta-lead-event-id.test.ts
 *
 * Audit 2026-08-05, H7.
 *
 * The Lead event id used to be `lead.${email}` — the raw address, sent to Meta
 * as the eventID straight from the browser.
 *
 * Two things must hold, and the second one is the trap the work order warns
 * about: if the browser and the server derive the id differently, Meta stops
 * deduplicating and silently counts every lead twice. That was ALREADY
 * happening — the client passed the address exactly as typed, the server passed
 * `trim().toLowerCase()` — so any capitalised input produced two ids.
 */

import { describe, expect, it } from "vitest";
import {
  metaLeadEventId,
  normalizeEmailForEventId,
} from "@/lib/analytics/meta-event-id";
import { createHash } from "node:crypto";

/** What the SERVER-side CAPI helper does to an email before hashing it. */
const capiNormalize = (v: string) => v.trim().toLowerCase();

describe("the id carries no readable address", () => {
  it("is a lead-prefixed SHA-256, not the email", async () => {
    const id = await metaLeadEventId("Itzik@Uxellent.com");
    expect(id).not.toContain("Itzik");
    expect(id).not.toContain("uxellent.com");
    expect(id).not.toContain("@");
    expect(id).toMatch(/^lead\.[0-9a-f]{64}$/);
  });

  it("matches an independently computed SHA-256 of the normalised address", async () => {
    const email = "  Itzik@Uxellent.COM ";
    const expected = createHash("sha256")
      .update(capiNormalize(email))
      .digest("hex");
    expect(await metaLeadEventId(email)).toBe(`lead.${expected}`);
  });
});

describe("browser and server derive the SAME id", () => {
  // Both call sites now go through metaLeadEventId. These inputs are the ones
  // that used to diverge: the browser passed them verbatim, the server
  // lowercased and trimmed first.
  const VARIANTS = [
    "itzik@uxellent.com",
    "Itzik@Uxellent.com",
    "ITZIK@UXELLENT.COM",
    "  itzik@uxellent.com  ",
    "\titzik@uxellent.com\n",
  ];

  it("collapses every casing and padding variant to one id", async () => {
    const ids = new Set(await Promise.all(VARIANTS.map((v) => metaLeadEventId(v))));
    expect(ids.size).toBe(1);
  });

  it("uses exactly the CAPI normalisation, so the two layers cannot drift", async () => {
    for (const v of VARIANTS) {
      expect(normalizeEmailForEventId(v)).toBe(capiNormalize(v));
    }
  });

  it("still distinguishes genuinely different addresses", async () => {
    const a = await metaLeadEventId("a@example.com");
    const b = await metaLeadEventId("b@example.com");
    expect(a).not.toBe(b);
  });
});
