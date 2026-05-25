/**
 * CSV utilities for the Journey content system.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPORT side (Phase 1 — modernized, slug-keyed)
 * ─────────────────────────────────────────────────────────────────────────────
 * The export builders below emit CSVs keyed by SLUG, never UUID, so a dev
 * export can be re-imported into prod without primary-key collisions. UUIDs
 * never appear in the user-facing CSV. Slug uniqueness:
 *   - programs.slug              — global (UNIQUE)
 *   - categories.slug            — unique per program (or per standalone set)
 *   - subtopics.slug             — unique per category
 *   - items.slug                 — unique per category
 *
 * Files emitted:
 *
 *   programs.csv     (slug-keyed, no id column)
 *     slug, name_he, name_en, description_he, description_en,
 *     cover_image_url, default_anchor, product_slug, is_active, sort_weight
 *
 *   categories.csv   (slug-keyed, no id/program_id columns)
 *     program_slug, slug, name_he, name_en, description_he, description_en,
 *     sort_order, is_active
 *
 *   subtopics.csv    (new — added in Phase 1)
 *     category_slug, program_slug, slug, name_he, name_en,
 *     description_he, description_en, sort_order, is_active
 *
 *   items.csv        (40 columns — covers schema through migration 080;
 *                     is_one_off rows are filtered out at the query layer)
 *     category_slug, program_slug, subtopic_slug, slug,
 *     title_he, title_en,
 *     stage, content_type, audience, kind, est_minutes,
 *     tags, prereq_item_slugs,
 *     body_he, body_en, task_he, task_en, challenge_he, challenge_en,
 *     expert_insight_he, expert_insight_en,
 *     common_mistakes_he, common_mistakes_en,
 *     metaphor_he, metaphor_en,
 *     measurement_he, measurement_en,
 *     do_this_week_he, do_this_week_en,
 *     dont_this_week_he, dont_this_week_en,
 *     progress_marker_he, progress_marker_en,
 *     source_attribution_he, source_attribution_en,
 *     video_url, image_url,
 *     sort_order, default_offset_days, is_active,
 *     assessment_payload_json
 *
 * Cell encoding for compound fields:
 *   • tags / prereq_item_slugs → pipe-joined ("focus|discovery")
 *   • assessment_payload_json  → JSON.stringify(payload) or "" when null
 *   • booleans                 → "true" / "false"
 *   • nulls                    → ""  (empty string, unquoted)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORT side (legacy — not yet migrated to slug-keyed format)
 * ─────────────────────────────────────────────────────────────────────────────
 * The parsers + import row types below still operate on the OLD UUID-keyed
 * format. They are wired into /dashboard/journey/import/route.ts (untouched
 * in Phase 1). Phase 2 will rewrite them to match the new export schema.
 *
 * Legacy auto-detection (still in effect for the old import flow):
 *   program_id   → programs import
 *   category_id  → categories import
 *   item_id      → items import
 *   assignment_id → rejected (assignments are insert-only via UI)
 *
 * Encoding (both directions): UTF-8 with BOM, CRLF line endings, RFC 4180.
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

// ──────────────────────────────────────────────────────────────────────────
// Export column lists — slug-keyed, no UUIDs in user-facing CSVs.
// Order matters: builders below emit cells in this exact order.
// ──────────────────────────────────────────────────────────────────────────

export const PROGRAM_COLS = [
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
  "program_slug",
  "slug",
  "name_he",
  "name_en",
  "description_he",
  "description_en",
  "sort_order",
  "is_active",
] as const;

// Subtopic schema added by migration 054. program_slug is echoed (resolved
// via the subtopic's category → program chain) so the row is unambiguous
// even when the same category_slug exists under multiple programs.
export const SUBTOPIC_COLS = [
  "category_slug",
  "program_slug",
  "slug",
  "name_he",
  "name_en",
  "description_he",
  "description_en",
  "sort_order",
  "is_active",
] as const;

// 40 columns — matches the Phase 1 spec exactly. Covers every user-editable
// column on journey_items through migration 080. `is_one_off` rows are
// filtered out at the query layer and intentionally omitted from this list.
export const ITEM_COLS = [
  "category_slug",
  "program_slug",
  "subtopic_slug",
  "slug",
  "title_he",
  "title_en",
  "stage",
  "content_type",
  "audience",
  "kind",
  "est_minutes",
  "tags",
  "prereq_item_slugs",
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
  "assessment_payload_json",
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

/**
 * Shape returned by the export route's SELECT on `journey_programs`.
 * `id` is retained internally so the route can build a program-id→slug
 * map for resolving FKs on the category/subtopic rows; it is NOT emitted
 * to the CSV.
 */
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

/**
 * Shape from `journey_categories`. `id` + `program_id` are retained for
 * map construction; only `program_slug` is emitted to the CSV.
 */
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

/**
 * Shape from `journey_subtopics` (migration 054). `id` + `category_id`
 * are retained for map construction; the CSV emits `category_slug` and
 * `program_slug` (resolved via the category's program).
 */
export type SubtopicExportRow = {
  id: string;
  category_id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
};

/**
 * Shape from `journey_items`. Covers every user-editable column through
 * migration 080. The UUID columns (`id`, `category_id`, `subtopic_id`,
 * `prereq_item_ids`) are retained for slug resolution at build time and
 * never emitted directly to the CSV.
 */
export type ItemExportRow = {
  // Internal — never emitted
  id: string;
  category_id: string;
  subtopic_id: string | null;
  prereq_item_ids: string[] | null;
  // Identification
  slug: string;
  // Title
  title_he: string;
  title_en: string | null;
  // Classification (migrations 044, 050, 054, 077)
  stage: number | null;
  content_type: string;
  audience: "both" | "owner" | "partner";
  kind: "content" | "assessment" | "reflection";
  est_minutes: number | null;
  tags: string[] | null;
  // Legacy body / task / challenge
  body_he: string;
  body_en: string | null;
  task_he: string | null;
  task_en: string | null;
  challenge_he: string | null;
  challenge_en: string | null;
  // Lesson blocks (migration 077)
  expert_insight_he: string | null;
  expert_insight_en: string | null;
  common_mistakes_he: string | null;
  common_mistakes_en: string | null;
  metaphor_he: string | null;
  metaphor_en: string | null;
  measurement_he: string | null;
  measurement_en: string | null;
  do_this_week_he: string | null;
  do_this_week_en: string | null;
  dont_this_week_he: string | null;
  dont_this_week_en: string | null;
  progress_marker_he: string | null;
  progress_marker_en: string | null;
  source_attribution_he: string | null;
  source_attribution_en: string | null;
  // Media
  video_url: string | null;
  image_url: string | null;
  // Ordering / flags
  sort_order: number;
  default_offset_days: number;
  is_active: boolean;
  // Structured payload for kind = 'assessment' | 'reflection' (migration 050)
  assessment_payload: unknown | null;
};

// ────────────────────────────────────────────────────────────────────────
// Lookup maps the builders accept for slug resolution. The export route
// is responsible for materializing these from its SELECTs and passing
// them in; this keeps the builders pure (testable).
// ────────────────────────────────────────────────────────────────────────

/** category id → { slug, program_slug ("" if standalone) } */
export type CategoryLookup = Map<string, { slug: string; program_slug: string }>;

/** subtopic id → { slug } */
export type SubtopicLookup = Map<string, { slug: string }>;

/** item id → slug (for prereq_item_ids resolution) */
export type ItemSlugLookup = Map<string, string>;

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

/**
 * Build categories.csv. `programSlugById` resolves the FK to the
 * human-readable slug; standalone categories (program_id NULL) emit
 * an empty `program_slug` cell.
 */
export function buildCategoriesCsv(
  rows: CategoryExportRow[],
  programSlugById: Map<string, string>,
): string {
  return buildCsv(
    CATEGORY_COLS,
    rows.map((r) => [
      r.program_id ? (programSlugById.get(r.program_id) ?? "") : "",
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

/**
 * Build subtopics.csv. Resolves category_slug + program_slug via the
 * `categoryById` lookup the export route builds from journey_categories.
 * If the parent category can't be resolved (shouldn't happen — FK is
 * NOT NULL with ON DELETE RESTRICT) the row emits empty slugs so the
 * export doesn't crash; the row is still inspectable in the CSV.
 */
export function buildSubtopicsCsv(
  rows: SubtopicExportRow[],
  categoryById: CategoryLookup,
): string {
  return buildCsv(
    SUBTOPIC_COLS,
    rows.map((r) => {
      const cat = categoryById.get(r.category_id);
      return [
        cat?.slug ?? "",
        cat?.program_slug ?? "",
        r.slug,
        r.name_he,
        r.name_en ?? "",
        r.description_he ?? "",
        r.description_en ?? "",
        r.sort_order,
        String(r.is_active),
      ];
    }),
  );
}

/**
 * Build items.csv with full slug resolution:
 *   - category_id → category_slug + program_slug (via categoryById)
 *   - subtopic_id → subtopic_slug             (via subtopicById)
 *   - prereq_item_ids[] → prereq_item_slugs   (via itemSlugById, pipe-joined)
 *
 * Unresolvable prereq UUIDs are dropped silently per Phase 1 spec —
 * we never fail the export for a stale prereq reference.
 *
 * `tags` is pipe-joined to survive Excel without parsing JSON.
 * `assessment_payload_json` is JSON.stringify(payload) when present,
 * empty string otherwise. NULL columns emit empty strings.
 */
export function buildItemsCsv(
  rows: ItemExportRow[],
  categoryById: CategoryLookup,
  subtopicById: SubtopicLookup,
  itemSlugById: ItemSlugLookup,
): string {
  return buildCsv(
    ITEM_COLS,
    rows.map((r) => {
      const cat = categoryById.get(r.category_id);
      const sub = r.subtopic_id ? subtopicById.get(r.subtopic_id) : null;
      const prereqSlugs = (r.prereq_item_ids ?? [])
        .map((id) => itemSlugById.get(id))
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .join("|");
      const tagsCell = (r.tags ?? []).join("|");
      const payloadCell =
        r.assessment_payload == null ? "" : JSON.stringify(r.assessment_payload);

      return [
        cat?.slug ?? "",
        cat?.program_slug ?? "",
        sub?.slug ?? "",
        r.slug,
        r.title_he,
        r.title_en ?? "",
        r.stage == null ? "" : r.stage,
        r.content_type,
        r.audience,
        r.kind,
        r.est_minutes == null ? "" : r.est_minutes,
        tagsCell,
        prereqSlugs,
        r.body_he,
        r.body_en ?? "",
        r.task_he ?? "",
        r.task_en ?? "",
        r.challenge_he ?? "",
        r.challenge_en ?? "",
        r.expert_insight_he ?? "",
        r.expert_insight_en ?? "",
        r.common_mistakes_he ?? "",
        r.common_mistakes_en ?? "",
        r.metaphor_he ?? "",
        r.metaphor_en ?? "",
        r.measurement_he ?? "",
        r.measurement_en ?? "",
        r.do_this_week_he ?? "",
        r.do_this_week_en ?? "",
        r.dont_this_week_he ?? "",
        r.dont_this_week_en ?? "",
        r.progress_marker_he ?? "",
        r.progress_marker_en ?? "",
        r.source_attribution_he ?? "",
        r.source_attribution_en ?? "",
        r.video_url ?? "",
        r.image_url ?? "",
        r.sort_order,
        r.default_offset_days,
        String(r.is_active),
        payloadCell,
      ];
    }),
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

// ──────────────────────────────────────────────────────────────────────────
// Templates — headers + one blank row per Phase 1 spec. Admins use these
// to author new content offline. The blank placeholder row ensures Excel
// renders the header row correctly and gives admins a row to type into.
// ──────────────────────────────────────────────────────────────────────────

function blankRow(cols: readonly string[]): string[] {
  return cols.map(() => "");
}

export function buildProgramsTemplate(): string {
  return buildCsv(PROGRAM_COLS, [blankRow(PROGRAM_COLS)]);
}

export function buildCategoriesTemplate(): string {
  return buildCsv(CATEGORY_COLS, [blankRow(CATEGORY_COLS)]);
}

export function buildSubtopicsTemplate(): string {
  return buildCsv(SUBTOPIC_COLS, [blankRow(SUBTOPIC_COLS)]);
}

export function buildItemsTemplate(): string {
  return buildCsv(ITEM_COLS, [blankRow(ITEM_COLS)]);
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
  audience: "both" | "owner" | "partner"; // missing column → 'both'
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

    // audience: optional column; missing/blank → 'both'. Any other value
    // is rejected so a typo doesn't silently mark content as the wrong
    // partner.
    const rawAudience = get(row, "audience").toLowerCase();
    let audience: "both" | "owner" | "partner";
    if (rawAudience === "" || rawAudience === "both") {
      audience = "both";
    } else if (rawAudience === "owner" || rawAudience === "partner") {
      audience = rawAudience;
    } else {
      skipped.push({
        row: rn,
        field: "audience",
        message: `Must be both|owner|partner (got "${rawAudience}")`,
      });
      continue;
    }

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
      audience,
    });
  }

  return { ok: true, rows, skipped };
}
