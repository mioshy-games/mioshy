/**
 * tests/auth/full-name-validation.test.ts
 *
 * Audit 2026-08-05, CRITICAL #5 — layer 3 of the stored-XSS fix.
 *
 * `full_name` was stored straight from signup, concatenated into HTML by the
 * daily reminders cron, and rendered into the admin dashboard with
 * dangerouslySetInnerHTML. `fullNameSchema` is the input gate.
 *
 * The regex must be strict about markup and generous about real names — a
 * rejected Hebrew name is a broken signup funnel, which is worse than the bug.
 */

import { describe, expect, it } from "vitest";
import { fullNameSchema } from "@/lib/validations";

const accepts = (s: string) => fullNameSchema.safeParse(s).success;

describe("markup can never enter full_name", () => {
  it("rejects the audit's payload", () => {
    expect(accepts(`<img src=x onerror="alert(1)">`)).toBe(false);
  });

  it("rejects every angle-bracket and quote variant", () => {
    for (const payload of [
      `<script>alert(1)</script>`,
      `<br>`,
      `Itzik<br>admin`,
      `"onmouseover="alert(1)`,
      `'; DROP TABLE profiles; --`,
      `<svg/onload=alert(1)>`,
      `name&amp;`,
    ]) {
      expect(accepts(payload), `should reject: ${payload}`).toBe(false);
    }
  });

  it("rejects empty / whitespace-only names", () => {
    expect(accepts("")).toBe(false);
    expect(accepts("   ")).toBe(false);
  });

  it("rejects a name past the length cap", () => {
    expect(accepts("א".repeat(81))).toBe(false);
    expect(accepts("א".repeat(80))).toBe(true);
  });
});

describe("real names still pass", () => {
  it("accepts the Hebrew name from the work order", () => {
    expect(accepts("יצחק בר-לב")).toBe(true);
  });

  it("accepts ordinary names across scripts and punctuation", () => {
    for (const name of [
      "ישראל ישראלי",
      "O'Brien",
      "Jean-Luc Picard",
      "Anne-Marie St. John",
      "Николай",
      "محمد",
      "José Álvarez",
    ]) {
      expect(accepts(name), `should accept: ${name}`).toBe(true);
    }
  });

  it("trims surrounding whitespace rather than rejecting it", () => {
    const parsed = fullNameSchema.safeParse("  יצחק בר-לב  ");
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toBe("יצחק בר-לב");
  });
});
