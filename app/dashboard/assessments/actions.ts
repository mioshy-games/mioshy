"use server";

/**
 * Admin server actions for managing assessment questions (edit / add / delete /
 * reorder / CSV import + export). Admin-gated via requireAdmin(); all writes go
 * through the service-role client. CSV is parsed/serialized inline (no extra
 * dependency) and handles quoted fields + Hebrew.
 */

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAssessment } from "@/lib/assessments/catalog";
import type { QuestionInput } from "@/lib/assessments/types";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

const CSV_COLUMNS = [
  "slug",
  "position",
  "dimension_key",
  "type",
  "reverse",
  "is_open",
  "text_he",
  "text_en",
  "source_slugs",
  "is_active",
] as const;

function revalidate(assessmentId: string) {
  revalidatePath(`/dashboard/assessments/${assessmentId}`);
  revalidatePath(`/he/assessments/${assessmentId}`);
  revalidatePath(`/en/assessments/${assessmentId}`);
}

export async function upsertAssessmentQuestion(input: QuestionInput): Promise<ActionResult> {
  await requireAdmin();
  if (!getAssessment(input.assessment_id)) return { ok: false, error: "unknown_assessment" };
  if (!input.slug.trim()) return { ok: false, error: "slug is required" };

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("assessment_questions").upsert(
    {
      assessment_id: input.assessment_id,
      slug: input.slug.trim(),
      position: input.position,
      dimension_key: input.is_open ? null : input.dimension_key || null,
      type: input.type,
      reverse: input.reverse,
      is_open: input.is_open,
      text_he: input.text_he,
      text_en: input.text_en,
      source_slugs: input.source_slugs,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assessment_id,slug" },
  );
  if (error) return { ok: false, error: error.message };
  revalidate(input.assessment_id);
  return { ok: true };
}

export async function deleteAssessmentQuestion(
  assessmentId: string,
  slug: string,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("assessment_questions")
    .delete()
    .eq("assessment_id", assessmentId)
    .eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  revalidate(assessmentId);
  return { ok: true };
}

/** Swap position with the adjacent active question (direction -1 up / +1 down). */
export async function reorderAssessmentQuestion(
  assessmentId: string,
  slug: string,
  direction: -1 | 1,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const { data: rows } = await admin
    .from("assessment_questions")
    .select("slug, position")
    .eq("assessment_id", assessmentId)
    .order("position", { ascending: true });
  if (!rows) return { ok: false, error: "load_failed" };

  const idx = rows.findIndex((r) => r.slug === slug);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return { ok: true };

  const a = rows[idx];
  const b = rows[swapIdx];
  await admin.from("assessment_questions").update({ position: b.position }).eq("assessment_id", assessmentId).eq("slug", a.slug);
  await admin.from("assessment_questions").update({ position: a.position }).eq("assessment_id", assessmentId).eq("slug", b.slug);
  revalidate(assessmentId);
  return { ok: true };
}

export async function exportAssessmentQuestionsCsv(assessmentId: string): Promise<string> {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("assessment_questions")
    .select("*")
    .eq("assessment_id", assessmentId)
    .order("position", { ascending: true });

  const lines = [CSV_COLUMNS.join(",")];
  for (const r of data ?? []) {
    lines.push(
      CSV_COLUMNS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","),
    );
  }
  return lines.join("\r\n");
}

export async function importAssessmentQuestionsCsv(
  assessmentId: string,
  csv: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireAdmin();
  if (!getAssessment(assessmentId)) return { ok: false, error: "unknown_assessment" };

  let records: string[][];
  try {
    records = parseCsv(csv);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "parse_failed" };
  }
  if (records.length < 2) return { ok: false, error: "empty CSV (need a header row + at least one row)" };

  const header = records[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  if (idx("slug") < 0 || idx("text_he") < 0)
    return { ok: false, error: "CSV must include at least slug and text_he columns" };

  const admin = createAdminSupabaseClient();
  const payload = records.slice(1).filter((row) => row.some((c) => c.trim() !== "")).map((row, i) => {
    const get = (name: string) => {
      const j = idx(name);
      return j >= 0 && j < row.length ? row[j] : "";
    };
    const type = get("type").trim() === "reflection" ? "reflection" : "likert5";
    const is_open = ["true", "1", "yes"].includes(get("is_open").trim().toLowerCase());
    return {
      assessment_id: assessmentId,
      slug: get("slug").trim(),
      position: Number(get("position")) || i + 1,
      dimension_key: is_open ? null : (get("dimension_key").trim() || null),
      type,
      reverse: ["true", "1", "yes"].includes(get("reverse").trim().toLowerCase()),
      is_open,
      text_he: get("text_he"),
      text_en: get("text_en"),
      source_slugs: get("source_slugs"),
      is_active: get("is_active").trim() === "" ? true : ["true", "1", "yes"].includes(get("is_active").trim().toLowerCase()),
      updated_at: new Date().toISOString(),
    };
  });

  const valid = payload.filter((p) => p.slug);
  if (valid.length === 0) return { ok: false, error: "no rows with a slug" };

  const { error } = await admin
    .from("assessment_questions")
    .upsert(valid, { onConflict: "assessment_id,slug" });
  if (error) return { ok: false, error: error.message };

  revalidate(assessmentId);
  return { ok: true, count: valid.length };
}

// ── tiny CSV helpers ─────────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "boolean") s = v ? "true" : "false";
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** RFC-4180-ish parser: handles quoted fields, doubled quotes, CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = ""; rows.push(row); row = [];
    } else if (c === "\r") {
      // swallow; \n handles the row break
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
