/**
 * tests/marketing/mid-action-paths.test.ts
 *
 * The offer popup must never interrupt a user who is part-way through
 * something, and must still be allowed on browse/marketing pages.
 *
 * The trap this locks down: matching used to be `path.includes(prefix)`, and
 * "/games" (the marketing catalogue) contains "/game" (the play surface).
 * A naive prefix list would silently delete a legitimate placement.
 */

import { describe, expect, it } from "vitest";
import { isMidActionPath, stripLocalePrefix } from "@/lib/marketing/assessment-offer";

describe("mid-action surfaces are blocked", () => {
  it.each([
    "/he/survey",
    "/en/survey",
    "/he/my/survey",
    "/he/journey/assessment",
    "/he/journey/assessment/intro",
    "/he/couples-assessment",
    "/he/assessments/abc-123",
    "/he/game",
    "/he/game/ABCD12",
    "/he/game/local",
    "/he/sex-game",
    "/he/between-us",
    "/he/marathon",
    "/he/billing/success",
    "/he/pricing",
    "/he/paywall",
    "/he/auth",
    "/he/dashboard",
    "/he/admin",
  ])("blocks %s", (path) => {
    expect(isMidActionPath(path)).toBe(true);
  });
});

describe("browse and marketing surfaces stay eligible", () => {
  it.each([
    "/he",
    "/he/games",           // the catalogue — must NOT be caught by "/game"
    "/he/games/truth-or-dare",
    "/he/journey",         // journey marketing, not the assessment
    "/he/mioshy-sex",      // adults marketing (2-min-browse handled separately)
    "/he/articles/some-post",
    "/he/relationship-survey", // survey MARKETING page, not the survey itself
    "/he/about",
  ])("allows %s", (path) => {
    expect(isMidActionPath(path)).toBe(false);
  });
});

describe("locale prefix handling", () => {
  it("strips he/en and leaves everything else alone", () => {
    expect(stripLocalePrefix("/he/survey")).toBe("/survey");
    expect(stripLocalePrefix("/en/survey")).toBe("/survey");
    expect(stripLocalePrefix("/survey")).toBe("/survey");
    expect(stripLocalePrefix("/he")).toBe("/");
    // Not a locale segment — must not be eaten.
    expect(stripLocalePrefix("/health/check")).toBe("/health/check");
  });

  it("blocks unprefixed paths too", () => {
    expect(isMidActionPath("/survey")).toBe(true);
    expect(isMidActionPath("/games")).toBe(false);
  });
});
