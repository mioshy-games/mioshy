/**
 * GET /dashboard/journey/export
 *
 * Returns a ZIP file containing four catalog CSVs:
 *   programs.csv, categories.csv, subtopics.csv, items.csv
 *
 * Slug-keyed throughout — UUIDs never appear in the user-facing CSV — so a
 * dev export can be re-imported into prod without primary-key collisions.
 *
 * Scope:
 *   • Catalog only (programs / categories / subtopics / items). Assignments
 *     and scheduled_items are per-user state and are excluded by design.
 *   • Per-couple ad-hoc lessons (items.is_one_off = true, migration 080)
 *     are filtered out; they are not catalog content.
 *
 * Requires admin auth.
 */
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import { buildZip } from "@/lib/zip-builder";
import {
  buildProgramsCsv,
  buildCategoriesCsv,
  buildSubtopicsCsv,
  buildItemsCsv,
  type ProgramExportRow,
  type CategoryExportRow,
  type SubtopicExportRow,
  type ItemExportRow,
  type CategoryLookup,
  type SubtopicLookup,
  type ItemSlugLookup,
} from "@/lib/csv-journey";

export async function GET() {
  await requireAdmin();
  const admin = await createAdminClient();

  // ── Fetch all four catalog tables in parallel ─────────────────────────────
  // Items: we filter is_one_off = false at the query layer. `.or(...)` covers
  // pre-080 rows where the column literally doesn't exist yet (defaults to
  // false, but guards against any odd NULL slip-through).
  const [progRes, catRes, subRes, itemRes] = await Promise.all([
    admin
      .from("journey_programs")
      .select(
        "id, slug, name_he, name_en, description_he, description_en, cover_image_url, default_anchor, product_slug, is_active, sort_weight",
      )
      .order("sort_weight", { ascending: false })
      .order("slug", { ascending: true }),

    admin
      .from("journey_categories")
      .select(
        "id, program_id, slug, name_he, name_en, description_he, description_en, sort_order, is_active",
      )
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true }),

    admin
      .from("journey_subtopics")
      .select(
        "id, category_id, slug, name_he, name_en, description_he, description_en, sort_order, is_active",
      )
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true }),

    admin
      .from("journey_items")
      .select(
        [
          "id",
          "category_id",
          "subtopic_id",
          "prereq_item_ids",
          "slug",
          "title_he",
          "title_en",
          "stage",
          "content_type",
          "audience",
          "kind",
          "est_minutes",
          "tags",
          "body_he",
          "body_en",
          "task_he",
          "task_en",
          "challenge_he",
          "challenge_en",
          "expert_insight_he",
          "expert_insight_en",
          "common_mistakes_he",
          "common_mistakes_en",
          "metaphor_he",
          "metaphor_en",
          "measurement_he",
          "measurement_en",
          "do_this_week_he",
          "do_this_week_en",
          "dont_this_week_he",
          "dont_this_week_en",
          "progress_marker_he",
          "progress_marker_en",
          "source_attribution_he",
          "source_attribution_en",
          "video_url",
          "image_url",
          "sort_order",
          "default_offset_days",
          "is_active",
          "assessment_payload",
        ].join(", "),
      )
      // Filter out per-couple ad-hoc lessons (migration 080). The is.false
      // predicate matches both literal false rows and pre-080 rows where
      // the column default takes effect.
      .or("is_one_off.is.false,is_one_off.is.null")
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true }),
  ]);

  if (progRes.error || catRes.error || subRes.error || itemRes.error) {
    const err =
      progRes.error ?? catRes.error ?? subRes.error ?? itemRes.error;
    return new Response(`Export failed: ${err?.message}`, { status: 500 });
  }

  const programs = (progRes.data ?? []) as ProgramExportRow[];
  const categories = (catRes.data ?? []) as CategoryExportRow[];
  const subtopics = (subRes.data ?? []) as SubtopicExportRow[];
  const items = (itemRes.data ?? []) as ItemExportRow[];

  // ── Build slug-resolution maps ────────────────────────────────────────────
  // programs: id → slug
  const programSlugById = new Map<string, string>();
  for (const p of programs) programSlugById.set(p.id, p.slug);

  // categories: id → { slug, program_slug ("" when standalone) }
  const categoryById: CategoryLookup = new Map();
  for (const c of categories) {
    categoryById.set(c.id, {
      slug: c.slug,
      program_slug: c.program_id
        ? (programSlugById.get(c.program_id) ?? "")
        : "",
    });
  }

  // subtopics: id → { slug } (program/category lookup happens via category map)
  const subtopicById: SubtopicLookup = new Map();
  for (const s of subtopics) subtopicById.set(s.id, { slug: s.slug });

  // items: id → slug (for prereq_item_ids resolution)
  const itemSlugById: ItemSlugLookup = new Map();
  for (const it of items) itemSlugById.set(it.id, it.slug);

  // ── Build CSVs ────────────────────────────────────────────────────────────
  const programsCsv = buildProgramsCsv(programs);
  const categoriesCsv = buildCategoriesCsv(categories, programSlugById);
  const subtopicsCsv = buildSubtopicsCsv(subtopics, categoryById);
  const itemsCsv = buildItemsCsv(
    items,
    categoryById,
    subtopicById,
    itemSlugById,
  );

  // ── Pack into ZIP ─────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10);
  const zip = buildZip([
    { name: "programs.csv",   content: programsCsv },
    { name: "categories.csv", content: categoriesCsv },
    { name: "subtopics.csv",  content: subtopicsCsv },
    { name: "items.csv",      content: itemsCsv },
  ]);

  return new Response(zip.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="journey_export_${date}.zip"`,
      "cache-control": "no-store",
    },
  });
}
