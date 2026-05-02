/**
 * lib/journey/priorities.ts
 *
 * The five q_priorities category keys, plus runtime helpers for the
 * ranking step's permutation validator and the cross-partner divergence
 * computation.
 *
 * v3 slice 1 changes:
 *   * The `PRIORITY_KEYS` array constant was removed. The DB
 *     (`journey_categories.assessment_priority_key`) is now the source
 *     of truth for which categories drive the ranking; this module
 *     keeps a `PriorityKey` literal-union *type* for compile-time
 *     correctness, but no runtime array.
 *   * The `PRIORITY_LABELS_HE / EN / DESC_HE / EN` constant maps were
 *     removed. Labels live on the DB seed; fetch via
 *     `lib/journey-content/priority-categories.ts` (server-side).
 *     Client components receive labels as props from the server
 *     component that owns the page.
 *
 * Adding a sixth category later: insert a row into
 * `journey_categories` with `assessment_priority_key` set to a NEW
 * slug, then extend the `PriorityKey` literal-union type below + the
 * `q_priorities` question in `journey/questionnaire.json`.
 */

/**
 * The set of valid priority slugs. Kept in sync with the seed in
 * `055_journey_per_partner_cadence.sql` (Section 3) and the
 * `q_priorities.categories[].key` values in
 * `journey/questionnaire.json`.
 *
 * If you add a key, also add it to `_INTERNAL_PRIORITY_KEY_SET` below
 * so `isValidOrder` and `isPriorityKey` accept the new slug.
 */
export type PriorityKey =
  | "communication"
  | "intimacy"
  | "emotional_connection"
  | "friendship"
  | "family";

/**
 * Internal-only set used by validators below. Not exported — callers
 * that need to enumerate keys should fetch from the DB
 * (`getPriorityCategories()`). Kept as a Set rather than an array so
 * it can't be misused as a "canonical order" — order belongs to the
 * DB's `sort_order` column.
 */
const _INTERNAL_PRIORITY_KEY_SET: ReadonlySet<PriorityKey> = new Set<PriorityKey>([
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
]);

/**
 * Type guard: is `k` one of the recognized priority keys?
 *
 * Replaces the previous `(PRIORITY_KEYS as readonly string[]).includes(k)`
 * pattern across consumers.
 */
export function isPriorityKey(k: unknown): k is PriorityKey {
  return typeof k === "string" && _INTERNAL_PRIORITY_KEY_SET.has(k as PriorityKey);
}

/**
 * Type guard: true iff `order` is a permutation of every priority key
 * (no missing, no extras, no duplicates). Used both client-side before
 * submit and server-side in the answer validator.
 */
export function isValidOrder(order: unknown): order is PriorityKey[] {
  if (!Array.isArray(order)) return false;
  if (order.length !== _INTERNAL_PRIORITY_KEY_SET.size) return false;
  const seen = new Set<string>();
  for (const k of order) {
    if (typeof k !== "string") return false;
    if (!_INTERNAL_PRIORITY_KEY_SET.has(k as PriorityKey)) return false;
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/**
 * Per-key divergence between two rankings. Each entry returns the
 * 1-based position each partner gave that key plus the absolute diff.
 * Sorted by diff descending so the biggest gap surfaces first.
 *
 * `canonicalKeys` lets the caller pass the DB-canonical order
 * (sort_order ascending, fetched via `getPriorityCategories()`); this
 * keeps divergence framing stable as the admin reorders categories.
 * If omitted, falls back to the internal slug set in arbitrary order
 * — fine for the diff math itself, but callers that *render* by
 * canonical order should pass the DB list.
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
  canonicalKeys?: readonly PriorityKey[],
): PriorityDivergence {
  const keys: readonly PriorityKey[] =
    canonicalKeys ?? Array.from(_INTERNAL_PRIORITY_KEY_SET);
  const out: PriorityDivergence = [];
  for (const k of keys) {
    const aPos = a.indexOf(k) + 1; // 0 -> "missing"; we treat as Infinity diff downstream
    const bPos = b.indexOf(k) + 1;
    if (aPos === 0 || bPos === 0) {
      out.push({ key: k, aPos, bPos, diff: 0 });
      continue;
    }
    out.push({ key: k, aPos, bPos, diff: Math.abs(aPos - bPos) });
  }
  out.sort((x, y) => y.diff - x.diff);
  return out;
}
