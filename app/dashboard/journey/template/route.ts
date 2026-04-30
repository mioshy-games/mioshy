/**
 * GET /dashboard/journey/template
 *
 * Returns a ZIP file with three import-ready CSV templates:
 *   programs_template.csv, categories_template.csv, items_template.csv
 *
 * Assignments are intentionally excluded - they should be created via the UI.
 * Requires admin auth.
 */
import { requireAdmin } from "@/lib/auth/admin";
import { buildZip } from "@/lib/zip-builder";
import {
  buildProgramsTemplate,
  buildCategoriesTemplate,
  buildItemsTemplate,
} from "@/lib/csv-journey";

export async function GET() {
  await requireAdmin();

  const zip = buildZip([
    { name: "programs_template.csv",   content: buildProgramsTemplate() },
    { name: "categories_template.csv", content: buildCategoriesTemplate() },
    { name: "items_template.csv",      content: buildItemsTemplate() },
  ]);

  return new Response(zip.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="journey_import_templates.zip"',
      "cache-control": "no-store",
    },
  });
}
