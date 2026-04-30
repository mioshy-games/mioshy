/**
 * CSV Export / Import utilities for Snakes & Ladders questions.
 *
 * CSV columns (fixed order):
 *   question_id, question_type, question_text_he, question_text_en, category, level
 *
 * `level` is optional in import (missing or blank → defaults to 1).
 * Files with only 5 columns (no level) are still accepted for backward-compat.
 *
 * Encoding: UTF-8 with BOM (Excel-compatible)
 * Delimiter: comma
 * Text quoting: RFC 4180 - fields containing commas, newlines or quotes are
 *   wrapped in double-quotes; internal double-quotes are doubled.
 */

export type CsvQuestion = {
  id: string;
  type: "question" | "challenge";
  text_he: string;
  text_en: string;
  category: string;
  /** Difficulty 1 = קליל, 2 = בינוני, 3 = מאתגר. Defaults to 1. */
  level: 1 | 2 | 3;
};

export type CsvValidationError = {
  row: number;       // 1-based (header = row 0)
  field: string;
  message: string;
};

export type CsvParseResult =
  | { ok: true; questions: CsvQuestion[] }
  | { ok: false; errors: CsvValidationError[] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape a single CSV cell value (RFC 4180). */
function escapeCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const HEADERS = [
  "question_id",
  "question_type",
  "question_text_he",
  "question_text_en",
  "category",
  "level",
] as const;

/** Columns that must be present - level is optional (backward-compat). */
const REQUIRED_HEADERS = [
  "question_id",
  "question_type",
  "question_text_he",
  "question_text_en",
  "category",
] as const;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Serialise a list of questions to a CSV string (UTF-8 BOM included).
 */
export function questionsToCsv(questions: CsvQuestion[]): string {
  const rows: string[] = [HEADERS.map(escapeCell).join(",")];

  for (const q of questions) {
    rows.push(
      [q.id, q.type, q.text_he, q.text_en, q.category, String(q.level ?? 1)].map(escapeCell).join(","),
    );
  }

  // BOM makes Excel open UTF-8 correctly
  return "\uFEFF" + rows.join("\r\n");
}

/**
 * Trigger a browser download of a CSV file.
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// CSV parser (RFC 4180, handles quoted fields with embedded commas/newlines)
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
          // escaped quote
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
      } else if (ch === ',') {
        row.push(cell);
        cell = "";
        i++;
      } else if (ch === '\r') {
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
        i++;
        if (clean[i] === '\n') i++; // CRLF
      } else if (ch === '\n') {
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

  // Last cell / row
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop trailing empty rows (e.g. final newline)
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === "")) {
    rows.pop();
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Import / Validate
// ---------------------------------------------------------------------------

/**
 * Parse and validate CSV text.
 * Returns either a list of CsvQuestion objects or structured errors.
 */
export function parseCsvQuestions(text: string): CsvParseResult {
  const rows = parseRawCsv(text);

  if (rows.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, field: "file", message: "הקובץ ריק" }],
    };
  }

  const [headerRow, ...dataRows] = rows;

  // Normalise headers (trim + lower)
  const headers = headerRow.map((h) => h.trim().toLowerCase());

  // Verify required columns (level is optional - backward-compat with old 5-col exports)
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          field: "header",
          message: `עמודות חסרות: ${missing.join(", ")}`,
        },
      ],
    };
  }

  const hasLevel = headers.includes("level");
  const idx = (name: string) => headers.indexOf(name);

  const errors: CsvValidationError[] = [];
  const questions: CsvQuestion[] = [];
  const seenIds = new Set<string>();

  // Minimum required columns (excluding optional level)
  const MIN_COLS = REQUIRED_HEADERS.length;

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowNum = r + 2; // 1-based, header = row 1

    if (row.length < MIN_COLS) {
      errors.push({
        row: rowNum,
        field: "row",
        message: `שורה קצרה מדי - ${row.length} עמודות במקום לפחות ${MIN_COLS}`,
      });
      continue;
    }

    const rawId = row[idx("question_id")]?.trim() ?? "";
    const rawType = row[idx("question_type")]?.trim() ?? "";
    const rawHe = row[idx("question_text_he")]?.trim() ?? "";
    const rawEn = row[idx("question_text_en")]?.trim() ?? "";
    const rawCat = row[idx("category")]?.trim() ?? "";
    const rawLevel = hasLevel ? (row[idx("level")]?.trim() ?? "") : "";

    let hasError = false;

    if (!rawId) {
      errors.push({ row: rowNum, field: "question_id", message: "question_id ריק" });
      hasError = true;
    } else if (seenIds.has(rawId)) {
      errors.push({ row: rowNum, field: "question_id", message: `question_id כפול: ${rawId}` });
      hasError = true;
    }

    if (rawType !== "question" && rawType !== "challenge") {
      errors.push({
        row: rowNum,
        field: "question_type",
        message: `question_type חייב להיות "question" או "challenge" (קיבלנו: "${rawType}")`,
      });
      hasError = true;
    }

    if (!rawHe) {
      errors.push({ row: rowNum, field: "question_text_he", message: "טקסט עברי ריק" });
      hasError = true;
    }

    if (!rawEn) {
      errors.push({ row: rowNum, field: "question_text_en", message: "טקסט אנגלי ריק" });
      hasError = true;
    }

    if (!rawCat) {
      errors.push({ row: rowNum, field: "category", message: "קטגוריה ריקה" });
      hasError = true;
    }

    // level: optional, must be 1, 2, or 3 if present
    let parsedLevel: 1 | 2 | 3 = 1;
    if (rawLevel !== "") {
      const n = parseInt(rawLevel, 10);
      if (n === 1 || n === 2 || n === 3) {
        parsedLevel = n;
      } else {
        errors.push({
          row: rowNum,
          field: "level",
          message: `level חייב להיות 1, 2 או 3 (קיבלנו: "${rawLevel}")`,
        });
        hasError = true;
      }
    }

    if (hasError) continue;

    seenIds.add(rawId);
    questions.push({
      id: rawId,
      type: rawType as "question" | "challenge",
      text_he: rawHe,
      text_en: rawEn,
      category: rawCat,
      level: parsedLevel,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, questions };
}

/**
 * Merge imported questions into existing list:
 *  - If question_id already exists → update in place
 *  - If not → append at the end
 */
export function mergeQuestions(
  existing: CsvQuestion[],
  incoming: CsvQuestion[],
): CsvQuestion[] {
  const map = new Map(existing.map((q) => [q.id, { ...q }]));
  for (const q of incoming) {
    map.set(q.id, q);
  }
  return Array.from(map.values());
}
