/**
 * Task 14 — category-score sanity matrix (locks lib/journey/analysis.ts).
 *
 * Precedent: an all-1s→100 family bug (independent assessment, fixed 2026-06-24).
 * This locks the CURRENT short-flow category math against silent regressions,
 * for known answer patterns, using the live short question set.
 *
 * Concrete case from Preview review (2026-07-02): all-1s on the SHORT assessment
 * returns communication=50 and emotional_connection=0 (NOT 44). The 50 is the
 * documented reverse-coded artifact — with equal answers the contempt item
 * (inverted) and the repair item move oppositely, averaging 0.5 → 50; it is
 * correct, not a bug. Real users never answer all-same, so this only surfaces in
 * synthetic tests. emotional_connection is 0 for pure all-1s (fondness +
 * love_map both at 0); any "44" seen in a session came from mixed/partial
 * answers, not this deterministic path.
 */

import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/journey/analysis";
import type { PriorityKey } from "@/lib/journey/priorities";
import type { PriorityLabelsBundle } from "@/lib/journey-content/priority-categories";
import type { Response } from "@/lib/journey/types";

const KEYS: PriorityKey[] = [
  "communication", "intimacy", "emotional_connection", "friendship", "family",
];
const rec = (s: string) =>
  Object.fromEntries(KEYS.map((k) => [k, `${k}_${s}`])) as Record<PriorityKey, string>;
const PRIORITY_LABELS: PriorityLabelsBundle = {
  labelsHe: rec("he"), labelsEn: rec("en"), descsHe: rec("dh"), descsEn: rec("de"),
  canonicalOrder: KEYS,
};

// Live SHORT likert set (journey_questions phase='short', is_active, 2026-07-02).
// If the admin changes the short set, THIS TEST SHOULD FAIL — forcing a
// re-verification of the entry copy count + these expected scores (anti-drift).
const SHORT_LIKERT_SLUGS = [
  "q01_knowledge_world",        // love_map +1
  "q02_admiration_see_good",    // fondness +1
  "q09_repair_recovery",        // repair +1
  "q11_contempt",               // four_horsemen_contempt +1 (inverted for health)
  "q15_anticipation",           // passion_anticipation +1
  "q17_context_logistics",      // passion_context -1 (reverse)
  "q19_rituals",                // shared_meaning +0.5
  "q_family_quality_presence",  // passion_context +1
  "q24_physical_closeness",     // love_language_touch +0.5, passion_play +0.5
  "q20b_intimacy_satisfaction", // direct intimacy signal (no axes)
];

const allAt = (value: 1 | 2 | 3 | 4 | 5): Response[] =>
  SHORT_LIKERT_SLUGS.map((slug) => ({ question_id: slug, answer: { kind: "likert", value } }));

describe("task 14 — category sanity matrix (short flow)", () => {
  it("all-1s → exact category scores (comm 50 artifact, family NOT 100)", () => {
    const cs = analyze(allAt(1), PRIORITY_LABELS).summary.category_scores!;
    expect(cs.communication).toBe(50);
    expect(cs.emotional_connection).toBe(0);
    expect(cs.intimacy).toBe(0);
    expect(cs.friendship).toBe(0);
    expect(cs.family).toBe(25);
    expect(cs.family).not.toBe(100); // the 2026-06-24 precedent bug
    expect(cs.insufficient_keys ?? []).toEqual([]);
    expect(cs.lowest_key).toBe("intimacy");
  });

  it("all-5s → exact category scores (comm still 50 artifact)", () => {
    const cs = analyze(allAt(5), PRIORITY_LABELS).summary.category_scores!;
    expect(cs.communication).toBe(50);
    expect(cs.emotional_connection).toBe(100);
    expect(cs.intimacy).toBe(100);
    expect(cs.friendship).toBe(100);
    expect(cs.family).toBe(75);
    expect(cs.lowest_key).toBe("communication");
  });

  it("mixed known profile → inversion works (healthy repair + no contempt → comm 100)", () => {
    // repair=5 (healthy) AND contempt=1 (no contempt → inverted to healthy) → 100,
    // distinguishing real signal from the all-same 50 artifact.
    const responses: Response[] = [
      { question_id: "q09_repair_recovery", answer: { kind: "likert", value: 5 } },
      { question_id: "q11_contempt", answer: { kind: "likert", value: 1 } },
      { question_id: "q01_knowledge_world", answer: { kind: "likert", value: 5 } },
      { question_id: "q02_admiration_see_good", answer: { kind: "likert", value: 5 } },
    ];
    const cs = analyze(responses, PRIORITY_LABELS).summary.category_scores!;
    expect(cs.communication).toBe(100);
    expect(cs.emotional_connection).toBe(100);
  });
});
