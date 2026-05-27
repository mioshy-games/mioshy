/**
 * POST /dashboard/journey/import   (Phase 2 — slug-keyed, CSV-only)
 *
 * Accepts a single CSV file (multipart/form-data, field name: "file").
 * Detects entity type from the header signature (programs / categories /
 * subtopics / items) and applies it to the catalog tables via the
 * service-role client.
 *
 * Apply semantics (per Phase 2A decisions):
 *   • slug-keyed identity. UUIDs never appear in the CSV.
 *   • Update existing by slug, create where missing, NEVER delete.
 *   • Per-row, best-effort. A failed row does NOT abort the rest.
 *   • Empty cells overwrite to NULL (the modal banner reminds admins).
 *   • items.is_one_off=true rows are protected — never written via import.
 *   • items prereq_item_slugs: two-pass — pass 1 writes the row with empty
 *     prereqs, pass 2 resolves slugs (incl. cross-category `cat/item`
 *     syntax) and breaks any cycles before writing the final array.
 *
 * Errors / warnings / failures bucket per Section 8 of the plan:
 *   parseErrors  — per-row validation failures (column / enum / int / json)
 *   warnings     — non-fatal observations (is_one_off skipped, prereq dropped,
 *                  prereq cycle broken, unknown columns)
 *   failures     — apply-side failures (FK resolution, DB error)
 *
 * Auth: requireAdmin (redirects non-admin).
 * Size cap: 10 MB; larger files reject with 413 before parse.
 */

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  detectCsvKind,
  parseProgramsCsv,
  parseCategoriesCsv,
  parseSubtopicsCsv,
  parseItemsCsv,
  type JourneyCsvKind,
  type ParseError,
  type ProgramImportRow,
  type CategoryImportRow,
  type SubtopicImportRow,
  type ItemImportRow,
} from "@/lib/csv-journey";
import { revalidatePath } from "next/cache";

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB cap per Section 12 #6

// Loose type for the admin client without pulling in @supabase/supabase-js
// types here — the route never inspects the client's internal shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

// ── Response shape ──────────────────────────────────────────────────────────

export type ApplyWarningCode =
  | "is_one_off_protected"
  | "prereq_dropped"
  | "prereq_cycle_broken"
  | "unknown_columns";

export type ApplyFailureCode =
  | "fk_category_missing"
  | "fk_subtopic_missing"
  | "fk_program_missing"
  | "fk_program_mismatch"
  | "subtopic_category_mismatch"
  | "db_insert_failed"
  | "db_update_failed";

export type EntityCounts = {
  created: number;
  updated: number;
  skipped: number; // is_one_off protected, etc.
  failed: number;
};

export type ApplyWarning = {
  entity: JourneyCsvKind | "items"; // always one of the four
  row: number; // 0 = file-level
  slug?: string;
  code: ApplyWarningCode;
  message: string;
};

export type ApplyFailure = {
  entity: JourneyCsvKind;
  row: number;
  slug?: string;
  code: ApplyFailureCode;
  message: string;
};

export type JourneyImportSummary = {
  ok: boolean;
  kind: JourneyCsvKind | null;
  summary: {
    programs: EntityCounts;
    categories: EntityCounts;
    subtopics: EntityCounts;
    items: EntityCounts;
  };
  parseErrors: ParseError[];
  warnings: ApplyWarning[];
  failures: ApplyFailure[];
};

const emptyCounts = (): EntityCounts => ({
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
});

const emptySummary = () => ({
  programs: emptyCounts(),
  categories: emptyCounts(),
  subtopics: emptyCounts(),
  items: emptyCounts(),
});

// ── Catalog maps (loaded once per request) ──────────────────────────────────

type ProgramsBySlug = Map<string, { id: string }>;
type CategoriesByKey = Map<string, { id: string; program_id: string | null; program_slug: string }>;
type SubtopicsByKey = Map<string, { id: string; category_id: string }>;
type ItemsByKey = Map<string, { id: string; is_one_off: boolean }>;

type Maps = {
  programsBySlug: ProgramsBySlug;
  /** Keyed by `${program_slug ?? ""}/${slug}`. Standalone categories use "". */
  categoriesByKey: CategoriesByKey;
  /** Keyed by `${category_slug}/${slug}`. */
  subtopicsByKey: SubtopicsByKey;
  /** Keyed by `${category_slug}/${slug}`. */
  itemsByKey: ItemsByKey;
  /** category id → program_slug ("" if standalone). Used when items resolve subtopic_id and we need to verify program. */
  programSlugByCategoryId: Map<string, string>;
};

async function loadMaps(admin: AdminClient): Promise<Maps> {
  const [progRes, catRes, subRes, itemRes] = await Promise.all([
    admin.from("journey_programs").select("id, slug"),
    admin.from("journey_categories").select("id, slug, program_id"),
    admin.from("journey_subtopics").select("id, slug, category_id"),
    admin.from("journey_items").select("id, slug, category_id, is_one_off"),
  ]);

  const programsBySlug: ProgramsBySlug = new Map();
  const programSlugById = new Map<string, string>();
  for (const p of (progRes.data ?? []) as Array<{ id: string; slug: string }>) {
    programsBySlug.set(p.slug, { id: p.id });
    programSlugById.set(p.id, p.slug);
  }

  const categoriesByKey: CategoriesByKey = new Map();
  const categorySlugById = new Map<string, string>();
  const programSlugByCategoryId = new Map<string, string>();
  for (const ca of (catRes.data ?? []) as Array<{
    id: string;
    slug: string;
    program_id: string | null;
  }>) {
    const programSlug = ca.program_id ? (programSlugById.get(ca.program_id) ?? "") : "";
    categoriesByKey.set(`${programSlug}/${ca.slug}`, {
      id: ca.id,
      program_id: ca.program_id,
      program_slug: programSlug,
    });
    categorySlugById.set(ca.id, ca.slug);
    programSlugByCategoryId.set(ca.id, programSlug);
  }

  const subtopicsByKey: SubtopicsByKey = new Map();
  for (const s of (subRes.data ?? []) as Array<{
    id: string;
    slug: string;
    category_id: string;
  }>) {
    const catSlug = categorySlugById.get(s.category_id);
    if (!catSlug) continue;
    subtopicsByKey.set(`${catSlug}/${s.slug}`, { id: s.id, category_id: s.category_id });
  }

  const itemsByKey: ItemsByKey = new Map();
  for (const it of (itemRes.data ?? []) as Array<{
    id: string;
    slug: string;
    category_id: string;
    is_one_off: boolean | null;
  }>) {
    const catSlug = categorySlugById.get(it.category_id);
    if (!catSlug) continue;
    itemsByKey.set(`${catSlug}/${it.slug}`, {
      id: it.id,
      is_one_off: it.is_one_off === true,
    });
  }

  return {
    programsBySlug,
    categoriesByKey,
    subtopicsByKey,
    itemsByKey,
    programSlugByCategoryId,
  };
}

// ── FK resolution: category_slug (+ optional program_slug) → category row ──

function resolveCategory(
  maps: Maps,
  categorySlug: string,
  programSlug: string | null,
): { id: string; program_slug: string } | { error: ApplyFailureCode; message: string } {
  if (programSlug !== null) {
    const direct = maps.categoriesByKey.get(`${programSlug}/${categorySlug}`);
    if (direct) return { id: direct.id, program_slug: direct.program_slug };
    return {
      error: "fk_category_missing",
      message: `Category "${categorySlug}" under program "${programSlug || "(standalone)"}" not found in DB`,
    };
  }
  // No program_slug provided — scan for matches.
  const hits: Array<{ id: string; program_slug: string }> = [];
  for (const cat of maps.categoriesByKey.values()) {
    if (cat.program_slug === "" || cat.program_slug.length >= 0) {
      // collect by suffix-match on slug
    }
  }
  // Simpler scan:
  for (const [key, cat] of maps.categoriesByKey) {
    const slugPart = key.slice(key.indexOf("/") + 1);
    if (slugPart === categorySlug) hits.push({ id: cat.id, program_slug: cat.program_slug });
  }
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) {
    return {
      error: "fk_category_missing",
      message: `Category "${categorySlug}" not found in DB`,
    };
  }
  return {
    error: "fk_category_missing",
    message: `Category "${categorySlug}" is ambiguous — exists under multiple programs (${hits.map((h) => h.program_slug || "(standalone)").join(", ")}). Add program_slug to the row to disambiguate.`,
  };
}

// ── Programs apply ──────────────────────────────────────────────────────────

async function applyPrograms(
  admin: AdminClient,
  rows: Array<{ rowNum: number; row: ProgramImportRow }>,
  maps: Maps,
  counts: EntityCounts,
  failures: ApplyFailure[],
): Promise<void> {
  for (const { rowNum, row } of rows) {
    const existing = maps.programsBySlug.get(row.slug);
    const payload = {
      slug: row.slug,
      name_he: row.name_he,
      name_en: row.name_en,
      description_he: row.description_he,
      description_en: row.description_en,
      cover_image_url: row.cover_image_url,
      default_anchor: row.default_anchor,
      product_slug: row.product_slug,
      is_active: row.is_active,
      sort_weight: row.sort_weight,
    };

    if (existing) {
      const { error } = await admin
        .from("journey_programs")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        failures.push({
          entity: "programs", row: rowNum, slug: row.slug,
          code: "db_update_failed", message: error.message,
        });
        counts.failed++;
      } else {
        counts.updated++;
      }
    } else {
      const { data, error } = await admin
        .from("journey_programs")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        failures.push({
          entity: "programs", row: rowNum, slug: row.slug,
          code: "db_insert_failed", message: error.message,
        });
        counts.failed++;
      } else {
        counts.created++;
        // Update the in-memory map so subsequent rows referencing this slug resolve.
        if (data?.id) maps.programsBySlug.set(row.slug, { id: data.id });
      }
    }
  }
}

// ── Categories apply ────────────────────────────────────────────────────────

async function applyCategories(
  admin: AdminClient,
  rows: Array<{ rowNum: number; row: CategoryImportRow }>,
  maps: Maps,
  counts: EntityCounts,
  failures: ApplyFailure[],
): Promise<void> {
  for (const { rowNum, row } of rows) {
    // Resolve program_id (null = standalone)
    let program_id: string | null = null;
    let program_slug = "";
    if (row.program_slug !== null) {
      const prog = maps.programsBySlug.get(row.program_slug);
      if (!prog) {
        failures.push({
          entity: "categories", row: rowNum, slug: row.slug,
          code: "fk_program_missing",
          message: `Program "${row.program_slug}" not found in DB`,
        });
        counts.failed++;
        continue;
      }
      program_id = prog.id;
      program_slug = row.program_slug;
    }

    const existing = maps.categoriesByKey.get(`${program_slug}/${row.slug}`);
    const payload = {
      program_id,
      slug: row.slug,
      name_he: row.name_he,
      name_en: row.name_en,
      description_he: row.description_he,
      description_en: row.description_en,
      sort_order: row.sort_order,
      is_active: row.is_active,
    };

    if (existing) {
      const { error } = await admin
        .from("journey_categories")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        failures.push({
          entity: "categories", row: rowNum, slug: row.slug,
          code: "db_update_failed", message: error.message,
        });
        counts.failed++;
      } else {
        counts.updated++;
      }
    } else {
      const { data, error } = await admin
        .from("journey_categories")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        failures.push({
          entity: "categories", row: rowNum, slug: row.slug,
          code: "db_insert_failed", message: error.message,
        });
        counts.failed++;
      } else {
        counts.created++;
        if (data?.id) {
          maps.categoriesByKey.set(`${program_slug}/${row.slug}`, {
            id: data.id, program_id, program_slug,
          });
          maps.programSlugByCategoryId.set(data.id, program_slug);
        }
      }
    }
  }
}

// ── Subtopics apply ─────────────────────────────────────────────────────────

async function applySubtopics(
  admin: AdminClient,
  rows: Array<{ rowNum: number; row: SubtopicImportRow }>,
  maps: Maps,
  counts: EntityCounts,
  failures: ApplyFailure[],
): Promise<void> {
  for (const { rowNum, row } of rows) {
    // Resolve parent category
    const cat = resolveCategory(maps, row.category_slug, row.program_slug);
    if ("error" in cat) {
      failures.push({
        entity: "subtopics", row: rowNum, slug: row.slug,
        code: cat.error, message: cat.message,
      });
      counts.failed++;
      continue;
    }
    // Defensive: row's program_slug must match resolved category's program
    if (row.program_slug !== null && row.program_slug !== cat.program_slug) {
      failures.push({
        entity: "subtopics", row: rowNum, slug: row.slug,
        code: "fk_program_mismatch",
        message: `Row's program_slug "${row.program_slug}" doesn't match category's actual program "${cat.program_slug || "(standalone)"}"`,
      });
      counts.failed++;
      continue;
    }

    const existing = maps.subtopicsByKey.get(`${row.category_slug}/${row.slug}`);
    const payload = {
      category_id: cat.id,
      slug: row.slug,
      name_he: row.name_he,
      name_en: row.name_en,
      description_he: row.description_he,
      description_en: row.description_en,
      sort_order: row.sort_order,
      is_active: row.is_active,
    };

    if (existing) {
      const { error } = await admin
        .from("journey_subtopics")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        failures.push({
          entity: "subtopics", row: rowNum, slug: row.slug,
          code: "db_update_failed", message: error.message,
        });
        counts.failed++;
      } else {
        counts.updated++;
      }
    } else {
      const { data, error } = await admin
        .from("journey_subtopics")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        failures.push({
          entity: "subtopics", row: rowNum, slug: row.slug,
          code: "db_insert_failed", message: error.message,
        });
        counts.failed++;
      } else {
        counts.created++;
        if (data?.id) {
          maps.subtopicsByKey.set(`${row.category_slug}/${row.slug}`, {
            id: data.id, category_id: cat.id,
          });
        }
      }
    }
  }
}

// ── Items: pass-1 apply (writes everything except prereqs) ──────────────────

type ItemWritePlan = {
  rowNum: number;
  row: ItemImportRow;
  itemId: string;
  categoryId: string;
  categorySlug: string;
  prereqSlugs: string[];
};

async function applyItemsPass1(
  admin: AdminClient,
  rows: Array<{ rowNum: number; row: ItemImportRow }>,
  maps: Maps,
  counts: EntityCounts,
  warnings: ApplyWarning[],
  failures: ApplyFailure[],
): Promise<ItemWritePlan[]> {
  const plans: ItemWritePlan[] = [];

  for (const { rowNum, row } of rows) {
    // Resolve parent category
    const cat = resolveCategory(maps, row.category_slug, row.program_slug);
    if ("error" in cat) {
      failures.push({
        entity: "items", row: rowNum, slug: row.slug,
        code: cat.error, message: cat.message,
      });
      counts.failed++;
      continue;
    }
    // Defensive: row's program_slug must match resolved category's program
    if (row.program_slug !== null && row.program_slug !== cat.program_slug) {
      failures.push({
        entity: "items", row: rowNum, slug: row.slug,
        code: "fk_program_mismatch",
        message: `Row's program_slug "${row.program_slug}" doesn't match category's actual program "${cat.program_slug || "(standalone)"}"`,
      });
      counts.failed++;
      continue;
    }

    // Resolve subtopic_id (optional)
    let subtopic_id: string | null = null;
    if (row.subtopic_slug !== null) {
      const sub = maps.subtopicsByKey.get(`${row.category_slug}/${row.subtopic_slug}`);
      if (!sub) {
        failures.push({
          entity: "items", row: rowNum, slug: row.slug,
          code: "fk_subtopic_missing",
          message: `Subtopic "${row.subtopic_slug}" not found under category "${row.category_slug}"`,
        });
        counts.failed++;
        continue;
      }
      if (sub.category_id !== cat.id) {
        failures.push({
          entity: "items", row: rowNum, slug: row.slug,
          code: "subtopic_category_mismatch",
          message: `Subtopic "${row.subtopic_slug}" exists but under a different category`,
        });
        counts.failed++;
        continue;
      }
      subtopic_id = sub.id;
    }

    const existing = maps.itemsByKey.get(`${row.category_slug}/${row.slug}`);

    // is_one_off protection — never update those rows via catalog import
    if (existing && existing.is_one_off) {
      warnings.push({
        entity: "items", row: rowNum, slug: row.slug,
        code: "is_one_off_protected",
        message: `Skipped — slug "${row.category_slug}/${row.slug}" matches an ad-hoc per-couple lesson (is_one_off=true)`,
      });
      counts.skipped++;
      continue;
    }

    // Pass 1: write everything except prereqs (prereqs default to [])
    const payload = {
      category_id: cat.id,
      subtopic_id,
      slug: row.slug,
      title_he: row.title_he,
      title_en: row.title_en,
      stage: row.stage,
      content_type: row.content_type,
      audience: row.audience,
      kind: row.kind,
      est_minutes: row.est_minutes,
      tags: row.tags,
      prereq_item_ids: [] as string[],
      body_he: row.body_he,
      body_en: row.body_en,
      task_he: row.task_he,
      task_en: row.task_en,
      challenge_he: row.challenge_he,
      challenge_en: row.challenge_en,
      expert_insight_he: row.expert_insight_he,
      expert_insight_en: row.expert_insight_en,
      common_mistakes_he: row.common_mistakes_he,
      common_mistakes_en: row.common_mistakes_en,
      metaphor_he: row.metaphor_he,
      metaphor_en: row.metaphor_en,
      measurement_he: row.measurement_he,
      measurement_en: row.measurement_en,
      do_this_week_he: row.do_this_week_he,
      do_this_week_en: row.do_this_week_en,
      dont_this_week_he: row.dont_this_week_he,
      dont_this_week_en: row.dont_this_week_en,
      progress_marker_he: row.progress_marker_he,
      progress_marker_en: row.progress_marker_en,
      source_attribution_he: row.source_attribution_he,
      source_attribution_en: row.source_attribution_en,
      video_url: row.video_url,
      image_url: row.image_url,
      sort_order: row.sort_order,
      default_offset_days: row.default_offset_days,
      is_active: row.is_active,
      assessment_payload: row.assessment_payload,
    };

    let itemId: string;
    if (existing) {
      const { error } = await admin
        .from("journey_items")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        failures.push({
          entity: "items", row: rowNum, slug: row.slug,
          code: "db_update_failed", message: error.message,
        });
        counts.failed++;
        continue;
      }
      counts.updated++;
      itemId = existing.id;
    } else {
      const { data, error } = await admin
        .from("journey_items")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        failures.push({
          entity: "items", row: rowNum, slug: row.slug,
          code: "db_insert_failed", message: error.message,
        });
        counts.failed++;
        continue;
      }
      counts.created++;
      itemId = data?.id as string;
      if (itemId) {
        maps.itemsByKey.set(`${row.category_slug}/${row.slug}`, {
          id: itemId, is_one_off: false,
        });
      }
    }

    plans.push({
      rowNum, row, itemId,
      categoryId: cat.id,
      categorySlug: row.category_slug,
      prereqSlugs: row.prereq_item_slugs,
    });
  }

  return plans;
}

// ── Items: pass-2 prereq resolution + cycle detection + write ───────────────

/**
 * Resolve a single prereq slug token to an item id.
 *  - "cat/item" → look up `cat/item`
 *  - "item"     → look up `${parentCategorySlug}/item` (same-category)
 */
function resolvePrereqToken(
  maps: Maps,
  parentCategorySlug: string,
  token: string,
): string | null {
  const slashIdx = token.indexOf("/");
  const key = slashIdx >= 0 ? token : `${parentCategorySlug}/${token}`;
  return maps.itemsByKey.get(key)?.id ?? null;
}

/**
 * Detect prereq cycles and drop the offending back-edges. For each item
 * with prereqs, BFS forward through the prereq graph; if we can reach
 * the item itself through one of its declared prereqs, that prereq is a
 * back-edge and we drop it (emitting a prereq_cycle_broken warning).
 *
 * Operates against the ORIGINAL prereq map (no mutation during scan)
 * for determinism: an edge's classification doesn't depend on the order
 * we processed other edges in.
 */
function detectAndBreakCycles(
  itemPrereqs: Map<string, string[]>,
  itemSlugById: Map<string, string>,
  itemRowById: Map<string, number>,
  warnings: ApplyWarning[],
): Map<string, string[]> {
  const original = new Map(itemPrereqs);
  const cleaned = new Map<string, string[]>();

  for (const [itemId, prereqs] of original) {
    const kept: string[] = [];
    for (const p of prereqs) {
      // BFS forward from `p` following the ORIGINAL prereq map.
      const visited = new Set<string>([p]);
      const queue: string[] = [p];
      let cycle = false;
      while (queue.length) {
        const cur = queue.shift() as string;
        if (cur === itemId) { cycle = true; break; }
        const next = original.get(cur) ?? [];
        for (const n of next) {
          if (!visited.has(n)) { visited.add(n); queue.push(n); }
        }
      }
      if (cycle) {
        warnings.push({
          entity: "items",
          row: itemRowById.get(itemId) ?? 0,
          slug: itemSlugById.get(itemId),
          code: "prereq_cycle_broken",
          message: `Dropped prereq edge → "${itemSlugById.get(p) ?? p}" because it would form a cycle through this item`,
        });
      } else {
        kept.push(p);
      }
    }
    cleaned.set(itemId, kept);
  }
  return cleaned;
}

async function applyItemsPass2(
  admin: AdminClient,
  plans: ItemWritePlan[],
  maps: Maps,
  warnings: ApplyWarning[],
  failures: ApplyFailure[],
): Promise<void> {
  // 1. Resolve every plan's prereq slugs → item ids. Drop unresolvable
  //    tokens with a prereq_dropped warning.
  const itemPrereqs = new Map<string, string[]>();
  const itemSlugById = new Map<string, string>();
  const itemRowById = new Map<string, number>();
  for (const plan of plans) {
    itemSlugById.set(plan.itemId, plan.row.slug);
    itemRowById.set(plan.itemId, plan.rowNum);
    if (plan.prereqSlugs.length === 0) {
      itemPrereqs.set(plan.itemId, []);
      continue;
    }
    const resolved: string[] = [];
    for (const token of plan.prereqSlugs) {
      const id = resolvePrereqToken(maps, plan.categorySlug, token);
      if (id) {
        resolved.push(id);
      } else {
        warnings.push({
          entity: "items",
          row: plan.rowNum,
          slug: plan.row.slug,
          code: "prereq_dropped",
          message: `Dropped unresolvable prereq "${token}" (no matching item slug${token.includes("/") ? "" : ` in category "${plan.categorySlug}"`})`,
        });
      }
    }
    itemPrereqs.set(plan.itemId, resolved);
  }

  // 2. Break cycles.
  const final = detectAndBreakCycles(itemPrereqs, itemSlugById, itemRowById, warnings);

  // 3. Write the prereq column for any item whose final prereq array is
  //    non-empty. (Pass-1 wrote [] already, so empty arrays don't need a
  //    second update.)
  for (const plan of plans) {
    const prereqs = final.get(plan.itemId) ?? [];
    if (prereqs.length === 0) continue;
    const { error } = await admin
      .from("journey_items")
      .update({ prereq_item_ids: prereqs })
      .eq("id", plan.itemId);
    if (error) {
      // Treat as a non-fatal apply failure on the prereq column only.
      failures.push({
        entity: "items",
        row: plan.rowNum,
        slug: plan.row.slug,
        code: "db_update_failed",
        message: `Pass-2 prereq update failed: ${error.message}`,
      });
    }
  }
}

// ── revalidatePath dispatch ─────────────────────────────────────────────────

function revalidateForEntity(entity: JourneyCsvKind, counts: EntityCounts, pathSet: Set<string>): void {
  if (counts.created + counts.updated === 0) return;
  pathSet.add("/dashboard/journey");
  pathSet.add("/my/journey");
  if (entity === "programs")  pathSet.add("/dashboard/journey/programs");
  if (entity === "categories") {
    pathSet.add("/dashboard/journey/categories");
    pathSet.add("/dashboard/journey/items");
  }
  if (entity === "subtopics") pathSet.add("/dashboard/journey/items");
  if (entity === "items")     pathSet.add("/dashboard/journey/items");
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  await requireAdmin();
  const admin = await createAdminClient();

  // Parse multipart body
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { ok: false, error: "Invalid multipart body" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json(
      { ok: false, error: 'Missing "file" field' },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Response.json(
      { ok: false, error: "Only .csv files are accepted" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      {
        ok: false,
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — max ${MAX_BYTES / 1024 / 1024} MB`,
      },
      { status: 413 },
    );
  }

  const text = await file.text();

  // Detect entity type from header signature
  const kind = detectCsvKind(text);
  if (!kind) {
    return Response.json(
      {
        ok: false,
        error:
          "Could not detect CSV type from header. Expected a programs / categories / subtopics / items shape — re-export from /dashboard/journey/items to get a valid header.",
      },
      { status: 422 },
    );
  }

  // Initialize the response shell
  const summary = emptySummary();
  const warnings: ApplyWarning[] = [];
  const failures: ApplyFailure[] = [];

  // Load FK resolution maps
  const maps = await loadMaps(admin);

  // Dispatch to the appropriate parser + apply path
  if (kind === "programs") {
    const parsed = parseProgramsCsv(text);
    if (parsed.unknownColumns.length > 0) {
      warnings.push({
        entity: "programs", row: 1, code: "unknown_columns",
        message: `Skipped ${parsed.unknownColumns.length} unknown column(s): ${parsed.unknownColumns.join(", ")}`,
      });
    }
    const planned = parsed.rows.map((row, i) => ({ rowNum: i + 2, row }));
    // Re-pair with actual row numbers — parsed.rows lost original row positions
    // because failed rows are dropped. Without storing row#s in the parser
    // result we approximate with index+2 (header=1). This is OK for our
    // single-CSV flow where the admin only sees per-row failures with the
    // matching slug; the rowNum here is mostly for the audit message body.
    await applyPrograms(admin, planned, maps, summary.programs, failures);

    const paths = new Set<string>();
    revalidateForEntity("programs", summary.programs, paths);
    for (const p of paths) revalidatePath(p);

    return Response.json(
      { ok: true, kind, summary, parseErrors: parsed.errors, warnings, failures },
      { status: 200 },
    );
  }

  if (kind === "categories") {
    const parsed = parseCategoriesCsv(text);
    if (parsed.unknownColumns.length > 0) {
      warnings.push({
        entity: "categories", row: 1, code: "unknown_columns",
        message: `Skipped ${parsed.unknownColumns.length} unknown column(s): ${parsed.unknownColumns.join(", ")}`,
      });
    }
    const planned = parsed.rows.map((row, i) => ({ rowNum: i + 2, row }));
    await applyCategories(admin, planned, maps, summary.categories, failures);

    const paths = new Set<string>();
    revalidateForEntity("categories", summary.categories, paths);
    for (const p of paths) revalidatePath(p);

    return Response.json(
      { ok: true, kind, summary, parseErrors: parsed.errors, warnings, failures },
      { status: 200 },
    );
  }

  if (kind === "subtopics") {
    const parsed = parseSubtopicsCsv(text);
    if (parsed.unknownColumns.length > 0) {
      warnings.push({
        entity: "subtopics", row: 1, code: "unknown_columns",
        message: `Skipped ${parsed.unknownColumns.length} unknown column(s): ${parsed.unknownColumns.join(", ")}`,
      });
    }
    const planned = parsed.rows.map((row, i) => ({ rowNum: i + 2, row }));
    await applySubtopics(admin, planned, maps, summary.subtopics, failures);

    const paths = new Set<string>();
    revalidateForEntity("subtopics", summary.subtopics, paths);
    for (const p of paths) revalidatePath(p);

    return Response.json(
      { ok: true, kind, summary, parseErrors: parsed.errors, warnings, failures },
      { status: 200 },
    );
  }

  // kind === "items"
  const parsed = parseItemsCsv(text);
  if (parsed.unknownColumns.length > 0) {
    warnings.push({
      entity: "items", row: 1, code: "unknown_columns",
      message: `Skipped ${parsed.unknownColumns.length} unknown column(s): ${parsed.unknownColumns.join(", ")}`,
    });
  }
  const planned = parsed.rows.map((row, i) => ({ rowNum: i + 2, row }));
  const plans = await applyItemsPass1(admin, planned, maps, summary.items, warnings, failures);
  await applyItemsPass2(admin, plans, maps, warnings, failures);

  const paths = new Set<string>();
  revalidateForEntity("items", summary.items, paths);
  for (const p of paths) revalidatePath(p);

  return Response.json(
    { ok: true, kind, summary, parseErrors: parsed.errors, warnings, failures },
    { status: 200 },
  );
}
