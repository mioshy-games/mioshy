/**
 * Tests for the questionnaire bank shape.
 *
 * What this guards against:
 *  - Someone editing journey/questionnaire.json and breaking the
 *    32-question / per-domain distribution that JourneyClient + the
 *    analysis layer assume.
 *  - The auth/paywall gating indices drifting out of range.
 *  - Question IDs becoming non-unique.
 *  - Locale labels going missing.
 *
 * The build-time assertion inside lib/journey/questions.ts already
 * throws on a domain mismatch, but importing that module in a test
 * surfaces the throw as a failed test (with a useful diff) rather
 * than as an opaque "module init error".
 */

import { describe, it, expect } from "vitest";
import {
  QUESTIONS,
  QUESTIONNAIRE,
  totalQuestions,
  getDomainCount,
} from "@/lib/journey/questions";

describe("questionnaire bank", () => {
  it("has exactly 32 questions (post love-language removal)", () => {
    expect(totalQuestions()).toBe(32);
    expect(QUESTIONS.length).toBe(32);
    expect(QUESTIONNAIRE.total_questions).toBe(32);
  });

  it("has unique question ids", () => {
    const ids = QUESTIONS.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("auth gate is set after q27 and before q_priorities (idx 30)", () => {
    // Itzik's spec: auth happens AFTER all the diagnostic questions
    // (q27 at idx 30) and BEFORE the priority ranking (idx 31). If
    // someone reorders the bank, this catches the gating drift.
    expect(QUESTIONNAIRE.gating.auth_after_index).toBe(30);
    expect(QUESTIONS[30]?.id).toBe("q27_commitment_willingness");
    expect(QUESTIONS[31]?.id).toBe("q_priorities");
  });

  it("paywall gate is effectively disabled (>= total)", () => {
    expect(QUESTIONNAIRE.gating.paywall_after_index).toBeGreaterThanOrEqual(
      QUESTIONS.length,
    );
  });

  it("matches the locked domain distribution (7-3-3-5-7 + 7 null)", () => {
    const counts = getDomainCount();
    expect(counts).toEqual({
      communication: 7,
      intimacy: 3,
      emotional_connection: 3,
      friendship: 5,
      family: 7,
    });
    const nullCount = QUESTIONS.filter((q) => q.domain === null).length;
    expect(nullCount).toBe(7);
  });

  it("the dropped love-language pairs are GONE", () => {
    const dropped = ["q04_love_language_pair_a", "q05_love_language_pair_b", "q06_love_language_pair_c"];
    for (const id of dropped) {
      expect(QUESTIONS.find((q) => q.id === id)).toBeUndefined();
    }
  });

  it("priority ranking question is the last item", () => {
    const last = QUESTIONS[QUESTIONS.length - 1];
    expect(last?.id).toBe("q_priorities");
    expect(last?.type).toBe("ranking");
  });

  it("all 5 priority ranking categories are present", () => {
    const ranking = QUESTIONS.find((q) => q.id === "q_priorities");
    expect(ranking).toBeDefined();
    if (ranking?.type !== "ranking") {
      throw new Error("q_priorities is not a ranking question");
    }
    const keys = ranking.categories.map((c) => c.key).sort();
    expect(keys).toEqual([
      "communication",
      "emotional_connection",
      "family",
      "friendship",
      "intimacy",
    ]);
  });

  it("Hebrew + English Likert labels are both 5-element arrays", () => {
    expect(QUESTIONNAIRE.likert_labels.he).toHaveLength(5);
    expect(QUESTIONNAIRE.likert_labels.en).toHaveLength(5);
  });

  it("every question has a non-empty Hebrew prompt", () => {
    for (const q of QUESTIONS) {
      const prompt = q.type === "likert5" ? q.he : q.he_prompt;
      expect(prompt, `question ${q.id} has empty HE prompt`).toBeTruthy();
      expect(prompt.length, `question ${q.id} HE prompt too short`).toBeGreaterThan(3);
    }
  });
});
