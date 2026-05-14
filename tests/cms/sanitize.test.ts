/**
 * Tests for lib/cms/sanitize.ts — the gate that runs on every CMS
 * Save. These guard against regressions of the bug Itzik hit on
 * 2026-05-13: clicking "Brand color" twice (producing
 * "<em>foo</em> bar <em>baz</em>") triggered a 500 because the
 * sanitiser was wedged somewhere in the saveCmsText pipeline.
 *
 * The local reproduction below passed cleanly — confirming the bug
 * was deeper in the action wrapper rather than in sanitize itself —
 * but locking these cases as a permanent contract anyway.
 */

import { describe, it, expect } from "vitest";
import {
  findDisallowedTags,
  sanitizeRichText,
} from "@/lib/cms/sanitize";

describe("findDisallowedTags", () => {
  it("returns [] for plain text", () => {
    expect(findDisallowedTags("Hello world")).toEqual([]);
  });

  it("returns [] for em / strong / br alone or combined", () => {
    expect(findDisallowedTags("<em>x</em>")).toEqual([]);
    expect(findDisallowedTags("<strong>x</strong>")).toEqual([]);
    expect(findDisallowedTags("line1<br />line2")).toEqual([]);
    expect(
      findDisallowedTags("<em>a</em> and <strong>b</strong> + <br />"),
    ).toEqual([]);
  });

  it("returns [] for two <em> tags on the same line — the bug case", () => {
    const buggy = "<em>זוגיות - רק</em> עם קצת יותר1 <em>פלפל</em>.";
    expect(findDisallowedTags(buggy)).toEqual([]);
  });

  it("returns [] for two <strong> tags on the same line", () => {
    expect(
      findDisallowedTags("<strong>a</strong> and <strong>b</strong>"),
    ).toEqual([]);
  });

  it("flags <script>", () => {
    expect(findDisallowedTags("<script>alert(1)</script>")).toContain(
      "script",
    );
  });

  it("flags <iframe>, <img>, <link>", () => {
    const dirty = "x<iframe src=\"…\"></iframe>y<img>z<link>";
    const found = findDisallowedTags(dirty);
    expect(found).toContain("iframe");
    expect(found).toContain("img");
    expect(found).toContain("link");
  });

  it("is case-insensitive", () => {
    expect(findDisallowedTags("<SCRIPT>x</SCRIPT>")).toContain("script");
    expect(findDisallowedTags("<EM>x</EM>")).toEqual([]);
  });
});

describe("sanitizeRichText", () => {
  it("passes through clean text unchanged", () => {
    const r = sanitizeRichText("Hello <em>world</em>");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.html).toBe("Hello <em>world</em>");
  });

  it("handles 2 <em> tags on the same line — the bug case", () => {
    const buggy = "<em>זוגיות - רק</em> עם קצת יותר1 <em>פלפל</em>.";
    const r = sanitizeRichText(buggy);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.html).toBe(buggy);
  });

  it("handles 2 <em> + 2 <strong> mixed", () => {
    const input =
      "<em>a</em> <strong>b</strong> <em>c</em> <strong>d</strong>";
    const r = sanitizeRichText(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.html).toBe(input);
  });

  it("rejects <script>", () => {
    const r = sanitizeRichText("<script>alert(1)</script>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.disallowed).toContain("script");
  });

  it("rejects mixed: allowed + <iframe>", () => {
    const r = sanitizeRichText("<em>x</em><iframe></iframe>");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.disallowed).toContain("iframe");
  });

  it("strips attributes even on allowed tags (defense in depth)", () => {
    const r = sanitizeRichText('<em style="color:red" onclick="bad()">x</em>');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.html).not.toContain("style");
      expect(r.html).not.toContain("onclick");
      expect(r.html).toBe("<em>x</em>");
    }
  });

  it("treats empty / null input as ok with empty html", () => {
    const r = sanitizeRichText("");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.html).toBe("");
  });
});
