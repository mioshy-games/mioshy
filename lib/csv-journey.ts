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
 *   items.csv        (41 columns — covers schema through migration 080;
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
 * IMPORT side (Phase 2 — slug-keyed parsers, CSV-only)
 * ─────────────────────────────────────────────────────────────────────────────
 * The parsers below consume exactly what the build* functions above emit.
 * They return a tagged ParseResult with three buckets:
 *
 *   - rows[]            : successfully parsed + validated rows
 *   - errors[]          : per-row validation failures (row excluded from rows[])
 *   - unknownColumns[]  : header columns the parser didn't recognize. The
 *                         caller surfaces these as ONE consolidated warning
 *                         on the result modal, not per-row noise. This keeps
 *                         the importer forward-compatible: a future schema
 *                         column won't break existing CSV imports.
 *
 * All parsers are pure (no I/O, no throw). detectCsvKind matches on header
 * signature: items.csv has `kind`+`audience`, subtopics.csv has
 * `category_slug` but no `kind`, categories.csv has `program_slug` but no
 * `category_slug`, programs.csv has `default_anchor`+`sort_weight`.
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
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// RFC 4180 parser
// ---------------------------------------------------------------------------

function parseRawCsv(text: string): string[][] {
  const clean = text.startsWith("﻿") ? text.slice(1) : text;
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

// 41 columns — matches the Phase 1 spec exactly. Covers every user-editable
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

// ============================================================================
// ─────────────────────────────────────────────────────────────────────────────
// IMPORT SIDE (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
// ============================================================================

// ── Validation constants ────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INT_RE = /^-?\d+$/;
const VALID_ANCHORS = new Set(["assignment", "purchase", "fixed"]);
const VALID_PRODUCTS = new Set(["games", "journey", "adults"]);
const VALID_AUDIENCES = new Set(["both", "owner", "partner"]);
const VALID_KINDS = new Set(["content", "assessment", "reflection"]);
const VALID_CONTENT_TYPES = new Set([
  "article",
  "exercise",
  "video",
  "prompt",
  "challenge",
]);

// ── Parse result + error types ──────────────────────────────────────────────

export type ParseErrorCode =
  | "empty_file"
  | "missing_header"
  | "missing_field"
  | "bad_slug"
  | "bad_enum"
  | "bad_int"
  | "bad_json"
  | "duplicate_slug"
  // items only: kind=content but body_he + expert_insight_he + task_he all empty
  | "body_required";

export type ParseError = {
  /** 1-indexed CSV row. Header is row 1; data starts at row 2. row=0 = file-level. */
  row: number;
  /** Header column name when error is field-specific. */
  column?: string;
  code: ParseErrorCode;
  message: string;
};

/**
 * Parser output. Successful rows go into `rows`; failed rows go into
 * `errors` and do NOT appear in `rows`. `unknownColumns` lists header
 * columns the parser didn't recognize — the caller surfaces these as
 * ONE consolidated warning (not per-row) so a future schema column
 * doesn't break existing imports.
 */
export type ParseResult<T> = {
  rows: T[];
  errors: ParseError[];
  unknownColumns: string[];
};

// ── ImportRow types ─────────────────────────────────────────────────────────

export type ProgramImportRow = {
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  cover_image_url: string | null;
  default_anchor: "assignment" | "purchase" | "fixed";
  product_slug: "games" | "journey" | "adults" | null;
  is_active: boolean;
  sort_weight: number;
};

export type CategoryImportRow = {
  /** null when this is a standalone category (no parent program). */
  program_slug: string | null;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
};

export type SubtopicImportRow = {
  category_slug: string;
  /** Defensive echo; the apply layer verifies it matches the category's actual program. */
  program_slug: string | null;
  slug: string;
  name_he: string;
  name_en: string | null;
  description_he: string | null;
  description_en: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ItemImportRow = {
  category_slug: string;
  /** Defensive echo; apply layer cross-checks. */
  program_slug: string | null;
  /** null = item hangs directly off the category (no subtopic). */
  subtopic_slug: string | null;
  slug: string;
  title_he: string;
  title_en: string | null;
  stage: number | null;
  content_type: "article" | "exercise" | "video" | "prompt" | "challenge";
  audience: "both" | "owner" | "partner";
  kind: "content" | "assessment" | "reflection";
  est_minutes: number | null;
  /** Pipe-split from `tags` cell. Empty cell → []. */
  tags: string[];
  /**
   * Pipe-split from `prereq_item_slugs` cell. Tokens may be bare
   * `item-slug` (resolved within the same category) or
   * `category-slug/item-slug` (cross-category). Resolution to UUIDs
   * happens in the apply layer's pass-2 prereq resolver.
   */
  prereq_item_slugs: string[];
  body_he: string | null;
  body_en: string | null;
  task_he: string | null;
  task_en: string | null;
  challenge_he: string | null;
  challenge_en: string | null;
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
  video_url: string | null;
  image_url: string | null;
  sort_order: number;
  default_offset_days: number;
  is_active: boolean;
  /** Parsed from assessment_payload_json. null when cell is empty. */
  assessment_payload: unknown | null;
};

// ── Header-signature CSV kind detection ─────────────────────────────────────

export type JourneyCsvKind = "programs" | "categories" | "subtopics" | "items";

/**
 * Detect entity type from header column set. Order matters: items first
 * (most distinctive — has `kind`+`audience`), then subtopics (has
 * `category_slug` but no `kind`), then categories (has `program_slug`
 * but no `category_slug`), then programs.
 *
 * Returns null if no shape matches — caller responds with a clear
 * "could not detect" error to the user.
 */
export function detectCsvKind(text: string): JourneyCsvKind | null {
  const raw = parseRawCsv(text);
  if (raw.length === 0) return null;
  const headers = new Set(
    raw[0].map((h) => h.trim().toLowerCase()).filter((h) => h.length > 0),
  );
  const has = (k: string) => headers.has(k);

  if (has("kind") && has("audience") && has("category_slug")) return "items";
  if (has("category_slug") && has("name_he") && !has("kind")) return "subtopics";
  if (
    has("program_slug") &&
    has("name_he") &&
    has("sort_order") &&
    !has("category_slug")
  )
    return "categories";
  if (
    has("default_anchor") &&
    has("sort_weight") &&
    !has("program_slug") &&
    !has("category_slug")
  )
    return "programs";
  return null;
}

// ── Parser helpers ──────────────────────────────────────────────────────────

function trimOr(v: string | undefined): string {
  return (v ?? "").trim();
}

function nullIfEmpty(v: string): string | null {
  return v === "" ? null : v;
}

function parseBoolDefault(s: string, def: boolean): boolean {
  const t = s.toLowerCase();
  if (t === "") return def;
  if (t === "false" || t === "0") return false;
  if (t === "true" || t === "1") return true;
  return def;
}

/** Returns `null` on empty cell, `"bad"` on parse failure, else the int. */
function intOrNull(s: string): number | null | "bad" {
  if (s === "") return null;
  if (!INT_RE.test(s)) return "bad";
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : "bad";
}

/** Returns `def` on empty cell, `"bad"` on parse failure, else the int. */
function intDefault(s: string, def: number): number | "bad" {
  if (s === "") return def;
  if (!INT_RE.test(s)) return "bad";
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : "bad";
}

/** Pipe-split. Empty cell → []. Trims tokens, drops empties. */
function splitPipe(s: string): string[] {
  if (s === "") return [];
  return s
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function lowerHeaders(rawHeader: string[]): string[] {
  return rawHeader.map((h) => h.trim().toLowerCase());
}

function checkRequiredHeaders(
  headers: string[],
  required: readonly string[],
  errors: ParseError[],
): boolean {
  let ok = true;
  for (const r of required) {
    if (!headers.includes(r.toLowerCase())) {
      errors.push({
        row: 1,
        column: r,
        code: "missing_header",
        message: `Required column "${r}" missing from header`,
      });
      ok = false;
    }
  }
  return ok;
}

function diffUnknownColumns(
  headers: string[],
  known: readonly string[],
): string[] {
  const knownLower = new Set(known.map((c) => c.toLowerCase()));
  return headers.filter((h) => h.length > 0 && !knownLower.has(h));
}

/**
 * Reject rows whose natural key collides within the same file. All
 * occurrences are reported (including the first) so the admin sees
 * the conflict, and ALL conflicting rows are removed from the
 * result — none of them is imported. Per Section 12 of the Phase 2A
 * plan: silent "keep the last" would hide the admin's mistake.
 */
function detectDuplicates<T>(
  provisional: Array<{ rowNum: number; key: string; row: T }>,
  errors: ParseError[],
): T[] {
  const keyToRows = new Map<string, number[]>();
  for (const p of provisional) {
    const list = keyToRows.get(p.key) ?? [];
    list.push(p.rowNum);
    keyToRows.set(p.key, list);
  }
  const dupes = new Set<string>();
  for (const [key, rowNums] of keyToRows) {
    if (rowNums.length > 1) {
      dupes.add(key);
      for (const rn of rowNums) {
        errors.push({
          row: rn,
          column: "slug",
          code: "duplicate_slug",
          message: `Duplicate key "${key}" appears on rows ${rowNums.join(", ")}`,
        });
      }
    }
  }
  return provisional.filter((p) => !dupes.has(p.key)).map((p) => p.row);
}

// ── parseProgramsCsv ────────────────────────────────────────────────────────

export function parseProgramsCsv(text: string): ParseResult<ProgramImportRow> {
  const raw = parseRawCsv(text);
  const errors: ParseError[] = [];
  if (raw.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, code: "empty_file", message: "Empty file" }],
      unknownColumns: [],
    };
  }
  const [headerRow, ...dataRows] = raw;
  const headers = lowerHeaders(headerRow);
  const indexOf = (col: string) => headers.indexOf(col);
  const required = ["slug", "name_he"] as const;
  const unknownColumns = diffUnknownColumns(headers, PROGRAM_COLS);
  if (!checkRequiredHeaders(headers, required, errors)) {
    return { rows: [], errors, unknownColumns };
  }
  const get = (row: string[], col: string) => trimOr(row[indexOf(col)]);

  const provisional: Array<{ rowNum: number; key: string; row: ProgramImportRow }> = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rn = r + 2;
    if (row.every((c) => trimOr(c) === "")) continue;

    const slug = get(row, "slug");
    const name_he = get(row, "name_he");
    const rawAnchor = get(row, "default_anchor") || "assignment";
    const rawProduct = get(row, "product_slug");
    const rawWeight = get(row, "sort_weight");

    let bad = false;
    if (slug === "") {
      errors.push({ row: rn, column: "slug", code: "missing_field", message: "slug is required" });
      bad = true;
    } else if (!SLUG_RE.test(slug)) {
      errors.push({
        row: rn, column: "slug", code: "bad_slug",
        message: `Slug "${slug}" must match /^[a-z0-9]+(-[a-z0-9]+)*$/`,
      });
      bad = true;
    }
    if (name_he === "") {
      errors.push({ row: rn, column: "name_he", code: "missing_field", message: "name_he is required" });
      bad = true;
    }
    if (!VALID_ANCHORS.has(rawAnchor)) {
      errors.push({
        row: rn, column: "default_anchor", code: "bad_enum",
        message: `default_anchor must be assignment|purchase|fixed (got "${rawAnchor}")`,
      });
      bad = true;
    }
    if (rawProduct !== "" && !VALID_PRODUCTS.has(rawProduct)) {
      errors.push({
        row: rn, column: "product_slug", code: "bad_enum",
        message: `product_slug must be games|journey|adults or empty (got "${rawProduct}")`,
      });
      bad = true;
    }
    const sortWeight = intDefault(rawWeight, 0);
    if (sortWeight === "bad") {
      errors.push({
        row: rn, column: "sort_weight", code: "bad_int",
        message: `sort_weight must be an integer (got "${rawWeight}")`,
      });
      bad = true;
    }

    if (bad) continue;

    const parsed: ProgramImportRow = {
      slug,
      name_he,
      name_en: nullIfEmpty(get(row, "name_en")),
      description_he: nullIfEmpty(get(row, "description_he")),
      description_en: nullIfEmpty(get(row, "description_en")),
      cover_image_url: nullIfEmpty(get(row, "cover_image_url")),
      default_anchor: rawAnchor as ProgramImportRow["default_anchor"],
      product_slug:
        rawProduct === ""
          ? null
          : (rawProduct as Exclude<ProgramImportRow["product_slug"], null>),
      is_active: parseBoolDefault(get(row, "is_active"), true),
      sort_weight: sortWeight as number,
    };
    provisional.push({ rowNum: rn, key: slug, row: parsed });
  }

  const rows = detectDuplicates(provisional, errors);
  return { rows, errors, unknownColumns };
}

// ── parseCategoriesCsv ──────────────────────────────────────────────────────

export function parseCategoriesCsv(text: string): ParseResult<CategoryImportRow> {
  const raw = parseRawCsv(text);
  const errors: ParseError[] = [];
  if (raw.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, code: "empty_file", message: "Empty file" }],
      unknownColumns: [],
    };
  }
  const [headerRow, ...dataRows] = raw;
  const headers = lowerHeaders(headerRow);
  const indexOf = (col: string) => headers.indexOf(col);
  const required = ["slug", "name_he"] as const;
  const unknownColumns = diffUnknownColumns(headers, CATEGORY_COLS);
  if (!checkRequiredHeaders(headers, required, errors)) {
    return { rows: [], errors, unknownColumns };
  }
  const get = (row: string[], col: string) => trimOr(row[indexOf(col)]);

  const provisional: Array<{ rowNum: number; key: string; row: CategoryImportRow }> = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rn = r + 2;
    if (row.every((c) => trimOr(c) === "")) continue;

    const program_slug = get(row, "program_slug");
    const slug = get(row, "slug");
    const name_he = get(row, "name_he");
    const rawSort = get(row, "sort_order");

    let bad = false;
    if (slug === "") {
      errors.push({ row: rn, column: "slug", code: "missing_field", message: "slug is required" });
      bad = true;
    } else if (!SLUG_RE.test(slug)) {
      errors.push({
        row: rn, column: "slug", code: "bad_slug",
        message: `Slug "${slug}" must match slug syntax`,
      });
      bad = true;
    }
    if (name_he === "") {
      errors.push({ row: rn, column: "name_he", code: "missing_field", message: "name_he is required" });
      bad = true;
    }
    if (program_slug !== "" && !SLUG_RE.test(program_slug)) {
      errors.push({
        row: rn, column: "program_slug", code: "bad_slug",
        message: `program_slug "${program_slug}" must match slug syntax`,
      });
      bad = true;
    }
    const sortOrder = intDefault(rawSort, 0);
    if (sortOrder === "bad") {
      errors.push({
        row: rn, column: "sort_order", code: "bad_int",
        message: `sort_order must be an integer (got "${rawSort}")`,
      });
      bad = true;
    }

    if (bad) continue;

    const parsed: CategoryImportRow = {
      program_slug: program_slug === "" ? null : program_slug,
      slug,
      name_he,
      name_en: nullIfEmpty(get(row, "name_en")),
      description_he: nullIfEmpty(get(row, "description_he")),
      description_en: nullIfEmpty(get(row, "description_en")),
      sort_order: sortOrder as number,
      is_active: parseBoolDefault(get(row, "is_active"), true),
    };
    // Natural key includes program_slug so the same category slug can exist
    // under different programs without being flagged duplicate.
    provisional.push({ rowNum: rn, key: `${program_slug}/${slug}`, row: parsed });
  }

  const rows = detectDuplicates(provisional, errors);
  return { rows, errors, unknownColumns };
}

// ── parseSubtopicsCsv ───────────────────────────────────────────────────────

export function parseSubtopicsCsv(text: string): ParseResult<SubtopicImportRow> {
  const raw = parseRawCsv(text);
  const errors: ParseError[] = [];
  if (raw.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, code: "empty_file", message: "Empty file" }],
      unknownColumns: [],
    };
  }
  const [headerRow, ...dataRows] = raw;
  const headers = lowerHeaders(headerRow);
  const indexOf = (col: string) => headers.indexOf(col);
  const required = ["category_slug", "slug", "name_he"] as const;
  const unknownColumns = diffUnknownColumns(headers, SUBTOPIC_COLS);
  if (!checkRequiredHeaders(headers, required, errors)) {
    return { rows: [], errors, unknownColumns };
  }
  const get = (row: string[], col: string) => trimOr(row[indexOf(col)]);

  const provisional: Array<{ rowNum: number; key: string; row: SubtopicImportRow }> = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rn = r + 2;
    if (row.every((c) => trimOr(c) === "")) continue;

    const category_slug = get(row, "category_slug");
    const program_slug = get(row, "program_slug");
    const slug = get(row, "slug");
    const name_he = get(row, "name_he");
    const rawSort = get(row, "sort_order");

    let bad = false;
    if (category_slug === "") {
      errors.push({
        row: rn, column: "category_slug", code: "missing_field",
        message: "category_slug is required",
      });
      bad = true;
    } else if (!SLUG_RE.test(category_slug)) {
      errors.push({
        row: rn, column: "category_slug", code: "bad_slug",
        message: `category_slug "${category_slug}" must match slug syntax`,
      });
      bad = true;
    }
    if (slug === "") {
      errors.push({ row: rn, column: "slug", code: "missing_field", message: "slug is required" });
      bad = true;
    } else if (!SLUG_RE.test(slug)) {
      errors.push({
        row: rn, column: "slug", code: "bad_slug",
        message: `Slug "${slug}" must match slug syntax`,
      });
      bad = true;
    }
    if (name_he === "") {
      errors.push({ row: rn, column: "name_he", code: "missing_field", message: "name_he is required" });
      bad = true;
    }
    if (program_slug !== "" && !SLUG_RE.test(program_slug)) {
      errors.push({
        row: rn, column: "program_slug", code: "bad_slug",
        message: `program_slug "${program_slug}" must match slug syntax`,
      });
      bad = true;
    }
    const sortOrder = intDefault(rawSort, 0);
    if (sortOrder === "bad") {
      errors.push({
        row: rn, column: "sort_order", code: "bad_int",
        message: `sort_order must be an integer (got "${rawSort}")`,
      });
      bad = true;
    }

    if (bad) continue;

    const parsed: SubtopicImportRow = {
      category_slug,
      program_slug: program_slug === "" ? null : program_slug,
      slug,
      name_he,
      name_en: nullIfEmpty(get(row, "name_en")),
      description_he: nullIfEmpty(get(row, "description_he")),
      description_en: nullIfEmpty(get(row, "description_en")),
      sort_order: sortOrder as number,
      is_active: parseBoolDefault(get(row, "is_active"), true),
    };
    provisional.push({ rowNum: rn, key: `${category_slug}/${slug}`, row: parsed });
  }

  const rows = detectDuplicates(provisional, errors);
  return { rows, errors, unknownColumns };
}

// ── parseItemsCsv ───────────────────────────────────────────────────────────

export function parseItemsCsv(text: string): ParseResult<ItemImportRow> {
  const raw = parseRawCsv(text);
  const errors: ParseError[] = [];
  if (raw.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, code: "empty_file", message: "Empty file" }],
      unknownColumns: [],
    };
  }
  const [headerRow, ...dataRows] = raw;
  const headers = lowerHeaders(headerRow);
  const indexOf = (col: string) => headers.indexOf(col);
  const required = [
    "category_slug",
    "slug",
    "title_he",
    "kind",
    "audience",
  ] as const;
  const unknownColumns = diffUnknownColumns(headers, ITEM_COLS);
  if (!checkRequiredHeaders(headers, required, errors)) {
    return { rows: [], errors, unknownColumns };
  }
  const get = (row: string[], col: string) => trimOr(row[indexOf(col)]);

  const provisional: Array<{ rowNum: number; key: string; row: ItemImportRow }> = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rn = r + 2;
    if (row.every((c) => trimOr(c) === "")) continue;

    const category_slug = get(row, "category_slug");
    const slug = get(row, "slug");
    const title_he = get(row, "title_he");
    const program_slug = get(row, "program_slug");
    const subtopic_slug = get(row, "subtopic_slug");

    // Defaults — empty cell falls back to the most common value.
    const kindRaw = (get(row, "kind") || "content").toLowerCase();
    const audienceRaw = (get(row, "audience") || "both").toLowerCase();
    const contentTypeRaw = (get(row, "content_type") || "article").toLowerCase();

    const rawStage = get(row, "stage");
    const rawEst = get(row, "est_minutes");
    const rawSort = get(row, "sort_order");
    const rawOffset = get(row, "default_offset_days");

    let bad = false;

    if (category_slug === "") {
      errors.push({
        row: rn, column: "category_slug", code: "missing_field",
        message: "category_slug is required",
      });
      bad = true;
    } else if (!SLUG_RE.test(category_slug)) {
      errors.push({
        row: rn, column: "category_slug", code: "bad_slug",
        message: `category_slug "${category_slug}" must match slug syntax`,
      });
      bad = true;
    }
    if (slug === "") {
      errors.push({ row: rn, column: "slug", code: "missing_field", message: "slug is required" });
      bad = true;
    } else if (!SLUG_RE.test(slug)) {
      errors.push({
        row: rn, column: "slug", code: "bad_slug",
        message: `Slug "${slug}" must match slug syntax`,
      });
      bad = true;
    }
    if (title_he === "") {
      errors.push({
        row: rn, column: "title_he", code: "missing_field",
        message: "title_he is required",
      });
      bad = true;
    }
    if (subtopic_slug !== "" && !SLUG_RE.test(subtopic_slug)) {
      errors.push({
        row: rn, column: "subtopic_slug", code: "bad_slug",
        message: `subtopic_slug "${subtopic_slug}" must match slug syntax`,
      });
      bad = true;
    }
    if (program_slug !== "" && !SLUG_RE.test(program_slug)) {
      errors.push({
        row: rn, column: "program_slug", code: "bad_slug",
        message: `program_slug "${program_slug}" must match slug syntax`,
      });
      bad = true;
    }
    if (!VALID_KINDS.has(kindRaw)) {
      errors.push({
        row: rn, column: "kind", code: "bad_enum",
        message: `kind must be content|assessment|reflection (got "${kindRaw}")`,
      });
      bad = true;
    }
    if (!VALID_AUDIENCES.has(audienceRaw)) {
      errors.push({
        row: rn, column: "audience", code: "bad_enum",
        message: `audience must be both|owner|partner (got "${audienceRaw}")`,
      });
      bad = true;
    }
    if (!VALID_CONTENT_TYPES.has(contentTypeRaw)) {
      errors.push({
        row: rn, column: "content_type", code: "bad_enum",
        message: `content_type must be article|exercise|video|prompt|challenge (got "${contentTypeRaw}")`,
      });
      bad = true;
    }
    const stage = intOrNull(rawStage);
    if (stage === "bad") {
      errors.push({
        row: rn, column: "stage", code: "bad_int",
        message: `stage must be an integer or empty (got "${rawStage}")`,
      });
      bad = true;
    }
    const est = intOrNull(rawEst);
    if (est === "bad") {
      errors.push({
        row: rn, column: "est_minutes", code: "bad_int",
        message: `est_minutes must be an integer or empty (got "${rawEst}")`,
      });
      bad = true;
    }
    const sortOrder = intDefault(rawSort, 0);
    if (sortOrder === "bad") {
      errors.push({
        row: rn, column: "sort_order", code: "bad_int",
        message: `sort_order must be an integer (got "${rawSort}")`,
      });
      bad = true;
    }
    const offsetDays = intDefault(rawOffset, 0);
    if (offsetDays === "bad") {
      errors.push({
        row: rn, column: "default_offset_days", code: "bad_int",
        message: `default_offset_days must be an integer (got "${rawOffset}")`,
      });
      bad = true;
    }

    // assessment_payload_json — validate JSON only; structural validation
    // (questions[] shape, scale_min/max consistency, etc.) happens in the
    // per-item editor when the admin opens the row. Per Section 12 #5.
    const rawPayload = get(row, "assessment_payload_json");
    let payload: unknown | null = null;
    if (rawPayload !== "") {
      try {
        payload = JSON.parse(rawPayload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({
          row: rn, column: "assessment_payload_json", code: "bad_json",
          message: `Invalid JSON: ${msg}`,
        });
        bad = true;
      }
    }

    // body_he relaxation (Section 12 #1): for kind=content require at least
    // ONE of body_he / expert_insight_he / task_he to be non-empty. For
    // assessment / reflection the payload carries the content; body fields
    // may all be empty.
    if (!bad && kindRaw === "content") {
      const body_he = get(row, "body_he");
      const expert_insight_he = get(row, "expert_insight_he");
      const task_he = get(row, "task_he");
      if (body_he === "" && expert_insight_he === "" && task_he === "") {
        errors.push({
          row: rn, column: "body_he", code: "body_required",
          message:
            "For kind=content, at least one of body_he / expert_insight_he / task_he must be non-empty",
        });
        bad = true;
      }
    }

    if (bad) continue;

    const parsed: ItemImportRow = {
      category_slug,
      program_slug: program_slug === "" ? null : program_slug,
      subtopic_slug: subtopic_slug === "" ? null : subtopic_slug,
      slug,
      title_he,
      title_en: nullIfEmpty(get(row, "title_en")),
      stage: stage as number | null,
      content_type: contentTypeRaw as ItemImportRow["content_type"],
      audience: audienceRaw as ItemImportRow["audience"],
      kind: kindRaw as ItemImportRow["kind"],
      est_minutes: est as number | null,
      tags: splitPipe(get(row, "tags")),
      prereq_item_slugs: splitPipe(get(row, "prereq_item_slugs")),
      body_he: nullIfEmpty(get(row, "body_he")),
      body_en: nullIfEmpty(get(row, "body_en")),
      task_he: nullIfEmpty(get(row, "task_he")),
      task_en: nullIfEmpty(get(row, "task_en")),
      challenge_he: nullIfEmpty(get(row, "challenge_he")),
      challenge_en: nullIfEmpty(get(row, "challenge_en")),
      expert_insight_he: nullIfEmpty(get(row, "expert_insight_he")),
      expert_insight_en: nullIfEmpty(get(row, "expert_insight_en")),
      common_mistakes_he: nullIfEmpty(get(row, "common_mistakes_he")),
      common_mistakes_en: nullIfEmpty(get(row, "common_mistakes_en")),
      metaphor_he: nullIfEmpty(get(row, "metaphor_he")),
      metaphor_en: nullIfEmpty(get(row, "metaphor_en")),
      measurement_he: nullIfEmpty(get(row, "measurement_he")),
      measurement_en: nullIfEmpty(get(row, "measurement_en")),
      do_this_week_he: nullIfEmpty(get(row, "do_this_week_he")),
      do_this_week_en: nullIfEmpty(get(row, "do_this_week_en")),
      dont_this_week_he: nullIfEmpty(get(row, "dont_this_week_he")),
      dont_this_week_en: nullIfEmpty(get(row, "dont_this_week_en")),
      progress_marker_he: nullIfEmpty(get(row, "progress_marker_he")),
      progress_marker_en: nullIfEmpty(get(row, "progress_marker_en")),
      source_attribution_he: nullIfEmpty(get(row, "source_attribution_he")),
      source_attribution_en: nullIfEmpty(get(row, "source_attribution_en")),
      video_url: nullIfEmpty(get(row, "video_url")),
      image_url: nullIfEmpty(get(row, "image_url")),
      sort_order: sortOrder as number,
      default_offset_days: offsetDays as number,
      is_active: parseBoolDefault(get(row, "is_active"), true),
      assessment_payload: payload,
    };
    provisional.push({ rowNum: rn, key: `${category_slug}/${slug}`, row: parsed });
  }

  const rows = detectDuplicates(provisional, errors);
  return { rows, errors, unknownColumns };
}
