/**
 * feat/journey-short-coverage — guards the 14-question short set + the family
 * scoring fix + the non-duplication of the promoted questions.
 *
 * 1. Family scoring: answering "1" everywhere must NOT yield family=100. With
 *    the new positive passion_context item (q_family_quality_presence) balancing
 *    q17's reverse item, plus the promoted shared_meaning item (q19), family
 *    lands low-medium and every category has ≥2 covered axes (no insufficient).
 * 2. Non-duplication: q19_rituals / q11_contempt exist as ONE question each in
 *    the bank, and resolveJourneyFlow("full") never re-serves a question the
 *    user already answered (answer-driven `remaining`).
 */

import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/journey/analysis";
import { QUESTIONS } from "@/lib/journey/questions";
import { resolveJourneyFlow } from "@/lib/journey/phase";
import type { JourneyQuestionRow } from "@/lib/journey/questions-db";
import type { PriorityKey } from "@/lib/journey/priorities";
import type { PriorityLabelsBundle } from "@/lib/journey-content/priority-categories";
import type { Response } from "@/lib/journey/types";

const KEYS: PriorityKey[] = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
];
const rec = (s: string) =>
  Object.fromEntries(KEYS.map((k) => [k, `${k}_${s}`])) as Record<PriorityKey, string>;
const PRIORITY_LABELS: PriorityLabelsBundle = {
  labelsHe: rec("he"),
  labelsEn: rec("en"),
  descsHe: rec("dh"),
  descsEn: rec("de"),
  canonicalOrder: KEYS,
};

// The 14-question short set after migration 144 (likert items carry the axes;
// q20b is the direct intimacy signal). All resolve from questionnaire.json,
// which now contains q_family_quality_presence, q11_contempt and q19_rituals.
const SHORT_LIKERT_SLUGS = [
  "q01_knowledge_world",
  "q02_admiration_see_good",
  "q03_bids_turn_toward",
  "q09_repair_recovery",
  "q11_contempt", // promoted → short
  "q15_anticipation",
  "q16_play",
  "q17_context_logistics", // reverse passion_context
  "q_family_quality_presence", // NEW positive passion_context
  "q19_rituals", // promoted → short (shared_meaning)
  "q24_physical_closeness",
  "q20b_intimacy_satisfaction",
];

describe("short-coverage — family scoring fix", () => {
  it("the new family item exists in the question bank", () => {
    expect(QUESTIONS.some((q) => q.id === "q_family_quality_presence")).toBe(true);
  });

  it('answering "1" on every short item → family is low-medium, NOT 100', () => {
    const responses: Response[] = SHORT_LIKERT_SLUGS.map((slug) => ({
      question_id: slug,
      answer: { kind: "likert", value: 1 },
    }));

    const a = analyze(responses, PRIORITY_LABELS); // default getQuestion resolver
    const cs = a.summary.category_scores!;

    // The bug was family=100 (single reverse item inverted). Now low-medium.
    expect(cs.family).toBeLessThanOrEqual(45);
    expect(cs.family).toBeGreaterThan(0);
    expect(cs.family).not.toBe(100);

    // Every category has ≥2 covered axes in the new short set → nothing flagged.
    expect(cs.insufficient_keys ?? []).toEqual([]);

    // lowest_key must be a real, sufficiently-covered category.
    expect(KEYS).toContain(cs.lowest_key);
  });

  it("safety net flags a category with a single reverse-only signal", () => {
    // Only q17 (reverse passion_context) answered → family rests on one signal.
    const responses: Response[] = [
      { question_id: "q17_context_logistics", answer: { kind: "likert", value: 1 } },
      { question_id: "q01_knowledge_world", answer: { kind: "likert", value: 3 } },
    ];
    const a = analyze(responses, PRIORITY_LABELS);
    const cs = a.summary.category_scores!;
    expect(cs.insufficient_keys ?? []).toContain("family");
    // …and the misleading family score is never the headline starting point.
    expect(cs.lowest_key).not.toBe("family");
  });
});

// ── Non-duplication ──────────────────────────────────────────────────────────
function rowFor(slug: string, position: number, phase: "short" | "full"): JourneyQuestionRow {
  return {
    slug, position, phase, type: "likert5", domain: null, axes: [], reverse: false,
    he_text: slug, en_text: slug, options: null, meta: null, is_active: true,
  };
}

// Post-144 phases: q11/q19 are SHORT, plus a couple of genuinely-full items.
const ALL_ROWS: JourneyQuestionRow[] = [
  rowFor("q01_knowledge_world", 0, "short"),
  rowFor("q11_contempt", 11, "short"),
  rowFor("q19_rituals", 18, "short"),
  rowFor("q_family_quality_presence", 19, "short"),
  rowFor("q12_defensive", 12, "full"),
  rowFor("q14_autonomy", 14, "full"),
];
const SHORT_ROWS = ALL_ROWS.filter((r) => r.phase === "short");

function mockClient(all: JourneyQuestionRow[], short: JourneyQuestionRow[]) {
  return {
    from() {
      let phaseFilter: string | null = null;
      const builder: Record<string, unknown> = {
        select() { return builder; },
        eq(col: string, val: unknown) { if (col === "phase") phaseFilter = String(val); return builder; },
        order() {
          const rows = phaseFilter ? short.filter((r) => r.phase === phaseFilter) : all;
          return Promise.resolve({ data: rows, error: null });
        },
      };
      return builder;
    },
  } as never;
}

describe("short-coverage — non-duplication of promoted questions", () => {
  it("q11_contempt and q19_rituals each appear exactly once in the bank", () => {
    for (const slug of ["q11_contempt", "q19_rituals"]) {
      expect(QUESTIONS.filter((q) => q.id === slug).length).toBe(1);
      expect(ALL_ROWS.filter((r) => r.slug === slug).length).toBe(1);
    }
  });

  it('full mode does NOT re-serve q19/q11 once answered (answer-driven remaining)', async () => {
    const answered = new Set(["q11_contempt", "q19_rituals", "q01_knowledge_world"]);
    const flow = await resolveJourneyFlow({
      client: mockClient(ALL_ROWS, SHORT_ROWS),
      subscriptionActive: true, // full mode = short ∪ full
      answeredSlugs: answered,
    });
    expect(flow.mode).toBe("full");
    const remainingSlugs = flow.remaining.map((q) => q.id);
    expect(remainingSlugs).not.toContain("q11_contempt");
    expect(remainingSlugs).not.toContain("q19_rituals");
    // unanswered full items still surface.
    expect(remainingSlugs).toContain("q12_defensive");
  });
});
