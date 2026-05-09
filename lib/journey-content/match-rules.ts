/**
 * lib/journey-content/match-rules.ts
 *
 * Server-side queries + types for the journey_match_rules table.
 *
 * For Layer 1 the table acts as a labelled registry — every
 * scheduled item points back to the rule that produced it, and
 * the rule's bilingual rationale is what the user sees under
 * "Why this item?". Full DSL evaluation lands in V2 (see
 * docs/journey-execution-architecture-2026-05-08.md Part 4).
 */

import { createAdminClient } from "@/lib/supabase-admin";

export type MatcherKind =
  | "manual"
  | "auto_purchase"
  | "priority_top1"
  | "system_default";

export interface JourneyMatchRule {
  id:            string;
  slug:          string;
  label_he:      string;
  label_en:      string;
  rationale_he:  string;
  rationale_en:  string;
  matcher_kind:  MatcherKind;
  matcher_args:  Record<string, unknown>;
  is_active:     boolean;
  priority:      number;
  created_at:    string;
  updated_at:    string;
}

/**
 * Pull every rule, ordered by priority DESC then slug ASC.
 * Admin list view consumes this directly.
 */
export async function listMatchRules(): Promise<JourneyMatchRule[]> {
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("journey_match_rules")
    .select("*")
    .order("priority", { ascending: false })
    .order("slug", { ascending: true });

  if (error) {
    console.error("[match-rules] listMatchRules failed", error);
    return [];
  }
  return (data ?? []) as JourneyMatchRule[];
}

/**
 * Single-rule fetch. Returns null when slug or id misses.
 * Used by the edit page and by anywhere the materialiser needs to
 * resolve a rule by slug.
 */
export async function getMatchRule(
  identifier: { id: string } | { slug: string },
): Promise<JourneyMatchRule | null> {
  const admin = await createAdminClient();
  const query = admin.from("journey_match_rules").select("*");
  const { data, error } = await ("id" in identifier
    ? query.eq("id", identifier.id).maybeSingle()
    : query.eq("slug", identifier.slug).maybeSingle());

  if (error) {
    console.error("[match-rules] getMatchRule failed", error, identifier);
    return null;
  }
  return (data ?? null) as JourneyMatchRule | null;
}

/**
 * Resolve a slug to its UUID. The materialiser calls this whenever it
 * needs to attach a rule to a fresh scheduled_item. Cached in-process
 * because the rule set is small (~12 rows) and stable.
 */
let _slugCache: Map<string, string> | null = null;
let _slugCacheLoadedAt = 0;
const SLUG_CACHE_TTL_MS = 60_000;

export async function resolveRuleId(slug: string): Promise<string | null> {
  const now = Date.now();
  if (!_slugCache || now - _slugCacheLoadedAt > SLUG_CACHE_TTL_MS) {
    const rules = await listMatchRules();
    _slugCache = new Map(rules.map((r) => [r.slug, r.id]));
    _slugCacheLoadedAt = now;
  }
  return _slugCache.get(slug) ?? null;
}

/**
 * Bust the in-process cache. Called by the admin update action so
 * the next read sees fresh data immediately.
 */
export function invalidateRuleCache(): void {
  _slugCache = null;
  _slugCacheLoadedAt = 0;
}

/**
 * Count of active scheduled items currently attributed to each rule.
 * Powers the admin list's "in use" column so an editor can see
 * which rules are dead before retiring them.
 */
export async function countItemsPerRule(): Promise<Map<string, number>> {
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("journey_scheduled_items")
    .select("matched_by_rule_id");

  const counts = new Map<string, number>();
  if (error || !data) {
    if (error) console.error("[match-rules] countItemsPerRule failed", error);
    return counts;
  }
  for (const row of data) {
    const id = (row as { matched_by_rule_id: string | null }).matched_by_rule_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
