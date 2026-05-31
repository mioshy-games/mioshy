// ============================================================
// Priority categories - DB-backed source of truth for the five
// q_priorities categories that drive the assessment ranking.
//
// Replaces the constant maps that used to live in
// lib/journey/priorities.ts (PRIORITY_LABELS_HE / EN / DESC_HE / EN).
// Slice 1 of v3: those constants were dropped in favour of seed rows
// in journey_categories with assessment_priority_key set.
//
// Read pattern: server-side fetch on the page that needs the labels,
// then pass through as props to client components. Per-request caching
// only - Server Components recompute per render anyway, and the row
// count is tiny (5).
//
// All functions are async and server-only. RLS lets any signed-in
// user read active categories (set up in migration 035), so the
// session client suffices.
// ============================================================

import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/journey/types";
import type { PriorityKey } from "@/lib/journey/priorities";

export interface PriorityCategory {
  /** journey_categories.id */
  id: string;
  /** assessment_priority_key - one of the five q_priorities slugs. */
  key: PriorityKey;
  /** journey_categories.slug - equal to key for the seeded five. */
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  sort_order: number;
}

/**
 * Returns the five priority categories ordered by sort_order. Throws if
 * the seed is missing or partial - that's an installation error and we
 * want to fail loudly, not render a silently-broken assessment.
 */
// 2026-05-31 — React.cache. Five rows that anyone in the same request
// can pull without re-firing the journey_categories read. Shared by
// getPriorityLabels (which is itself called by /my/today and by any
// assessment-replay surface).
export const getPriorityCategories = cache(_getPriorityCategories);

async function _getPriorityCategories(): Promise<PriorityCategory[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_categories")
    .select(
      "id, slug, name_he, name_en, description_he, description_en, sort_order, assessment_priority_key, is_active",
    )
    .not("assessment_priority_key", "is", null)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(
      `getPriorityCategories failed: ${error.message} (${error.code})`,
    );
  }
  if (!data || data.length === 0) {
    throw new Error(
      "getPriorityCategories: no priority categories seeded. Run migration 055.",
    );
  }
  return data.map((row) => ({
    id: row.id as string,
    key: row.assessment_priority_key as PriorityKey,
    slug: row.slug as string,
    name_he: row.name_he as string,
    name_en: (row.name_en as string | null) ?? null,
    description_he: (row.description_he as string | null) ?? null,
    description_en: (row.description_en as string | null) ?? null,
    sort_order: row.sort_order as number,
  }));
}

/**
 * Lookup helper: returns a Map keyed by PriorityKey for O(1) label
 * resolution from a stored ranking. Pages that render multiple keys
 * (e.g. divergence view, my/journey rail) prefer this shape over the
 * ordered list.
 */
export async function getPriorityCategoryMap(): Promise<
  Map<PriorityKey, PriorityCategory>
> {
  const list = await getPriorityCategories();
  return new Map(list.map((c) => [c.key, c]));
}

/**
 * Locale-aware label helper. Returns name_en if locale='en' and the
 * column is set; otherwise falls back to name_he (Hebrew is the
 * primary product language so a missing en translation isn't fatal).
 */
export function localizedLabel(
  cat: PriorityCategory,
  locale: Locale,
): string {
  if (locale === "en" && cat.name_en) return cat.name_en;
  return cat.name_he;
}

/**
 * Locale-aware description helper, same fallback rules.
 */
export function localizedDescription(
  cat: PriorityCategory,
  locale: Locale,
): string {
  if (locale === "en" && cat.description_en) return cat.description_en;
  return cat.description_he ?? "";
}

/**
 * Convenience: build the { he, en } label/description shape that some
 * legacy consumers (analysis, comparison) expect, in one pass.
 */
export interface PriorityLabelsBundle {
  labelsHe: Record<PriorityKey, string>;
  labelsEn: Record<PriorityKey, string>;
  descsHe: Record<PriorityKey, string>;
  descsEn: Record<PriorityKey, string>;
  /** Canonical sort order - sort_order ascending. Use this for
   *  ordering tables / lists by the admin-defined canonical sequence. */
  canonicalOrder: PriorityKey[];
}

export async function getPriorityLabels(): Promise<PriorityLabelsBundle> {
  const list = await getPriorityCategories();
  const labelsHe = {} as Record<PriorityKey, string>;
  const labelsEn = {} as Record<PriorityKey, string>;
  const descsHe = {} as Record<PriorityKey, string>;
  const descsEn = {} as Record<PriorityKey, string>;
  for (const c of list) {
    labelsHe[c.key] = c.name_he;
    labelsEn[c.key] = c.name_en ?? c.name_he;
    descsHe[c.key] = c.description_he ?? "";
    descsEn[c.key] = c.description_en ?? c.description_he ?? "";
  }
  return {
    labelsHe,
    labelsEn,
    descsHe,
    descsEn,
    canonicalOrder: list.map((c) => c.key),
  };
}
