import { describe, it, expect } from "vitest";
import { stripEmDash } from "@/lib/text/sanitize-dashes";

describe("stripEmDash", () => {
  it("spaced em-dash → spaced minus", () => {
    expect(stripEmDash("א — ב")).toBe("א - ב");
  });

  it("tight em-dash → spaced minus", () => {
    expect(stripEmDash("א—ב")).toBe("א - ב");
  });

  it("horizontal bar (U+2015) is also normalised", () => {
    expect(stripEmDash("a ― b")).toBe("a - b");
    expect(stripEmDash("a―b")).toBe("a - b");
  });

  it("en-dash numeric ranges are left untouched", () => {
    expect(stripEmDash("₪400–600")).toBe("₪400–600");
    expect(stripEmDash("8–15 שנים")).toBe("8–15 שנים");
  });

  it("idempotent — running again is a no-op", () => {
    const once = stripEmDash("א—ב — ג");
    expect(stripEmDash(once)).toBe(once);
  });

  it("does not break HTML tags (only touches the dash char)", () => {
    expect(stripEmDash("<strong>א</strong>—<em>ב</em>")).toBe(
      "<strong>א</strong> - <em>ב</em>",
    );
  });

  it("empty / falsy input returns as-is", () => {
    expect(stripEmDash("")).toBe("");
  });

  it("plain minus and regular text are unchanged", () => {
    expect(stripEmDash("already - fine")).toBe("already - fine");
    expect(stripEmDash("no dashes here")).toBe("no dashes here");
  });
});
