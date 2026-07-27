/**
 * lib/poll/csv.ts
 *
 * CSV import for poll questions (§9 admin). RFC4180-safe parser (quoted fields,
 * embedded commas, "" escapes) + a service-role importer that inserts questions
 * and their zero-count aggregate rows. Dedup by text → safe to re-import.
 * Columns: text, option_a, option_b, order_index, domain, insight_line.
 * Legacy prior_a/prior_b/prior_weight columns are accepted and IGNORED — the
 * poll shows real percentages only (priors removed 2026-07-27).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export async function importQuestionsFromCsv(csv: string): Promise<ImportResult> {
  const rows = parseCSV(csv);
  const errors: string[] = [];
  if (rows.length < 2) return { inserted: 0, skipped: 0, errors: ["CSV has no data rows"] };

  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const required = ["text", "option_a", "option_b", "order_index"];
  for (const col of required) {
    if (idx(col) === -1) return { inserted: 0, skipped: 0, errors: [`missing required column: ${col}`] };
  }

  const num = (v: string | undefined) => { const n = Number(String(v ?? "").trim()); return Number.isFinite(n) ? n : 0; };
  const str = (v: string | undefined) => { const s = String(v ?? "").trim(); return s.length ? s : null; };

  const admin = await createAdminClient();
  const { data: existing } = await admin.from("poll_questions").select("text");
  const seen = new Set((existing ?? []).map((r) => (r as { text: string }).text));

  let inserted = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const text = String(r[idx("text")] ?? "").trim();
    const optionA = String(r[idx("option_a")] ?? "").trim();
    const optionB = String(r[idx("option_b")] ?? "").trim();
    if (!text || !optionA || !optionB) { errors.push(`skipped row (missing text/options): ${text.slice(0, 30)}`); continue; }
    if (seen.has(text)) { skipped++; continue; }

    const { data: ins, error } = await admin
      .from("poll_questions")
      .insert({
        text,
        option_a: optionA,
        option_b: optionB,
        order_index: num(r[idx("order_index")]),
        domain: idx("domain") >= 0 ? str(r[idx("domain")]) : null,
        insight_line: idx("insight_line") >= 0 ? str(r[idx("insight_line")]) : null,
        is_active: true,
      })
      .select("id")
      .single();
    if (error || !ins) { errors.push(`insert failed: ${text.slice(0, 30)} — ${error?.message ?? "no row"}`); continue; }
    await admin.from("poll_vote_aggregates").upsert({ question_id: ins.id, count_a: 0, count_b: 0 }, { onConflict: "question_id" });
    seen.add(text);
    inserted++;
  }
  return { inserted, skipped, errors };
}
