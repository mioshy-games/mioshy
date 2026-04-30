/**
 * CSV Import / Export utilities for Wheel Questions.
 *
 * Two import formats are supported:
 *
 * Format A - Full (matches export, for round-trip backup/restore):
 *   game_id, game_slug, game_name_he, game_name_en,
 *   question_id, type, level, text_he, text_en, is_active, created_at
 *
 * Format B - Simple (for new content without a game UUID):
 *   game_name, type, text_he, text_en          (level defaults to "light")
 *   game_name, type, text                      (text maps to both text_he + text_en)
 *
 * Import rules
 * ────────────
 * • game_id   OR game_name - at least one required; game_id takes priority
 * • question_id - optional; empty → INSERT; UUID → UPDATE
 * • type       - required; must be: truth | dare | custom
 * • level      - optional; must be: light | flirty | deep (default: light)
 * • text_he    - required (or `text` which maps to both he + en)
 * • text_en    - required (or `text` which maps to both he + en)
 * • is_active  - optional; default true
 * • category   - optional; free-text tag (e.g. "romance", "family"); default ""
 * • game_slug / game_name_he / game_name_en / created_at - informational,
 *   ignored during import
 *
 * Encoding: UTF-8 with BOM (Excel-compatible)
 * Delimiter: comma
 * Text quoting: RFC 4180
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WheelQuestionImportRow = {
  /** Empty string means INSERT; UUID string means UPDATE */
  question_id: string;
  /**
   * Resolved game UUID.
   * Set by parser when the CSV provides game_id directly.
   * Set by the import route (after lookup/create) when CSV provides game_name.
   * Empty string means the import route must resolve it via game_name.
   */
  game_id: string;
  /**
   * Raw game name from CSV (Format B only).
   * Empty when the CSV provides game_id directly.
   * The import route uses this to lookup or auto-create the game.
   */
  game_name: string;
  type: string;
  level: string;
  text_he: string;
  text_en: string;
  is_active: boolean;
  /** Optional grouping tag. Empty string = uncategorised. */
  category: string;
};

export type CsvValidationError = {
  /** 1-based row number; header row = 1 */
  row: number;
  field: string;
  message: string;
};

export type WheelCsvParseResult =
  | { ok: true; rows: WheelQuestionImportRow[] }
  | { ok: false; errors: CsvValidationError[] };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WHEEL_CSV_HEADERS = [
  "game_id",
  "game_slug",
  "game_name_he",
  "game_name_en",
  "question_id",
  "type",
  "level",
  "category",
  "text_he",
  "text_en",
  "is_active",
  "created_at",
] as const;

// `type` is a free-form category string (e.g. "truth", "dare", "Honesty", "Romance").
// Any non-empty value is accepted - the wheel renders whatever category name is given.
const VALID_LEVELS = new Set(["light", "flirty", "deep"]);

// ---------------------------------------------------------------------------
// RFC 4180 helpers
// ---------------------------------------------------------------------------

/** Escape a single CSV cell value. */
export function csvEscapeCell(value: string): string {
  if (
    value.includes('"') ||
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialise a header row + data rows to CSV string with UTF-8 BOM. */
function buildCsv(header: readonly string[], dataRows: string[][]): string {
  const lines = [
    header.map(csvEscapeCell).join(","),
    ...dataRows.map((cols) => cols.map(csvEscapeCell).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Template generator
// ---------------------------------------------------------------------------

/**
 * Returns a ready-to-fill CSV template string (UTF-8 BOM, headers + 2 examples).
 * Pass real game UUIDs if available; otherwise use placeholder strings.
 */
export function buildWheelQuestionsTemplate(): string {
  const examples: string[][] = [
    [
      "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "my-game-slug",
      "שם המשחק",
      "Game Name",
      "",
      "truth",
      "light",
      "romance",
      "מה הפחד הכי גדול שלך?",
      "What is your biggest fear?",
      "true",
      "",
    ],
    [
      "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "my-game-slug",
      "שם המשחק",
      "Game Name",
      "",
      "dare",
      "flirty",
      "fun",
      "נשק את הפרטנר שלך למשך 10 שניות",
      "Kiss your partner for 10 seconds",
      "true",
      "",
    ],
  ];
  return buildCsv(WHEEL_CSV_HEADERS, examples);
}

// ---------------------------------------------------------------------------
// RFC 4180 parser
// ---------------------------------------------------------------------------

function parseRawCsv(text: string): string[][] {
  // Strip BOM if present
  const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        cell += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
        i++;
      } else if (ch === "\r") {
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
        i++;
        if (clean[i] === "\n") i++;
      } else if (ch === "\n") {
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
        i++;
      } else {
        cell += ch;
        i++;
      }
    }
  }

  // Flush last cell / row
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop trailing empty rows (from trailing newline)
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === "")) {
    rows.pop();
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Validate + parse import CSV
// ---------------------------------------------------------------------------

/**
 * Parse and validate a CSV string for wheel question import.
 *
 * Invalid rows are collected as errors and skipped - the rest are returned
 * so the caller can decide how to handle partial failures.
 */
export function parseWheelQuestionsCsv(text: string): WheelCsvParseResult {
  const rawRows = parseRawCsv(text);

  if (rawRows.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, field: "file", message: "הקובץ ריק / The file is empty" }],
    };
  }

  const [headerRow, ...dataRows] = rawRows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());

  // Verify the minimum required columns exist
  const REQUIRED_IMPORT_COLS = [
    "game_id",
    "type",
    "level",
    "text_he",
    "text_en",
  ] as const;
  const missing = REQUIRED_IMPORT_COLS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        {
          row: 1,
          field: "header",
          message: `עמודות חסרות / Missing columns: ${missing.join(", ")}`,
        },
      ],
    };
  }

  const idx = (name: string): number => headers.indexOf(name);

  const errors: CsvValidationError[] = [];
  const validRows: WheelQuestionImportRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowNum = r + 2; // 1-based; header = row 1

    // Skip completely blank rows silently
    if (row.every((c) => c.trim() === "")) continue;

    const get = (col: string): string => (row[idx(col)] ?? "").trim();

    const rawGameId = get("game_id");
    const rawQId = get("question_id"); // may be empty
    const rawType = get("type");
    const rawLevel = get("level").toLowerCase(); // normalise "Light" → "light" etc.
    const rawHe = get("text_he");
    const rawEn = get("text_en");
    const rawActive = get("is_active");

    let rowHasError = false;

    if (!rawGameId) {
      errors.push({ row: rowNum, field: "game_id", message: "game_id ריק / game_id is required" });
      rowHasError = true;
    }

    if (!rawType) {
      errors.push({
        row: rowNum,
        field: "type",
        message: "type ריק / type is required",
      });
      rowHasError = true;
    }

    if (!VALID_LEVELS.has(rawLevel)) {
      errors.push({
        row: rowNum,
        field: "level",
        message: `level חייב להיות light / flirty / deep (קיבלנו: "${rawLevel}")`,
      });
      rowHasError = true;
    }

    if (!rawHe) {
      errors.push({ row: rowNum, field: "text_he", message: "text_he ריק / Hebrew text is required" });
      rowHasError = true;
    }

    if (!rawEn) {
      errors.push({ row: rowNum, field: "text_en", message: "text_en ריק / English text is required" });
      rowHasError = true;
    }

    if (rowHasError) continue;

    // Parse is_active: default true; accept "false" / "0" as false
    const isActive =
      rawActive === "" || rawActive === "true" || rawActive === "1"
        ? true
        : rawActive === "false" || rawActive === "0"
          ? false
          : true;

    validRows.push({
      question_id: rawQId, // empty string = INSERT
      game_id: rawGameId,
      game_name: "",       // Format A always provides game_id; game_name not needed
      type: rawType,
      level: rawLevel,
      category: "",
      text_he: rawHe,
      text_en: rawEn,
      is_active: isActive,
    });
  }

  // Return valid rows even if there were some errors (partial import)
  return { ok: true, rows: validRows, ...(errors.length > 0 ? { errors } : {}) } as {
    ok: true;
    rows: WheelQuestionImportRow[];
    errors?: CsvValidationError[];
  } & { ok: true; rows: WheelQuestionImportRow[] };
}

// ---------------------------------------------------------------------------
// Extended result type that carries both rows + warnings
// ---------------------------------------------------------------------------

export type WheelCsvParseSuccess = {
  ok: true;
  rows: WheelQuestionImportRow[];
  /** Row-level errors that were skipped (partial import) */
  skipped: CsvValidationError[];
};

export type WheelCsvParseFatal = {
  ok: false;
  errors: CsvValidationError[];
};

export type WheelCsvResult = WheelCsvParseSuccess | WheelCsvParseFatal;

/**
 * Parse wheel questions CSV with full error detail.
 * Supports two formats:
 *
 * Format A - Full (export round-trip):
 *   game_id, ..., question_id, type, level, text_he, text_en, is_active, ...
 *
 * Format B - Simple (new content by game name):
 *   game_name, type, text_he, text_en     (level defaults to "light")
 *   game_name, type, text                 (text maps to text_he + text_en)
 *
 * Fatal errors (ok:false): empty file, neither game_id nor game_name column
 * Row errors (ok:true, skipped[]): invalid type, missing text, etc.
 */
export function parseWheelQuestionsWithDetail(text: string): WheelCsvResult {
  const rawRows = parseRawCsv(text);

  if (rawRows.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, field: "file", message: "הקובץ ריק / The file is empty" }],
    };
  }

  const [headerRow, ...dataRows] = rawRows;
  const headers = headerRow.map((h) => h.trim().toLowerCase());

  // Determine format
  const hasGameId   = headers.includes("game_id");
  const hasGameName = headers.includes("game_name");
  const hasTextHe   = headers.includes("text_he");
  const hasTextEn   = headers.includes("text_en");
  const hasText     = headers.includes("text"); // simple shorthand

  if (!hasGameId && !hasGameName) {
    return {
      ok: false,
      errors: [
        {
          row: 1,
          field: "header",
          message: "CSV must contain either a 'game_id' column (Format A) or a 'game_name' column (Format B)",
        },
      ],
    };
  }

  if (!hasTextHe && !hasText) {
    return {
      ok: false,
      errors: [
        {
          row: 1,
          field: "header",
          message: "CSV must contain either 'text_he' / 'text_en' columns or a single 'text' column",
        },
      ],
    };
  }

  if (!headers.includes("type")) {
    return {
      ok: false,
      errors: [{ row: 1, field: "header", message: "Missing required column: type" }],
    };
  }

  const idx = (name: string): number => headers.indexOf(name);
  const skipped: CsvValidationError[] = [];
  const validRows: WheelQuestionImportRow[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowNum = r + 2;

    if (row.every((c) => c.trim() === "")) continue;

    const get = (col: string): string => (idx(col) >= 0 ? (row[idx(col)] ?? "").trim() : "");

    // Game identifier - prefer game_id, fall back to game_name
    const rawGameId   = hasGameId   ? get("game_id")   : "";
    // For Format B rows use game_name directly; for Format A (export round-trip)
    // also capture game_name_he / game_name_en as a fallback name so the import
    // route can auto-create the game when the game_id doesn't exist in this
    // environment (e.g. importing a CSV exported from staging into production).
    const rawGameNameDirect = hasGameName ? get("game_name") : "";
    const rawGameNameHeFallback = get("game_name_he");
    const rawGameNameEnFallback = get("game_name_en");
    const rawGameName = rawGameNameDirect || rawGameNameHeFallback || rawGameNameEnFallback;

    const rawQId      = get("question_id");
    const rawType     = get("type");
    // Level: optional in Format B, defaults to "light".
    // Normalise to lowercase so "Light", "FLIRTY" etc. are accepted.
    const rawLevelRaw = get("level");
    const rawLevel    = (rawLevelRaw || "light").toLowerCase();

    // Text: prefer explicit text_he / text_en; fall back to generic `text`
    const textFallback = hasText ? get("text") : "";
    const rawHe = (hasTextHe ? get("text_he") : "") || textFallback;
    const rawEn = (hasTextEn ? get("text_en") : "") || textFallback;

    const rawActive   = get("is_active");
    const rawCategory = get("category"); // optional, defaults to ""

    let rowHasError = false;

    // Must have at least one game identifier
    if (!rawGameId && !rawGameName) {
      skipped.push({
        row: rowNum,
        field: "game_id / game_name",
        message: "Either game_id or game_name must be provided",
      });
      rowHasError = true;
    }

    if (!rawType) {
      skipped.push({
        row: rowNum,
        field: "type",
        message: "type is required (got empty value)",
      });
      rowHasError = true;
    }

    if (!VALID_LEVELS.has(rawLevel)) {
      skipped.push({
        row: rowNum,
        field: "level",
        message: `level must be light / flirty / deep (got: "${rawLevel}")`,
      });
      rowHasError = true;
    }

    if (!rawHe) {
      skipped.push({ row: rowNum, field: "text_he / text", message: "Hebrew text (or `text`) is required" });
      rowHasError = true;
    }

    if (!rawEn) {
      skipped.push({ row: rowNum, field: "text_en / text", message: "English text (or `text`) is required" });
      rowHasError = true;
    }

    if (rowHasError) continue;

    const isActive =
      rawActive === "" || rawActive === "true" || rawActive === "1"
        ? true
        : rawActive === "false" || rawActive === "0"
          ? false
          : true;

    validRows.push({
      question_id: rawQId,
      game_id: rawGameId,       // empty if Format B - import route resolves via game_name
      game_name: rawGameName,   // empty if Format A
      type: rawType,
      level: rawLevel,
      category: rawCategory,
      text_he: rawHe,
      text_en: rawEn,
      is_active: isActive,
    });
  }

  return { ok: true, rows: validRows, skipped };
}
