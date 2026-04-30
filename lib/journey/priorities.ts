/**
 * lib/journey/priorities.ts
 *
 * Stable category keys + display labels for the priority-ranking step at
 * the end of the diagnostic. Keys are English slugs and live in the DB
 * (journey_responses.answer.order); labels are HE/EN and live only on the
 * UI / expert-dashboard surfaces.
 *
 * Adding a 6th category later: append the slug to PRIORITY_KEYS, add its
 * labels + descriptions, bump the questionnaire's `q_priorities.categories`
 * list, and decide how to migrate prior 5-item rankings (probably just
 * append the new key at the end of every existing answer).
 */

export const PRIORITY_KEYS = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
] as const;

export type PriorityKey = (typeof PRIORITY_KEYS)[number];

export const PRIORITY_LABELS_HE: Record<PriorityKey, string> = {
  communication: "תקשורת זוגית",
  intimacy: "מיניות ואינטימיות",
  emotional_connection: "אהבה וחיבור רגשי",
  friendship: "חברות ושותפות יומיומית",
  family: "משפחה, הורות ולחצים חיצוניים",
};

export const PRIORITY_LABELS_EN: Record<PriorityKey, string> = {
  communication: "Couple Communication",
  intimacy: "Sexuality & Intimacy",
  emotional_connection: "Love & Emotional Connection",
  friendship: "Friendship & Daily Partnership",
  family: "Family, Parenting & External Pressures",
};

export const PRIORITY_DESC_HE: Record<PriorityKey, string> = {
  communication: "איך אנחנו מדברים, מקשיבים ופותרים אי-הסכמות",
  intimacy: "החיים המיניים, המגע, הקרבה הפיזית והרצון",
  emotional_connection: "תחושת קרבה, ביטויי אהבה, פתיחות רגשית",
  friendship: "כיף, חוויות משותפות, שגרה והתנהלות יומיומית",
  family: "ילדים, משפחות מוצא, עבודה, כסף ולחצים מבחוץ",
};

export const PRIORITY_DESC_EN: Record<PriorityKey, string> = {
  communication: "How we talk, listen, and resolve disagreements",
  intimacy: "Sex life, touch, physical closeness, desire",
  emotional_connection: "Closeness, expressions of love, emotional openness",
  friendship: "Fun, shared experiences, daily routine",
  family: "Kids, in-laws, work, money, outside pressures",
};

const PRIORITY_KEY_SET = new Set<string>(PRIORITY_KEYS);

/**
 * Type guard: true iff `order` is a permutation of every PRIORITY_KEYS
 * entry (no missing, no extras, no duplicates). Used both client-side
 * before submit and server-side in the answer validator.
 */
export function isValidOrder(order: unknown): order is PriorityKey[] {
  if (!Array.isArray(order)) return false;
  if (order.length !== PRIORITY_KEYS.length) return false;
  const seen = new Set<string>();
  for (const k of order) {
    if (typeof k !== "string") return false;
    if (!PRIORITY_KEY_SET.has(k)) return false;
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/**
 * Per-key divergence between two rankings. Each entry returns the 1-based
 * position each partner gave that key plus the absolute diff. Sorted by
 * diff descending so the biggest gap surfaces first.
 *
 * The expert dashboard uses this to flag categories where one partner
 * placed a domain at #1 and the other at #5, etc.
 */
export type PriorityDivergence = Array<{
  key: PriorityKey;
  aPos: number;
  bPos: number;
  diff: number;
}>;

export function divergence(
  a: PriorityKey[],
  b: PriorityKey[],
): PriorityDivergence {
  const out: PriorityDivergence = [];
  for (const k of PRIORITY_KEYS) {
    const aPos = a.indexOf(k) + 1; // 0 → "missing"; we treat as Infinity diff downstream
    const bPos = b.indexOf(k) + 1;
    if (aPos === 0 || bPos === 0) {
      // One side hasn't ranked yet — caller is expected to short-circuit
      // before reaching this. We return diff=0 to be safe; UI should not
      // call divergence() on partial rankings.
      out.push({ key: k, aPos, bPos, diff: 0 });
      continue;
    }
    out.push({ key: k, aPos, bPos, diff: Math.abs(aPos - bPos) });
  }
  out.sort((x, y) => y.diff - x.diff);
  return out;
}
