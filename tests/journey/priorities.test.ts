/**
 * Tests for the priority validators that gate the ranking step's
 * answer payload — both client-side (PriorityRankingStep submits)
 * and server-side (api/journey/answer accepts).
 *
 * If isValidOrder ever silently accepts something it shouldn't, the
 * server's answer validator stops protecting the JSONB column from
 * malformed data — so this is one of the two highest-leverage things
 * to test in the journey module.
 */

import { describe, it, expect } from "vitest";
import { isValidOrder, isPriorityKey } from "@/lib/journey/priorities";

const ALL_KEYS = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
] as const;

describe("isValidOrder", () => {
  it("accepts a full permutation in the canonical order", () => {
    expect(isValidOrder([...ALL_KEYS])).toBe(true);
  });

  it("accepts a full permutation in reverse order", () => {
    expect(isValidOrder([...ALL_KEYS].reverse())).toBe(true);
  });

  it("rejects an array missing a key", () => {
    const partial = ALL_KEYS.slice(0, 4);
    expect(isValidOrder(partial)).toBe(false);
  });

  it("rejects an array with a duplicate key", () => {
    const dup = ["communication", "communication", "intimacy", "friendship", "family"];
    expect(isValidOrder(dup)).toBe(false);
  });

  it("rejects an array with an unknown key", () => {
    const bad = ["communication", "intimacy", "emotional_connection", "friendship", "money"];
    expect(isValidOrder(bad)).toBe(false);
  });

  it("rejects non-array inputs", () => {
    expect(isValidOrder(null)).toBe(false);
    expect(isValidOrder(undefined)).toBe(false);
    expect(isValidOrder("communication")).toBe(false);
    expect(isValidOrder({})).toBe(false);
    expect(isValidOrder(42)).toBe(false);
  });

  it("rejects an array with non-string entries", () => {
    expect(isValidOrder([1, 2, 3, 4, 5])).toBe(false);
    expect(isValidOrder([null, null, null, null, null])).toBe(false);
  });

  it("rejects an array of the wrong length", () => {
    expect(isValidOrder([])).toBe(false);
    expect(isValidOrder(["communication"])).toBe(false);
    expect(isValidOrder([...ALL_KEYS, "communication"])).toBe(false);
  });
});

describe("isPriorityKey", () => {
  it("accepts each canonical key", () => {
    for (const k of ALL_KEYS) {
      expect(isPriorityKey(k)).toBe(true);
    }
  });

  it("rejects strings that aren't keys", () => {
    expect(isPriorityKey("money")).toBe(false);
    expect(isPriorityKey("Communication")).toBe(false); // case-sensitive
    expect(isPriorityKey("")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isPriorityKey(null)).toBe(false);
    expect(isPriorityKey(undefined)).toBe(false);
    expect(isPriorityKey(42)).toBe(false);
    expect(isPriorityKey({})).toBe(false);
  });
});
