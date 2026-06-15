import { describe, it, expect, afterEach } from "vitest";
import { buildFallbackHero } from "@/lib/journey/hero-fallback";
import { analyzeAssessment } from "@/lib/ai/analyze-assessment";
import type { Analysis, Response } from "@/lib/journey/types";

const NOW = "2026-06-14T12:00:00.000Z";

function resp(question_id: string, text: string): Response {
  return { question_id, answer: { kind: "text", text }, locale: "he" };
}

describe("buildFallbackHero", () => {
  it("uses the lowest-category template (intimacy) for hero + 3 recs", () => {
    const hero = buildFallbackHero("intimacy", [], NOW);
    expect(hero.model).toBe("fallback-template");
    expect(hero.hero_he).toContain("אינטימיות");
    expect(hero.recommendations_he).toHaveLength(3);
    expect(hero.recommendations_en).toHaveLength(3);
    expect(hero.expert_mentioned).toBe(false);
    expect(hero.generated_at).toBe(NOW);
  });

  it("defaults to communication when lowest_key is missing", () => {
    const hero = buildFallbackHero(null, [], NOW);
    expect(hero.hero_he).toBe(buildFallbackHero("communication", [], NOW).hero_he);
  });

  it("ECHOES a real reflection VERBATIM with the neutral bridge", () => {
    const real = "הכאב הוא חוסר קירבה ואינטימיות";
    const hero = buildFallbackHero("intimacy", [resp("q20c_what_hurts", real)], NOW);
    expect(hero.reflection_echo_he).toBe(`כתבתם: “${real}”. נתחיל בדיוק משם.`);
    expect(hero.reflection_echo_en).toContain(real); // quote stays in source language
    expect(hero.reflection_echo_en).toContain("You wrote:");
  });

  it("prefers q20c over q22a for the echo", () => {
    const hero = buildFallbackHero(
      "intimacy",
      [resp("q20c_what_hurts", "אין בינינו קרבה כבר חודשים"), resp("q22a_success_signal", "יותר כיף ביחד שלנו")],
      NOW,
    );
    expect(hero.reflection_echo_he).toContain("אין בינינו קרבה");
  });

  it("falls back to q22a when q20c is empty/garbage", () => {
    const hero = buildFallbackHero(
      "intimacy",
      [resp("q20c_what_hurts", "bcnvbnvbn"), resp("q22a_success_signal", "שנחזור לחפש אחד את השני")],
      NOW,
    );
    expect(hero.reflection_echo_he).toContain("שנחזור לחפש");
  });

  it("SUPPRESSES the echo for garbage / too-short / empty (quality gate)", () => {
    for (const junk of ["bcnvbnvbn", "שדגשדג", "סהה", "", "   "]) {
      const hero = buildFallbackHero("intimacy", [resp("q20c_what_hurts", junk)], NOW);
      expect(hero.reflection_echo_he, `junk=${JSON.stringify(junk)}`).toBeNull();
      expect(hero.reflection_echo_en).toBeNull();
    }
  });

  it("truncates an overly long reflection with an ellipsis", () => {
    const long = "א".repeat(300) + " סוף";
    const hero = buildFallbackHero("intimacy", [resp("q20c_what_hurts", long)], NOW);
    expect(hero.reflection_echo_he).toContain("…");
    expect(hero.reflection_echo_he!.length).toBeLessThan(220);
  });
});

describe("analyzeAssessment (no key → forced failure)", () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prev;
  });

  it("returns ok:false reason:no_key with 0 attempts when the key is absent", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const analysis = { summary: {} } as unknown as Analysis;
    const res = await analyzeAssessment({ analysis, responses: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("no_key");
      expect(res.attempts).toBe(0);
    }
  });
});
