// ============================================================
// lib/journey-content/cycle-selection.ts
//
// The pure half of the five-track cycle model: given a user's ranking and the
// content they have not seen, decide which five items open next.
//
// Kept free of I/O so it can be unit-tested against the real inventory numbers
// (family = 3 items today, which is exactly the case §2א(ב) exists for).
//
// Rules, from docs/journey-five-track-model-spec.md:
//   §3    one item per category, ordered by the user's ranking — weakest area
//         first, strongest last.
//   §2א(ב) "one from each category" is the rule, not a cage. When a category
//         has nothing unseen left, the slot is filled from the next category in
//         the ranking that still has content, and marked as a substitute. The
//         user always gets five; existing content never sits stranded because
//         one category ran dry.
// ============================================================

/** An item that is eligible to open (already filtered to unseen + active). */
export interface CandidateItem {
  id: string;
  categoryId: string;
  /** Admin-controlled order within the category. Lower opens first. */
  sortOrder: number;
}

export interface CycleSlot {
  itemId: string;
  categoryId: string;
  /** 1-based display position, following the ranking order. */
  rankPosition: number;
  /** True when the intended category was empty and another one filled in. */
  isSubstitute: boolean;
  /** The category this slot was meant to serve (set when isSubstitute). */
  intendedCategoryId: string | null;
}

export interface SelectionResult {
  slots: CycleSlot[];
  /** Categories that had nothing left to give — what Itzik needs to write. */
  exhaustedCategoryIds: string[];
  /** Fewer than the ranking length means the whole library is running out. */
  short: boolean;
}

/**
 * Pick the items for one cycle.
 *
 * @param ranking    category UUIDs, most-important first (the frozen snapshot)
 * @param candidates every item the user has NOT already been given
 */
export function selectCycleItems(
  ranking: string[],
  candidates: CandidateItem[],
): SelectionResult {
  // Queue per category, in admin order. Tie-break on id so the choice is
  // deterministic — two runs of the preview must agree with what actually opens.
  const queues = new Map<string, CandidateItem[]>();
  for (const c of candidates) {
    const q = queues.get(c.categoryId);
    if (q) q.push(c);
    else queues.set(c.categoryId, [c]);
  }
  for (const q of queues.values()) {
    q.sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  const taken = new Set<string>();
  const slots: CycleSlot[] = [];
  const exhausted: string[] = [];

  /** Next unused item from a category, or null when that queue is spent. */
  const takeFrom = (categoryId: string): CandidateItem | null => {
    const q = queues.get(categoryId);
    if (!q) return null;
    while (q.length) {
      const next = q.shift() as CandidateItem;
      if (!taken.has(next.id)) return next;
    }
    return null;
  };

  ranking.forEach((categoryId, index) => {
    const rankPosition = index + 1;

    const own = takeFrom(categoryId);
    if (own) {
      taken.add(own.id);
      slots.push({
        itemId: own.id,
        categoryId,
        rankPosition,
        isSubstitute: false,
        intendedCategoryId: null,
      });
      return;
    }

    exhausted.push(categoryId);

    // §2א(ב): fall forward through the ranking — the next category that still
    // has content fills the slot. Scanning the ranking (not the whole table)
    // keeps the substitute as close to the user's priorities as possible.
    for (const donorId of ranking) {
      if (donorId === categoryId) continue;
      const borrowed = takeFrom(donorId);
      if (!borrowed) continue;
      taken.add(borrowed.id);
      slots.push({
        itemId: borrowed.id,
        categoryId: donorId,
        rankPosition,
        isSubstitute: true,
        intendedCategoryId: categoryId,
      });
      return;
    }
    // Nothing anywhere — the slot stays empty and `short` reports it.
  });

  return {
    slots,
    exhaustedCategoryIds: exhausted,
    short: slots.length < ranking.length,
  };
}
