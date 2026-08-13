/**
 * THE GATE for migrations 195-198.
 *
 * Seven journey questions were rewritten in July 2026 while their scoring axes
 * kept pointing at the old meaning. The fix resolves each answer's axis by the
 * answer's own timestamp. The risk in a fix like that is not that it fails to
 * change anything — it is that it changes MORE than it should, quietly
 * re-scoring answers that were always correct.
 *
 * So the load-bearing assertion here is an INVARIANCE one:
 *
 *   Every answer given BEFORE 2026-07-01 must score byte-identically before and
 *   after the change.
 *
 * In that era the displayed text and the axis agreed and those answers were
 * scored correctly. Any difference is a bug in the versioning, not a fix. A
 * test that only checked "the broken ones changed" would pass just as happily
 * on a version that mangled everything.
 *
 * The fixtures are REAL production answers, read read-only. Synthetic ones
 * would prove the code self-consistent, not that it handles the actual data.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { scoreResponses } from "@/lib/journey/analysis";
import { buildVersionedQuestionResolver } from "@/lib/journey/question-versions";
import type { Question, Response, AxisWeight } from "@/lib/journey/types";

// The three rewrite clusters, from journey_questions.updated_at.
const REWRITE_AT: Record<string, string> = {
  q02_admiration_see_good: "2026-07-01T06:32:44Z",
  q03_bids_turn_toward: "2026-07-01T07:08:55Z",
  q11_contempt: "2026-07-01T06:55:04Z",
  q24_physical_closeness: "2026-07-01T06:56:16Z",
  q20_biggest_gap: "2026-07-12T06:31:01Z",
  q01_knowledge_world: "2026-07-20T08:00:19Z",
  q17_context_logistics: "2026-07-20T08:00:58Z",
  q19_rituals: "2026-07-20T08:03:04Z",
};

/** v1 axes — what was correct BEFORE the rewrite (migration 118 seed). */
const V1_AXES: Record<string, AxisWeight[]> = {
  q01_knowledge_world: [{ axis: "love_map", weight: 1 }],
  q02_admiration_see_good: [{ axis: "fondness", weight: 1 }],
  q03_bids_turn_toward: [{ axis: "turn_toward", weight: 1 }],
  q11_contempt: [{ axis: "four_horsemen_contempt", weight: 1 }],
  q17_context_logistics: [{ axis: "passion_context", weight: -1 }],
  q19_rituals: [{ axis: "shared_meaning", weight: 0.5 }],
  q24_physical_closeness: [
    { axis: "love_language_touch", weight: 0.5 },
    { axis: "passion_play", weight: 0.5 },
  ],
};

/** v2 axes — the correction in migration 197. */
const V2_AXES: Record<string, AxisWeight[]> = {
  q01_knowledge_world: [{ axis: "intimacy_presence", weight: 1 }],
  q02_admiration_see_good: [{ axis: "shared_meaning", weight: 1 }],
  q03_bids_turn_toward: [{ axis: "turn_toward", weight: 1 }],
  q11_contempt: [{ axis: "fondness", weight: 1 }],
  q17_context_logistics: [{ axis: "shared_meaning", weight: 1 }],
  q19_rituals: [{ axis: "emotional_safety", weight: 1 }],
  q24_physical_closeness: [{ axis: "passion_context", weight: 1 }],
};

interface Fixture {
  questions: Array<{ slug: string; type: string; axes: AxisWeight[]; options: unknown }>;
  responses: Array<{ journey_id: string; question_id: string; answer: unknown; created_at: string }>;
}

let fixture: Fixture;
let currentQuestions: Question[];

beforeAll(() => {
  // Captured read-only from production by scripts/journey-axis-fixture.mjs.
  fixture = JSON.parse(
    readFileSync(new URL("./__fixtures__/journey-axis-fixture.json", import.meta.url), "utf8"),
  ) as Fixture;

  currentQuestions = fixture.questions.map((q) => {
    const base = {
      id: q.slug,
      category: "free" as const,
      domain: null,
      axes: q.axes,
      purpose: "",
      he: "",
      en: "",
    };
    if (q.type === "likert5") return { ...base, type: "likert5" } as Question;
    return {
      ...base,
      type: q.type,
      he_prompt: "",
      en_prompt: "",
      options: q.options ?? [],
    } as unknown as Question;
  });
});

/** Today's production behaviour: one axis per slug, date ignored. */
function legacyResolver(questions: Question[]) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return (slug: string) => byId.get(slug);
}

/** The version rows migrations 196+197 produce, built in memory. */
function buildVersions() {
  const rows: Parameters<typeof buildVersionedQuestionResolver>[1] = [];
  for (const q of fixture.questions) {
    const rewrite = REWRITE_AT[q.slug];
    if (!rewrite) {
      rows.push({
        slug: q.slug, version: 1, valid_from: "-infinity", valid_to: null,
        he_text: "", en_text: null, axes: q.axes, reverse: false,
        options: q.options as never, type: q.type,
      });
      continue;
    }
    rows.push({
      slug: q.slug, version: 1, valid_from: "-infinity", valid_to: rewrite,
      he_text: "", en_text: null,
      axes: V1_AXES[q.slug] ?? q.axes, reverse: false,
      options: q.options as never, type: q.type,
    });
    rows.push({
      slug: q.slug, version: 2, valid_from: rewrite, valid_to: null,
      he_text: "", en_text: null,
      axes: V2_AXES[q.slug] ?? q.axes, reverse: false,
      options: q.options as never, type: q.type,
    });
  }
  return rows;
}

function byJourney(): Map<string, Response[]> {
  const m = new Map<string, Response[]>();
  for (const r of fixture.responses) {
    const list = m.get(r.journey_id) ?? [];
    list.push({
      question_id: r.question_id,
      answer: r.answer as Response["answer"],
      locale: "he",
      created_at: r.created_at,
    });
    m.set(r.journey_id, list);
  }
  return m;
}

const CUTOFF = Date.parse("2026-07-01T00:00:00Z");

describe("axis versioning", () => {
  it("THE GATE — every pre-2026-07-01 answer scores identically before and after", () => {
    const legacy = legacyResolver(currentQuestions);
    const versioned = buildVersionedQuestionResolver(currentQuestions, buildVersions());

    let checked = 0;
    const drifted: string[] = [];

    for (const [journeyId, responses] of byJourney()) {
      // Only journeys answered ENTIRELY before the first rewrite. A journey
      // straddling the cutoff is expected to change and proves nothing here.
      const allBefore = responses.every((r) => Date.parse(r.created_at!) < CUTOFF);
      if (!allBefore || responses.length === 0) continue;

      // Legacy is evaluated against the axes that were live PRE-rewrite, which
      // is what production actually did at the time.
      const preRewriteQuestions = currentQuestions.map((q) =>
        V1_AXES[q.id] ? ({ ...q, axes: V1_AXES[q.id] } as Question) : q,
      );
      const before = scoreResponses(responses, legacyResolver(preRewriteQuestions)).scores;
      const after = scoreResponses(responses, versioned).scores;

      checked++;
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        drifted.push(journeyId);
      }
    }

    // A test that checked nothing would also report zero drift.
    expect(checked).toBeGreaterThan(0);
    expect(drifted).toEqual([]);
    void legacy;
  });

  it("resolves the axis by the answer's own date, at the boundary", () => {
    const versioned = buildVersionedQuestionResolver(currentQuestions, buildVersions());
    const before = versioned("q11_contempt", "2026-06-30T12:00:00Z");
    const after = versioned("q11_contempt", "2026-07-02T12:00:00Z");

    expect(before?.axes[0].axis).toBe("four_horsemen_contempt");
    expect(after?.axes[0].axis).toBe("fondness");
  });

  it("post-rewrite answers DO move — the fix actually fixes something", () => {
    const versioned = buildVersionedQuestionResolver(currentQuestions, buildVersions());
    const legacy = legacyResolver(currentQuestions);

    // A 5 on q11 after the rewrite: the Hebrew asks how often you express
    // appreciation, so it must land on fondness, not contempt.
    const r: Response[] = [{
      question_id: "q11_contempt",
      answer: { kind: "likert", value: 5 },
      locale: "he",
      created_at: "2026-08-01T00:00:00Z",
    }];
    const before = scoreResponses(r, legacy).scores;
    const after = scoreResponses(r, versioned).scores;

    expect(before.four_horsemen_contempt).toBeGreaterThan(0);
    expect(after.four_horsemen_contempt).toBeUndefined();
    expect(after.fondness).toBeGreaterThan(0);
  });
});
