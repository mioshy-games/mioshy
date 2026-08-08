/**
 * tests/observability/redact.test.ts
 *
 * Audit 2026-08-05, H5 — PII redaction for log output.
 *
 * Vercel keeps logs for a long time and more people can read them than can
 * read the database, so an identifier written here is a second copy of user
 * data under weaker access control. These tests pin both layers: identifying
 * keys are dropped outright, and free text is scrubbed for emails and phone
 * numbers so PII embedded in an error message does not slip through.
 */

import { describe, expect, it } from "vitest";
import { redactField, redactString, isDroppedKey } from "@/lib/observability/redact";

describe("identifying keys are dropped, not masked", () => {
  it("drops every field whose value is inherently identifying", () => {
    for (const key of [
      "email",
      "phone",
      "mobile",
      "to_address",
      "body",
      "answer",
      "text",
      "token",
      "password",
      "secret",
      "authorization",
    ]) {
      expect(isDroppedKey(key), key).toBe(true);
      expect(redactField(key, "anything"), key).toBeUndefined();
    }
  });

  it("is case-insensitive on the key", () => {
    expect(redactField("Email", "a@b.com")).toBeUndefined();
    expect(redactField("TO_ADDRESS", "a@b.com")).toBeUndefined();
  });

  it("keeps the fields that make a log line useful", () => {
    expect(redactField("user_id", "8f14e45f-ea6c-4b9a-9d1b-0c2f3a4b5c6d")).toBe(
      "8f14e45f-ea6c-4b9a-9d1b-0c2f3a4b5c6d",
    );
    expect(redactField("dur_ms", 42)).toBe(42);
    expect(redactField("ok", false)).toBe(false);
    expect(redactField("event", "chat.send.failed")).toBe("chat.send.failed");
  });

  it("does not drop a key that merely contains a sensitive word", () => {
    // `email_key` names a template; it is not an address.
    expect(isDroppedKey("email_key")).toBe(false);
    expect(isDroppedKey("has_phone")).toBe(false);
  });
});

describe("free text is scrubbed", () => {
  it("masks an email embedded in an error message", () => {
    expect(redactString("insert failed for itzik@uxellent.com (duplicate)")).toBe(
      "insert failed for [email] (duplicate)",
    );
  });

  it("masks several addresses in one string", () => {
    expect(redactString("a@b.com and c.d+tag@e-f.co.il")).toBe("[email] and [email]");
  });

  it("masks E.164 and local phone numbers", () => {
    expect(redactString("sending to +972501234567")).toBe("sending to [phone]");
    expect(redactString("mobile 0501234567 bounced")).toBe("mobile [phone] bounced");
  });

  it("leaves ordinary numbers alone", () => {
    // Durations, counts, amounts and prices must stay readable.
    expect(redactString("dur_ms 4231 rows 57 amount 69.00")).toBe(
      "dur_ms 4231 rows 57 amount 69.00",
    );
  });

  it("leaves a UUID intact — it is the identifier we log on purpose", () => {
    const uuid = "8f14e45f-ea6c-4b9a-9d1b-0c2f3a4b5c6d";
    expect(redactString(uuid)).toBe(uuid);
  });

  it("scrubs through a non-dropped key too", () => {
    expect(redactField("error", "no profile for itzik@uxellent.com")).toBe(
      "no profile for [email]",
    );
  });
});
