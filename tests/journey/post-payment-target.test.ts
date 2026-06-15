/**
 * F3.2 point 2 — post-purchase redirect target.
 * Journey buyers continue into the assessment; everyone else → /my.
 */
import { describe, it, expect } from "vitest";
import { postPaymentTarget } from "@/lib/billing/post-payment-target";

describe("postPaymentTarget", () => {
  it("journey buyer → /journey/assessment (continue full immediately)", () => {
    expect(postPaymentTarget("journey", "he")).toBe("/he/journey/assessment");
    expect(postPaymentTarget("journey", "en")).toBe("/en/journey/assessment");
  });
  it("games buyer → /my (unchanged)", () => {
    expect(postPaymentTarget("games", "he")).toBe("/he/my");
  });
  it("adults buyer → /my (unchanged)", () => {
    expect(postPaymentTarget("adults", "en")).toBe("/en/my");
  });
  it("unknown/null product → /my (safe default)", () => {
    expect(postPaymentTarget(null, "he")).toBe("/he/my");
  });
});
