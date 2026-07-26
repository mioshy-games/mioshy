import { describe, expect, it } from "vitest";
import { resolveLegacyRedirect } from "@/lib/seo/legacy-redirects";

describe("resolveLegacyRedirect", () => {
  it("maps each exact legacy URL to its target", () => {
    const cases: Array<[string, string]> = [
      ["/red-room-secrets/5-steamy-sex-positions", "/he/articles/best-sex-positions-for-couples"],
      ["/red-room-secrets/make-her-climax", "/he/articles/multiple-orgasms-for-her"],
      ["/red-room-secrets/womans-sexual-satisfaction", "/he/articles/what-women-do-during-sex"],
      ["/red-room-secrets/foot-fetishes", "/he/mioshy-sex"],
      ["/red-room-secrets/more-sex-in-marriage", "/he/articles/boost-sexual-desire-three-steps"],
      ["/sex-games", "/he/games"],
      ["/articles/top-10-exciting-sex-games", "/he/mioshy-sex"],
      ["/hot-nights", "/he/mioshy-sex"],
    ];
    for (const [from, to] of cases) {
      expect(resolveLegacyRedirect(from)).toBe(to);
    }
  });

  it("is trailing-slash and case agnostic", () => {
    expect(resolveLegacyRedirect("/sex-games/")).toBe("/he/games");
    expect(resolveLegacyRedirect("/HOT-NIGHTS")).toBe("/he/mioshy-sex");
    expect(resolveLegacyRedirect("/Red-Room-Secrets/Make-Her-Climax/")).toBe(
      "/he/articles/multiple-orgasms-for-her",
    );
  });

  it("collapses the prefix families", () => {
    expect(resolveLegacyRedirect("/red-room-secrets/anything-else")).toBe("/he/mioshy-sex");
    expect(resolveLegacyRedirect("/red-room-secrets")).toBe("/he/mioshy-sex");
    expect(resolveLegacyRedirect("/board-games/unstoppable")).toBe("/he/games");
    expect(resolveLegacyRedirect("/board-games")).toBe("/he/games");
  });

  it("sends any other unprefixed dead path to /he", () => {
    expect(resolveLegacyRedirect("/some-old-page")).toBe("/he");
    expect(resolveLegacyRedirect("/foo/bar/baz")).toBe("/he");
  });

  it("leaves live routes untouched (returns null)", () => {
    for (const p of [
      "/",
      "/he",
      "/en",
      "/he/games",
      "/en/articles/mishakei-zugot-online",
      "/he/pricing",
      "/admin/content",
      "/dashboard/whatsapp",
    ]) {
      expect(resolveLegacyRedirect(p)).toBeNull();
    }
  });
});
