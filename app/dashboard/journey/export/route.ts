/**
 * GET /dashboard/journey/export
 *
 * Returns a ZIP file containing four CSVs:
 *   programs.csv, categories.csv, items.csv, assignments.csv
 *
 * Requires admin auth.
 */
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import { buildZip } from "@/lib/zip-builder";
import {
  buildProgramsCsv,
  buildCategoriesCsv,
  buildItemsCsv,
  buildAssignmentsCsv,
  type ProgramExportRow,
  type CategoryExportRow,
  type ItemExportRow,
  type AssignmentExportRow,
} from "@/lib/csv-journey";

export async function GET() {
  await requireAdmin();
  const admin = await createAdminClient();

  // ── Fetch all four tables in parallel ────────────────────────────────────
  const [progRes, catRes, itemRes, assignRes] = await Promise.all([
    admin
      .from("journey_programs")
      .select("id, slug, name_he, name_en, description_he, description_en, cover_image_url, default_anchor, product_slug, is_active, sort_weight")
      .order("sort_weight", { ascending: true }),

    admin
      .from("journey_categories")
      .select("id, program_id, slug, name_he, name_en, description_he, description_en, sort_order, is_active")
      .order("sort_order", { ascending: true }),

    admin
      .from("journey_items")
      .select("id, category_id, slug, title_he, title_en, body_he, body_en, task_he, task_en, challenge_he, challenge_en, video_url, image_url, sort_order, default_offset_days, is_active")
      .order("sort_order", { ascending: true }),

    admin
      .from("journey_assignments")
      .select("id, user_id, couple_id, source_kind, source_id, anchor_kind, anchor_date, origin, origin_ref, notes, is_active, created_at")
      .order("created_at", { ascending: true }),
  ]);

  if (progRes.error || catRes.error || itemRes.error || assignRes.error) {
    const err = progRes.error ?? catRes.error ?? itemRes.error ?? assignRes.error;
    return new Response(`Export failed: ${err?.message}`, { status: 500 });
  }

  // ── Build CSVs ────────────────────────────────────────────────────────────
  const programsCsv = buildProgramsCsv((progRes.data ?? []) as ProgramExportRow[]);
  const categoriesCsv = buildCategoriesCsv((catRes.data ?? []) as CategoryExportRow[]);
  const itemsCsv = buildItemsCsv((itemRes.data ?? []) as ItemExportRow[]);
  const assignmentsCsv = buildAssignmentsCsv((assignRes.data ?? []) as AssignmentExportRow[]);

  // ── Pack into ZIP ─────────────────────────────────────────────────────────
  const date = new Date().toISOString().slice(0, 10);
  const zip = buildZip([
    { name: "programs.csv",    content: programsCsv },
    { name: "categories.csv",  content: categoriesCsv },
    { name: "items.csv",       content: itemsCsv },
    { name: "assignments.csv", content: assignmentsCsv },
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
