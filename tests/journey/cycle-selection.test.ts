/**
 * tests/journey/cycle-selection.test.ts
 *
 * The five-track selection rules (spec §3 and §2א(ב)), exercised against the
 * REAL production inventory counted on 2026-07-31:
 *
 *   communication 11 · intimacy 10 · emotional_connection 10 · friendship 7 · family 3
 *
 * family = 3 is the whole reason §2א(ב) exists: under a strict
 * one-item-per-category rule the library would stop after three cycles and 26
 * of 41 items (63%) would never reach anyone.
 */

import { describe, expect, it } from "vitest";
import { selectCycleItems, type CandidateItem } from "@/lib/journey-content/cycle-selection";

const INTIMACY = "cat-intimacy";
const EMOTIONAL = "cat-emotional";
const COMMUNICATION = "cat-communication";
const FRIENDSHIP = "cat-friendship";
const FAMILY = "cat-family";

/** Canonical ranking order (lib/journey/categories.ts CATEGORY_DISPLAY_ORDER). */
const RANKING = [INTIMACY, EMOTIONAL, COMMUNICATION, FRIENDSHIP, FAMILY];

/** Production counts, 2026-07-31. */
const REAL_INVENTORY: Record<string, number> = {
  [INTIMACY]: 10,
  [EMOTIONAL]: 10,
  [COMMUNICATION]: 11,
  [FRIENDSHIP]: 7,
  [FAMILY]: 3,
};

function buildLibrary(counts: Record<string, number>): CandidateItem[] {
  const out: CandidateItem[] = [];
  for (const [categoryId, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) {
      out.push({ id: `${categoryId}-${i}`, categoryId, sortOrder: i });
    }
  }
  return out;
}

/** Run consecutive cycles, removing what was served — like the real ledger. */
function runCycles(ranking: string[], counts: Record<string, number>, cycles: number) {
  let library = buildLibrary(counts);
  const results = [];
  for (let c = 0; c < cycles; c++) {
    const r = selectCycleItems(ranking, library);
    const served = new Set(r.slots.map((s) => s.itemId));
    library = library.filter((i) => !served.has(i.id));
    results.push(r);
  }
  return results;
}

describe("a healthy cycle: one item per category, in ranking order", () => {
  const result = selectCycleItems(RANKING, buildLibrary(REAL_INVENTORY));

  it("opens exactly five", () => {
    expect(result.slots).toHaveLength(5);
    expect(result.short).toBe(false);
  });

  it("gives one item per category, in the user's ranking order", () => {
    expect(result.slots.map((s) => s.categoryId)).toEqual(RANKING);
    expect(result.slots.map((s) => s.rankPosition)).toEqual([1, 2, 3, 4, 5]);
    expect(result.slots.every((s) => !s.isSubstitute)).toBe(true);
  });

  it("takes the admin's first item in each category", () => {
    expect(result.slots.map((s) => s.itemId)).toEqual([
      `${INTIMACY}-0`,
      `${EMOTIONAL}-0`,
      `${COMMUNICATION}-0`,
      `${FRIENDSHIP}-0`,
      `${FAMILY}-0`,
    ]);
  });

  it("is deterministic — the preview must match what actually opens", () => {
    const again = selectCycleItems(RANKING, buildLibrary(REAL_INVENTORY));
    expect(again.slots).toEqual(result.slots);
  });
});

describe("§2א(ב) flexible fill when a category runs dry", () => {
  it("still opens five once family is exhausted, and says so", () => {
    // Cycles 1-3 consume all three family items; cycle 4 has none left.
    const cycles = runCycles(RANKING, REAL_INVENTORY, 4);

    for (const c of cycles.slice(0, 3)) {
      expect(c.slots).toHaveLength(5);
      expect(c.exhaustedCategoryIds).toEqual([]);
    }

    const fourth = cycles[3];
    expect(fourth.slots).toHaveLength(5); // the user still gets five
    expect(fourth.short).toBe(false);
    expect(fourth.exhaustedCategoryIds).toEqual([FAMILY]);

    const substitutes = fourth.slots.filter((s) => s.isSubstitute);
    expect(substitutes).toHaveLength(1);
    expect(substitutes[0]?.intendedCategoryId).toBe(FAMILY);
    expect(substitutes[0]?.rankPosition).toBe(5); // family's slot
    expect(substitutes[0]?.categoryId).not.toBe(FAMILY);
  });

  it("borrows from the highest-ranked category that still has content", () => {
    const noFamily = { ...REAL_INVENTORY, [FAMILY]: 0 };
    const r = selectCycleItems(RANKING, buildLibrary(noFamily));
    const sub = r.slots.find((s) => s.isSubstitute);
    // Intimacy is first in the ranking and has content, so it donates.
    expect(sub?.categoryId).toBe(INTIMACY);
    expect(sub?.itemId).toBe(`${INTIMACY}-1`); // -0 already took slot 1
  });

  it("never serves the same item twice inside one cycle", () => {
    const r = selectCycleItems(RANKING, buildLibrary({ ...REAL_INVENTORY, [FAMILY]: 0, [FRIENDSHIP]: 0 }));
    const ids = r.slots.map((s) => s.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("unlocks the content that a strict one-per-category rule would strand", () => {
    // 41 items; strict rule stops at 3 cycles = 15 items. With flexible fill
    // the library keeps serving five until it is genuinely spent.
    const cycles = runCycles(RANKING, REAL_INVENTORY, 8);
    const served = cycles.reduce((n, c) => n + c.slots.length, 0);
    expect(served).toBe(40); // 8 full cycles of five
    expect(served).toBeGreaterThan(15);
  });
});

describe("when the library is genuinely spent", () => {
  it("reports short rather than inventing content", () => {
    const r = selectCycleItems(RANKING, buildLibrary({ [INTIMACY]: 2 }));
    expect(r.slots).toHaveLength(2);
    expect(r.short).toBe(true);
    expect(r.exhaustedCategoryIds).toContain(FAMILY);
  });

  it("returns nothing at all on an empty library", () => {
    const r = selectCycleItems(RANKING, []);
    expect(r.slots).toHaveLength(0);
    expect(r.short).toBe(true);
  });
});

describe("the ranking drives the order, not the category table", () => {
  it("follows a user whose weakest area is family", () => {
    const ranking = [FAMILY, COMMUNICATION, INTIMACY, EMOTIONAL, FRIENDSHIP];
    const r = selectCycleItems(ranking, buildLibrary(REAL_INVENTORY));
    expect(r.slots.map((s) => s.categoryId)).toEqual(ranking);
    expect(r.slots[0]?.itemId).toBe(`${FAMILY}-0`);
  });
});
