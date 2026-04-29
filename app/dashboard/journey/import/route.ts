/**
 * POST /dashboard/journey/import
 *
 * Accepts a single CSV file (multipart/form-data, field name: "file").
 * Auto-detects entity type from the first header column:
 *   program_id   → programs
 *   category_id  → categories
 *   item_id      → items
 *
 * For each valid row:
 *   • row ID present → UPDATE existing record
 *   • row ID empty   → INSERT new record
 *
 * Returns JSON ImportResult.
 *
 * Notes:
 *   • Assignments import is not supported here — create them via the UI so
 *     scheduled-item materialization runs correctly.
 *   • Row-level errors are collected and returned; they do NOT abort the import.
 *   • All writes use the Supabase service-role client (bypasses RLS).
 */
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  detectCsvKind,
  parseProgramsCsv,
  parseCategoriesCsv,
  parseItemsCsv,
  type CsvSkip,
  type ProgramImportRow,
  type CategoryImportRow,
  type ItemImportRow,
} from "@/lib/csv-journey";
import { revalidatePath } from "next/cache";

// ── Response shape ──────────────────────────────────────────────────────────

export type JourneyImportSummary = {
  kind: "programs" | "categories" | "items";
  total: number;
  created: number;
  updated: number;
  failed: number;
  skipped: CsvSkip[];
};

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  await requireAdmin();
  const admin = await createAdminClient();

  // Parse multipart body
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Missing "file" field' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Response.json({ error: "Only .csv files are accepted" }, { status: 400 });
  }

  const text = await file.text();

  // Auto-detect type
  const kind = detectCsvKind(text);
  if (!kind) {
    return Response.json(
      {
        error:
          "Cannot detect CSV type. The first column header must be program_id, category_id, or item_id.",
      },
      { status: 422 },
    );
  }

  // ── Dispatch to appropriate importer ────────────────────────────────────
  switch (kind) {
    case "programs":
      return handleProgramsImport(text, admin);
    case "categories":
      return handleCategoriesImport(text, admin);
    case "items":
      return handleItemsImport(text, admin);
  }
}

// ── Programs ─────────────────────────────────────────────────────────────────

async function handleProgramsImport(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<Response> {
  const parsed = parseProgramsCsv(text);
  if (!parsed.ok)
    return Response.json({ error: "CSV error", details: parsed.errors }, { status: 422 });

  const { rows, skipped } = parsed;
  let created = 0;
  let updated = 0;
  const dbErrors: CsvSkip[] = [];

  const toInsert = rows.filter((r) => !r.program_id);
  const toUpdate = rows.filter((r) => !!r.program_id);

  // Inserts
  if (toInsert.length > 0) {
    const payload = toInsert.map(programPayload);
    const { error } = await admin.from("journey_programs").insert(payload);
    if (error) {
      // Fallback to row-by-row
      for (const r of toInsert) {
        const { error: e } = await admin.from("journey_programs").insert(programPayload(r));
        if (e) dbErrors.push({ row: 0, field: "db", message: `INSERT "${r.slug}": ${e.message}` });
        else created++;
      }
    } else {
      created = toInsert.length;
    }
  }

  // Updates
  for (const r of toUpdate) {
    const { error } = await admin
      .from("journey_programs")
      .update(programPayload(r))
      .eq("id", r.program_id);
    if (error) dbErrors.push({ row: 0, field: "db", message: `UPDATE ${r.program_id}: ${error.message}` });
    else updated++;
  }

  if (created > 0 || updated > 0) {
    revalidatePath("/dashboard/journey");
    revalidatePath("/dashboard/journey/programs");
  }

  const summary: JourneyImportSummary = {
    kind: "programs",
    total: rows.length + skipped.length,
    created,
    updated,
    failed: skipped.length + dbErrors.length,
    skipped: [...skipped, ...dbErrors],
  };
  return Response.json(summary, { status: 200 });
}

function programPayload(r: ProgramImportRow) {
  return {
    slug: r.slug,
    name_he: r.name_he,
    name_en: r.name_en || null,
    description_he: r.description_he || null,
    description_en: r.description_en || null,
    cover_image_url: r.cover_image_url || null,
    default_anchor: r.default_anchor,
    product_slug: r.product_slug || null,
    is_active: r.is_active,
    sort_weight: r.sort_weight,
  };
}

// ── Categories ────────────────────────────────────────────────────────────────

async function handleCategoriesImport(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<Response> {
  const parsed = parseCategoriesCsv(text);
  if (!parsed.ok)
    return Response.json({ error: "CSV error", details: parsed.errors }, { status: 422 });

  const { rows, skipped } = parsed;

  // Pre-load program IDs to validate foreign keys
  const programIdsNeeded = Array.from(new Set(rows.map((r) => r.program_id).filter(Boolean)));
  const existingProgramIds = new Set<string>();
  if (programIdsNeeded.length > 0) {
    const { data } = await admin
      .from("journey_programs")
      .select("id")
      .in("id", programIdsNeeded);
    ((data ?? []) as Array<{ id: string }>).forEach((p) => existingProgramIds.add(p.id));
  }

  let created = 0;
  let updated = 0;
  const dbErrors: CsvSkip[] = [];

  for (const r of rows) {
    // Validate program_id exists if provided
    if (r.program_id && !existingProgramIds.has(r.program_id)) {
      skipped.push({
        row: 0,
        field: "program_id",
        message: `Program not found: ${r.program_id} (slug "${r.slug}")`,
      });
      continue;
    }

    const payload = categoryPayload(r);

    if (r.category_id) {
      const { error } = await admin
        .from("journey_categories")
        .update(payload)
        .eq("id", r.category_id);
      if (error) dbErrors.push({ row: 0, field: "db", message: `UPDATE ${r.category_id}: ${error.message}` });
      else updated++;
    } else {
      const { error } = await admin.from("journey_categories").insert(payload);
      if (error) dbErrors.push({ row: 0, field: "db", message: `INSERT "${r.slug}": ${error.message}` });
      else created++;
    }
  }

  if (created > 0 || updated > 0) {
    revalidatePath("/dashboard/journey");
    revalidatePath("/dashboard/journey/categories");
  }

  const summary: JourneyImportSummary = {
    kind: "categories",
    total: rows.length + skipped.length,
    created,
    updated,
    failed: skipped.length + dbErrors.length,
    skipped: [...skipped, ...dbErrors],
  };
  return Response.json(summary, { status: 200 });
}

function categoryPayload(r: CategoryImportRow) {
  return {
    program_id: r.program_id || null,
    slug: r.slug,
    name_he: r.name_he,
    name_en: r.name_en || null,
    description_he: r.description_he || null,
    description_en: r.description_en || null,
    sort_order: r.sort_order,
    is_active: r.is_active,
  };
}

// ── Items ─────────────────────────────────────────────────────────────────────

async function handleItemsImport(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<Response> {
  const parsed = parseItemsCsv(text);
  if (!parsed.ok)
    return Response.json({ error: "CSV error", details: parsed.errors }, { status: 422 });

  const { rows, skipped } = parsed;

  // Pre-load category IDs to validate foreign keys
  const catIdsNeeded = Array.from(new Set(rows.map((r) => r.category_id)));
  const existingCatIds = new Set<string>();
  if (catIdsNeeded.length > 0) {
    const { data } = await admin
      .from("journey_categories")
      .select("id")
      .in("id", catIdsNeeded);
    ((data ?? []) as Array<{ id: string }>).forEach((c) => existingCatIds.add(c.id));
  }

  let created = 0;
  let updated = 0;
  const dbErrors: CsvSkip[] = [];
  const toInsert: ItemImportRow[] = [];
  const toUpdate: ItemImportRow[] = [];

  for (const r of rows) {
    if (!existingCatIds.has(r.category_id)) {
      skipped.push({
        row: 0,
        field: "category_id",
        message: `Category not found: ${r.category_id} (slug "${r.slug}")`,
      });
      continue;
    }
    if (r.item_id) toUpdate.push(r);
    else toInsert.push(r);
  }

  // Batch inserts
  if (toInsert.length > 0) {
    const payload = toInsert.map(itemPayload);
    const { error } = await admin.from("journey_items").insert(payload);
    if (error) {
      for (const r of toInsert) {
        const { error: e } = await admin.from("journey_items").insert(itemPayload(r));
        if (e) dbErrors.push({ row: 0, field: "db", message: `INSERT "${r.slug}": ${e.message}` });
        else created++;
      }
    } else {
      created = toInsert.length;
    }
  }

  // Updates (sequential — each needs its own .eq())
  for (const r of toUpdate) {
    const { error } = await admin
      .from("journey_items")
      .update(itemPayload(r))
      .eq("id", r.item_id);
    if (error) dbErrors.push({ row: 0, field: "db", message: `UPDATE ${r.item_id}: ${error.message}` });
    else updated++;
  }

  if (created > 0 || updated > 0) {
    revalidatePath("/dashboard/journey");
    revalidatePath("/dashboard/journey/items");
  }

  const summary: JourneyImportSummary = {
    kind: "items",
    total: rows.length + skipped.length,
    created,
    updated,
    failed: skipped.length + dbErrors.length,
    skipped: [...skipped, ...dbErrors],
  };
  return Response.json(summary, { status: 200 });
}

function itemPayload(r: ItemImportRow) {
  return {
    category_id: r.category_id,
    slug: r.slug,
    title_he: r.title_he,
    title_en: r.title_en || null,
    body_he: r.body_he,
    body_en: r.body_en || null,
    task_he: r.task_he || null,
    task_en: r.task_en || null,
    challenge_he: r.challenge_he || null,
    challenge_en: r.challenge_en || null,
    video_url: r.video_url || null,
    image_url: r.image_url || null,
    sort_order: r.sort_order,
    default_offset_days: r.default_offset_days,
    is_active: r.is_active,
  };
}
