/**
 * Tests for the per-priority "focus month" copy on the analysis
 * summary screen. This copy was approved by Itzik 2026-05-05 and the
 * tone (professional + urgency-results) is locked. These tests guard
 * against accidental copy drops when someone edits the file later.
 */

import { describe, it, expect } from "vitest";
import {
  getFocusMonthCopy,
  isPriorityKey,
} from "@/lib/journey/focus-month-copy";

const PRIORITIES = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
] as const;

describe("focus month copy", () => {
  it("returns null for an unknown priority", () => {
    expect(getFocusMonthCopy(null, "he")).toBeNull();
    expect(getFocusMonthCopy(undefined, "he")).toBeNull();
  });

  it("returns Hebrew + English content for every priority", () => {
    for (const priority of PRIORITIES) {
      const he = getFocusMonthCopy(priority, "he");
      const en = getFocusMonthCopy(priority, "en");
      expect(he, `${priority} HE copy missing`).not.toBeNull();
      expect(en, `${priority} EN copy missing`).not.toBeNull();
      // All three sections are populated - the card looks broken if any
      // of these are empty, so the test doubles as a content guard.
      expect(he!.reflection.length).toBeGreaterThan(20);
      expect(he!.plan.length).toBeGreaterThan(20);
      expect(he!.close.length).toBeGreaterThan(10);
      expect(en!.reflection.length).toBeGreaterThan(20);
      expect(en!.plan.length).toBeGreaterThan(20);
      expect(en!.close.length).toBeGreaterThan(10);
    }
  });

  it("Hebrew copy reflects the user's choice with 'בחרתם' framing", () => {
    // Per the approved tone (CBT reflection): every Hebrew reflection
    // sentence opens with "בחרתם ב..." to mirror the user's pick back.
    for (const priority of PRIORITIES) {
      const copy = getFocusMonthCopy(priority, "he");
      expect(copy!.reflection.startsWith("בחרתם"), `${priority} HE reflection should start with בחרתם`).toBe(true);
    }
  });

  it("isPriorityKey rejects unknown slugs", () => {
    expect(isPriorityKey("communication")).toBe(true);
    expect(isPriorityKey("not_a_real_key")).toBe(false);
    expect(isPriorityKey(null)).toBe(false);
    expect(isPriorityKey(undefined)).toBe(false);
    expect(isPriorityKey("")).toBe(false);
  });

  it("isPriorityKey accepts every PRIORITIES slug", () => {
    for (const priority of PRIORITIES) {
      expect(isPriorityKey(priority)).toBe(true);
    }
  });
});
