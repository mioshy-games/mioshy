/**
 * CSV field escaping — quoting plus formula neutralisation.
 *
 * Audit 2026-08-05, phase 2.
 *
 * Four export routes had each copied the same RFC-4180 quoting helper, and none
 * of them neutralised formulas. Every field in those exports is attacker-
 * supplied: lead names, poll answers, journey free text. A value like
 *
 *     =cmd|' /C calc'!A0
 *
 * is inert text in the database and an executable formula the moment an admin
 * opens the file in Excel, Numbers or Sheets — remote code execution on the
 * machine of the person doing the export, from data any signed-up user can
 * write. Quoting alone does NOT stop it: the spreadsheet strips the quotes and
 * still evaluates the leading `=`.
 *
 * The fix is a leading apostrophe, which every spreadsheet treats as "the rest
 * of this cell is literal text".
 */

/**
 * Characters that make a spreadsheet treat a cell as a formula.
 *
 * `-` is included even though it also begins a negative number. A value like
 * `-5` therefore exports as `'-5` and reads as text rather than a number. That
 * is a deliberate trade: `-2+3+cmd|' /C calc'!A0` also starts with `-`, so
 * "skip it if it looks numeric" is a bypass, not a refinement.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** True when a spreadsheet would evaluate this value as a formula. */
export function isFormulaLike(value: string): boolean {
  return FORMULA_LEAD.test(value);
}

/**
 * Escape one value for a CSV cell.
 *
 * Order matters: neutralise the formula FIRST, then quote. Doing it the other
 * way would put the apostrophe inside the quotes where some parsers drop it.
 */
export function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const neutralised = isFormulaLike(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(neutralised)) {
    return `"${neutralised.replace(/"/g, '""')}"`;
  }
  return neutralised;
}

/** Escape a whole row and join it. */
export function csvRow(values: readonly unknown[]): string {
  return values.map(csvEscape).join(",");
}
