/**
 * CSV utilities for the Journey content system.
 *
 * Export columns (matched to DB schema):
 *
 *   programs.csv
 *     program_id, slug, name_he, name_en, description_he, description_en,
 *     cover_image_url, default_anchor, product_slug, is_active, sort_weight
 *
 *   categories.csv
 *     category_id, program_id, slug, name_he, name_en, description_he,
 *     description_en, sort_order, is_active
 *
 *   items.csv
 *     item_id, category_id, slug, title_he, title_en, body_he, body_en,
 *     task_he, task_en, challenge_he, challenge_en, video_url, image_url,
 *     sort_order, default_offset_days, is_active
 *
 *   assignments.csv  (export only — assignments are import via UI)
 *     assignment_id, owner_key, source_kind, source_id, anchor_kind,
 *     anchor_date, origin, origin_ref, notes, is_active, created_at
 *
 * Import rules
 * ────────────
 * Type auto-detection: first column header determines the entity type.
 *   program_id   → programs import
 *   category_id  → categories import
 *   item_id      → items import
 *   assignment_id → rejected (assignments are insert-only via UI)
 *
 * Row-level:
 *   • first-col ID present → UPDATE existing record
 *   • first-col ID empty   → INSERT new record
 *   • Invalid rows are skipped and collected in the `skipped[]` array
 *
 * Encoding: UTF-8 with BOM (Excel-compatible)
 * Delimiter: comma, quoting: RFC 4180
 */

// ---------------------------------------------------------------------------
// RFC 4180 helpers
// ---------------------------------------------------------------------------

/** Escape a single CSV cell value. */
export function csvEsc(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string (UTF-8 BOM, CRLF) from header + data rows. */
export function buildCsv(
  headers: readonly string[],
  rows: (string | number | boolean | null | undefined)[][],
): string {
  const lines = [
    headers.map(csvEsc).join(","),
    ...rows.map((r) => r.map(csvEsc).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// RFC 4180 parser
// ---------------------------------------------------------------------------

function parseRawCsv(text: string): string[][] {
  const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];
    if (inQ) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i += 2; }
        else { inQ = false; i++; }
      } else { cell += ch; i++; }
    } else {
      if (ch === '"') { inQ = true; i++; }
      else if (ch === ",") { row.push(cell); cell = ""; i++; }
      else if (ch === "\r") {
        row.push(cell); cell = ""; rows.push(row); row = []; i++;
        if (clean[i] === "\n") i++;
      } else if (ch === "\n") {
        row.push(cell); cell = ""; rows.push(row); row = []; i++;
      } else { cell += ch; i++; }
    }
  }

  if (cell || row.length > 0) { row.push(cell); rows.push(row); }
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type CsvSkip = { row: number; field: string; message: string };

export type CsvParseResult<T> =
  | { ok: false; errors: CsvSkip[] }
  | { ok: true; rows: T[]; skipped: CsvSkip[] };

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export const PROGRAM_COLS = [
  "program_id",
  "slug",
  "name_he",
  "name_en",
  "description_he",
  "description_en",
  "cover_image_url",
  "default_anchor",
  "product_slug",
  "is_active",
  "sort_weight",
] as const;

export const CATEGORY_COLS = [
  "category_id",
  "program_id",
  "slug",
  "name_he",
  "name_en",
  "description_he",
  "description_en",
  "sort_order",
  "is_active",
] as const;

export const ITEM_COLS = [
  "item_id",
  "category_id",
  "slug",
  "title_he",
  "title_en",
  "body_he",
  "body_en",
  "task_he",
  "task_en",
  "challenge_he",
  "challenge_en",
  "video_url",
  "image_url",
  "sort_order",
  "default_offset_days",
  "is_active",
] as const;

export const ASSIGNMENT_COLS = [
  "assignment_id",
  "owner_key",
  "source_kind",
  "source_id",
  "anchor_kind",
  "anchor_date",
  "origin",
  "origin_ref",
  "notes",
  "is_active",
  "created_at",
] as const;

// ---------------------------------------------------------------------------
// Export row types (shape coming from DB select)
// ---------------------------------------------------------------------------

export type ProgramExportRow = {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  cover_image_url: string | null;
  default_anchor: string;
  product_slug: string | null;
  is_active: boolean;
  sort_weight: number;
};

export type CategoryExportRow = {
  id: string;
  program_id: string | null;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ItemExportRow = {
  id: string;
  category_id: string;
  slug: string;
  title_he: string;
  title_en: string | null;
  body_he: string;
  body_en: string | null;
  task_he: string | null;
  task_en: string | null;
  challenge_he: string | null;
  challenge_en: string | null;
  video_url: string | null;
  image_url: string | null;
  sort_order: number;
  default_offset_days: number;
  is_active: boolean;
};

export type AssignmentExportRow = {
  id: string;
  user_id: string | null;
  couple_id: string | null;
  source_kind: string;
  source_id: string;
  anchor_kind: string;
  anchor_date: string;
  origin: string;
  origin_ref: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

// ---------------------------------------------------------------------------
// CSV builders (export)
// ---------------------------------------------------------------------------

export function buildProgramsCsv(rows: ProgramExportRow[]): string {
  return buildCsv(
    PROGRAM_COLS,
    rows.map((r) => [
      r.id,
      r.slug,
      r.name_he,
      r.name_en ?? "",
      r.description_he ?? "",
      r.description_en ?? "",
      r.cover_image_url ?? "",
      r.default_anchor,
      r.product_slug ?? "",
      String(r.is_active),
      r.sort_weight,
    ]),
  );
}

export function buildCategoriesCsv(rows: CategoryExportRow[]): string {
  return buildCsv(
    CATEGORY_COLS,
    rows.map((r) => [
      r.id,
      r.program_id ?? "",
      r.slug,
      r.name_he,
      r.name_en ?? "",
      r.description_he ?? "",
      r.description_en ?? "",
      r.sort_order,
      String(r.is_active),
    ]),
  );
}

export function buildItemsCsv(rows: ItemExportRow[]): string {
  return buildCsv(
    ITEM_COLS,
    rows.map((r) => [
      r.id,
      r.category_id,
      r.slug,
      r.title_he,
      r.title_en ?? "",
      r.body_he,
      r.body_en ?? "",
      r.task_he ?? "",
      r.task_en ?? "",
      r.challenge_he ?? "",
      r.challenge_en ?? "",
      r.video_url ?? "",
      r.image_url ?? "",
      r.sort_order,
      r.default_offset_days,
      String(r.is_active),
    ]),
  );
}

export function buildAssignmentsCsv(rows: AssignmentExportRow[]): string {
  return buildCsv(
    ASSIGNMENT_COLS,
    rows.map((r) => [
      r.id,
      // Normalise owner to owner_key format
      r.couple_id ? `couple:${r.couple_id}` : r.user_id ? `user:${r.user_id}` : "",
      r.source_kind,
      r.source_id,
      r.anchor_kind,
      r.anchor_date,
      r.origin,
      r.origin_ref ?? "",
      r.notes ?? "",
      String(r.is_active),
      r.created_at,
    ]),
  );
}

// ---------------------------------------------------------------------------
// Template builders
// ---------------------------------------------------------------------------

export function buildProgramsTemplate(): string {
  return buildCsv(PROGRAM_COLS, [
    [
      "",                        // program_id (empty = INSERT)
      "intimacy-basics",         // slug
      "יסודות האינטימיות",       // name_he
      "Intimacy Basics",         // name_en
      "תוכנית בסיסית לזוגות",    // description_he
      "Intro program for couples", // description_en
      "",                        // cover_image_url
      "assignment",              // default_anchor
      "",                        // product_slug (games | journey | adults | empty)
      "true",                    // is_active
      "0",                       // sort_weight
    ],
    [
      "",
      "deep-connection",
      "חיבור עמוק",
      "Deep Connection",
      "תוכנית לחיבור רגשי עמוק",
      "Emotional depth program",
      "",
      "assignment",
      "journey",
      "false",
      "10",
    ],
  ]);
}

export function buildCategoriesTemplate(): string {
  return buildCsv(CATEGORY_COLS, [
    [
      "",                              // category_id (empty = INSERT)
      "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // program_id (UUID or empty for standalone)
      "week-1-trust",                  // slug
      "שבוע 1 — אמון",                 // name_he
      "Week 1 — Trust",               // name_en
      "בניית אמון בסיסי",              // description_he
      "Building foundational trust",   // description_en
      "0",                             // sort_order
      "true",                          // is_active
    ],
    [
      "",
      "",                              // empty = standalone category (no program)
      "communication-basics",
      "תקשורת בסיסית",
      "Communication Basics",
      "",
      "",
      "1",
      "true",
    ],
  ]);
}

export function buildItemsTemplate(): string {
  return buildCsv(ITEM_COLS, [
    [
      "",                                      // item_id (empty = INSERT)
      "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",  // category_id (REQUIRED)
      "feeling-check-in",                      // slug
      "איך אתה מרגיש עכשיו?",                  // title_he
      "How are you feeling right now?",        // title_en
      "קח רגע לבדוק פנימה...",                 // body_he (markdown)
      "Take a moment to check in...",          // body_en
      "שתף את הפרטנר שלך",                    // task_he
      "Share with your partner",              // task_en
      "",                                      // challenge_he
      "",                                      // challenge_en
      "",                                      // video_url
      "",                                      // image_url
      "0",                                     // sort_order
      "1",                                     // default_offset_days
      "true",                                  // is_active
    ],
    [
      "",
      "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "gratitude-practice",
      "תרגול הכרת תודה",
      "Gratitude Practice",
      "כתוב 3 דברים שאתה מעריך בפרטנר שלך...",
      "Write 3 things you appreciate about your partner...",
      "שתף בקול",
      "Share out loud",
      "שתפו יחד וגלו",
      "Share together and discover",
      "",
      "",
      "1",
      "2",
      "true",
    ],
  ]);
}

// ---------------------------------------------------------------------------
// Import row types (validated data ready for DB write)
// ---------------------------------------------------------------------------

export type ProgramImportRow = {
  program_id: string;  // empty = INSERT
  slug: string;
  name_he: string;
  name_en: string;
  description_he: string;
  description_en: string;
  cover_image_url: string;
  default_anchor: string;
  product_slug: string;
  is_active: boolean;
  sort_weight: number;
};

export type CategoryImportRow = {
  category_id: string; // empty = INSERT
  program_id: string;  // empty = standalone
  slug: string;
  name_he: string;
  name_en: string;
  description_he: string;
  description_en: string;
  sort_order: number;
  is_active: boolean;
};

export type ItemImportRow = {
  item_id: string;     // empty = INSERT
  category_id: string; // REQUIRED
  slug: string;
  title_he: string;
  title_en: string;
  body_he: string;
  body_en: string;
  task_he: string;
  task_en: string;
  challenge_he: string;
  challenge_en: string;
  video_url: string;
  image_url: string;
  sort_order: number;
  default_offset_days: number;
  is_active: boolean;
};

// ---------------------------------------------------------------------------
// Auto-detect entity type from first header column
// ---------------------------------------------------------------------------

export type JourneyCsvKind = "programs" | "categories" | "items";

export function detectCsvKind(text: string): JourneyCsvKind | null {
  const raw = parseRawCsv(text);
  if (raw.length === 0) return null;
  const first = raw[0][0]?.trim().toLowerCase();
  if (first === "program_id") return "programs";
  if (first === "category_id") return "categories";
  if (first === "item_id") return "items";
  return null;
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

const VALID_ANCHORS = new Set(["assignment", "purchase", "fixed"]);
const VALID_PRODUCTS = new Set(["games", "journey", "adults", ""]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseBool(s: string, fallback = true): boolean {
  if (s === "false" || s === "0") return false;
  if (s === "true" || s === "1") return true;
  return fallback;
}

function parseInt10(s: string, fallback = 0): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? fallback : n;
}

export function parseProgramsCsv(text: string): CsvParseResult<ProgramImportRow> {
  const raw = parseRawCsv(text);
  if (raw.length === 0) return { ok: false, errors: [{ row: 0, field: "file", message: "Empty file" }] };

  const [headerRow, ...dataRows] = raw;
  const hdrs = headerRow.map((h) => h.trim().toLowerCase());
  const required = ["program_id", "slug", "name_he"] as const;
  const missing = required.filter((h) => !hdrs.includes(h));
  if (missing.length > 0)
    return { ok: false, errors: [{ row: 1, field: "header", message: `Missing columns: ${missing.join(", ")}` }] };

  const idx = (col: string) => hdrs.indexOf(col);
  const get = (row: string[], col: string) => (row[idx(col)] ?? "").trim();

  const skipped: CsvSkip[] = [];
  const rows: ProgramImportRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rn = r + 2;
    if (row.every((c) => c.trim() === "")) continue;

    const rawId = get(row, "program_id");
    const rawSlug = get(row, "slug");
    const rawNameHe = get(row, "name_he");
    const rawAnchor = get(row, "default_anchor") || "assignment";
    const rawProduct = get(row, "product_slug");

    let err = false;

    if (!rawSlug) { skipped.push({ row: rn, field: "slug", message: "slug is required" }); err = true; }
    if (!rawNameHe) { skipped.push({ row: rn, field: "name_he", message: "name_he is required" }); err = true; }
    if (rawId && !UUID_RE.test(rawId)) { skipped.push({ row: rn, field: "program_id", message: `Invalid UUID: "${rawId}"` }); err = true; }
    if (!VALID_ANCHORS.has(rawAnchor)) { skipped.push({ row: rn, field: "default_anchor", message: `Must be assignment|purchase|fixed (got "${rawAnchor}")` }); err = true; }
    if (!VALID_PRODUCTS.has(rawProduct)) { skipped.push({ row: rn, field: "product_slug", message: `Must be games|journey|adults or empty (got "${rawProduct}")` }); err = true; }

    if (err) continue;

    rows.push({
      program_id: rawId,
      slug: rawSlug,
      name_he: rawNameHe,
      name_en: get(row, "name_en"),
      description_he: get(row, "description_he"),
      description_en: get(row, "description_en"),
      cover_image_url: get(row, "cover_image_url"),
      default_anchor: rawAnchor,
      product_slug: rawProduct,
      is_active: parseBool(get(row, "is_active")),
      sort_weight: parseInt10(get(row, "sort_weight")),
    });
  }

  return { ok: true, rows, skipped };
}

export function parseCategoriesCsv(text: string): CsvParseResult<CategoryImportRow> {
  const raw = parseRawCsv(text);
  if (raw.length === 0) return { ok: false, errors: [{ row: 0, field: "file", message: "Empty file" }] };

  const [headerRow, ...dataRows] = raw;
  const hdrs = headerRow.map((h) => h.trim().toLowerCase());
  const required = ["category_id", "slug", "name_he"] as const;
  const missing = required.filter((h) => !hdrs.includes(h));
  if (missing.length > 0)
    return { ok: false, errors: [{ row: 1, field: "header", message: `Missing columns: ${missing.join(", ")}` }] };

  const idx = (col: string) => hdrs.indexOf(col);
  const get = (row: string[], col: string) => (row[idx(col)] ?? "").trim();

  const skipped: CsvSkip[] = [];
  const rows: CategoryImportRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rn = r + 2;
    if (row.every((c) => c.trim() === "")) continue;

    const rawId = get(row, "category_id");
    const rawProgId = get(row, "program_id");
    const rawSlug = get(row, "slug");
    const rawNameHe = get(row, "name_he");

    let err = false;
    if (!rawSlug) { skipped.push({ row: rn, field: "slug", message: "slug is required" }); err = true; }
    if (!rawNameHe) { skipped.push({ row: rn, field: "name_he", message: "name_he is required" }); err = true; }
    if (rawId && !UUID_RE.test(rawId)) { skipped.push({ row: rn, field: "category_id", message: `Invalid UUID: "${rawId}"` }); err = true; }
    if (rawProgId && !UUID_RE.test(rawProgId)) { skipped.push({ row: rn, field: "program_id", message: `Invalid UUID: "${rawProgId}"` }); err = true; }

    if (err) continue;

    rows.push({
      category_id: rawId,
      program_id: rawProgId,
      slug: rawSlug,
      name_he: rawNameHe,
      name_en: get(row, "name_en"),
      description_he: get(row, "description_he"),
      description_en: get(row, "description_en"),
      sort_order: parseInt10(get(row, "sort_order")),
      is_active: parseBool(get(row, "is_active")),
    });
  }

  return { ok: true, rows, skipped };
}

export function parseItemsCsv(text: string): CsvParseResult<ItemImportRow> {
  const raw = parseRawCsv(text);
  if (raw.length === 0) return { ok: false, errors: [{ row: 0, field: "file", message: "Empty file" }] };

  const [headerRow, ...dataRows] = raw;
  const hdrs = headerRow.map((h) => h.trim().toLowerCase());
  const required = ["item_id", "category_id", "slug", "title_he", "body_he"] as const;
  const missing = required.filter((h) => !hdrs.includes(h));
  if (missing.length > 0)
    return { ok: false, errors: [{ row: 1, field: "header", message: `Missing columns: ${missing.join(", ")}` }] };

  const idx = (col: string) => hdrs.indexOf(col);
  const get = (row: string[], col: string) => (row[idx(col)] ?? "").trim();

  const skipped: CsvSkip[] = [];
  const rows: ItemImportRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rn = r + 2;
    if (row.every((c) => c.trim() === "")) continue;

    const rawId = get(row, "item_id");
    const rawCatId = get(row, "category_id");
    const rawSlug = get(row, "slug");
    const rawTitleHe = get(row, "title_he");
    const rawBodyHe = get(row, "body_he");

    let err = false;
    if (!rawCatId) { skipped.push({ row: rn, field: "category_id", message: "category_id is required" }); err = true; }
    else if (!UUID_RE.test(rawCatId)) { skipped.push({ row: rn, field: "category_id", message: `Invalid UUID: "${rawCatId}"` }); err = true; }
    if (!rawSlug) { skipped.push({ row: rn, field: "slug", message: "slug is required" }); err = true; }
    if (!rawTitleHe) { skipped.push({ row: rn, field: "title_he", message: "title_he is required" }); err = true; }
    if (!rawBodyHe) { skipped.push({ row: rn, field: "body_he", message: "body_he is required" }); err = true; }
    if (rawId && !UUID_RE.test(rawId)) { skipped.push({ row: rn, field: "item_id", message: `Invalid UUID: "${rawId}"` }); err = true; }

    if (err) continue;

    rows.push({
      item_id: rawId,
      category_id: rawCatId,
      slug: rawSlug,
      title_he: rawTitleHe,
      title_en: get(row, "title_en"),
      body_he: rawBodyHe,
      body_en: get(row, "body_en"),
      task_he: get(row, "task_he"),
      task_en: get(row, "task_en"),
      challenge_he: get(row, "challenge_he"),
      challenge_en: get(row, "challenge_en"),
      video_url: get(row, "video_url"),
      image_url: get(row, "image_url"),
      sort_order: parseInt10(get(row, "sort_order")),
      default_offset_days: parseInt10(get(row, "default_offset_days")),
      is_active: parseBool(get(row, "is_active")),
    });
  }

  return { ok: true, rows, skipped };
}
