"use server";

/**
 * Admin server actions for managing the JOURNEY questionnaire's questions
 * (table: journey_questions, F1 migrations 117/118).
 *
 * Mirrors app/dashboard/assessments/actions.ts but for the journey's
 * weighted-axis model. Admin-gated via requireAdmin(); all writes go through
 * the service-role client (journey_questions has NO write RLS policy — public
 * SELECT only — so writes MUST use the service-role client, which bypasses RLS).
 *
 * SCORING LOCK: the standard editor may NOT change scoring config. `axes`,
 * `reverse`, and per-option `scores` are NEVER written by upsert — only label
 * text / phase / domain / type / position / is_active / meta.placeholder.
 * The ONLY path that may change scoring config is CSV import (clearly the
 * deliberate, owner-confirmed route).
 *
 * Does NOT touch assessment_questions / intimacy / friendship / games.
 */

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AxisWeight, QuestionOption } from "@/lib/journey/types";
import { revalidatePath } from "next/cache";

export type Phase = "short" | "full";

type ActionResult = { ok: true } | { ok: false; error: string };

/** A row as the admin UI sees it (read model). */
export interface JourneyQuestionRow {
  slug: string;
  position: number;
  phase: Phase;
  type: string;
  domain: string | null;
  axes: AxisWeight[];
  reverse: boolean;
  he_text: string;
  en_text: string;
  options: QuestionOption[] | null;
  meta: JourneyQuestionMeta | null;
  is_active: boolean;
}

export interface JourneyQuestionMeta {
  purpose?: string;
  insight?: string;
  max_length?: number;
  he_subline?: string;
  en_subline?: string;
  categories?: unknown[];
  placeholder_he?: string;
  placeholder_en?: string;
  [k: string]: unknown;
}

/** Editable fields only. Scoring (axes / option scores) is intentionally absent. */
export interface JourneyQuestionInput {
  slug: string;
  position: number;
  phase: Phase;
  type: string;
  domain: string | null;
  he_text: string;
  en_text: string;
  is_active: boolean;
  /** Reflection placeholder (stored in meta). */
  placeholder_he?: string;
  placeholder_en?: string;
  /** Choice option LABELS only — { id, he, en }. Scores are preserved server-side. */
  optionLabels?: Array<{ id: string; he: string; en: string }>;
}

const CSV_COLUMNS = [
  "slug",
  "position",
  "phase",
  "type",
  "domain",
  "axes",
  "reverse",
  "he_text",
  "en_text",
  "options",
  "meta",
  "is_active",
] as const;

function revalidate() {
  revalidatePath("/dashboard/journey-questions");
}

const VALID_PHASES: Phase[] = ["short", "full"];

/**
 * Upsert the EDITABLE fields of a journey question. Never writes axes/reverse,
 * and only writes option labels (scores preserved from the existing row).
 */
export async function upsertJourneyQuestion(
  input: JourneyQuestionInput,
): Promise<ActionResult> {
  await requireAdmin();
  const slug = input.slug.trim();
  if (!slug) return { ok: false, error: "slug is required" };
  if (!VALID_PHASES.includes(input.phase))
    return { ok: false, error: "invalid phase" };

  const admin = createAdminSupabaseClient();

  // Read existing row so we PRESERVE locked scoring config (meta keys other
  // than placeholder, and option scores) — the editor must not be able to
  // clobber them.
  const { data: existing } = await admin
    .from("journey_questions")
    .select("meta, options")
    .eq("slug", slug)
    .maybeSingle();

  // Merge meta: keep everything, override only placeholder_* when provided.
  const meta: JourneyQuestionMeta = {
    ...((existing?.meta as JourneyQuestionMeta | null) ?? {}),
  };
  if (input.placeholder_he !== undefined) meta.placeholder_he = input.placeholder_he;
  if (input.placeholder_en !== undefined) meta.placeholder_en = input.placeholder_en;

  // Merge option labels by id, preserving id + scores (LOCKED).
  let options: QuestionOption[] | null =
    (existing?.options as QuestionOption[] | null) ?? null;
  if (input.optionLabels && options) {
    const labelById = new Map(input.optionLabels.map((o) => [o.id, o]));
    options = options.map((o) => {
      const lbl = labelById.get(o.id);
      return lbl ? { ...o, he: lbl.he, en: lbl.en } : o;
    });
  }

  const { error } = await admin.from("journey_questions").upsert(
    {
      slug,
      position: input.position,
      phase: input.phase,
      type: input.type,
      domain: input.domain || null,
      he_text: input.he_text,
      en_text: input.en_text,
      is_active: input.is_active,
      meta,
      ...(options !== null ? { options } : {}),
      // axes / reverse intentionally omitted: preserved on UPDATE, default on INSERT.
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  );
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Soft delete / restore (recommended, reversible). */
export async function toggleActiveJourneyQuestion(
  slug: string,
  isActive: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("journey_questions")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/**
 * HARD delete — permanent. Removes the row; journey_questions_history cascades
 * (FK ON DELETE CASCADE). Historical journey_responses that reference this slug
 * are NOT removed (the answers remain; only the definition is gone). The UI
 * warns about that before calling this.
 */
export async function deleteJourneyQuestion(slug: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("journey_questions")
    .delete()
    .eq("slug", slug);
  if (error) return { ok: false, error: error.message };
  revalidate();
  return { ok: true };
}

/** Count answers in journey_responses referencing a slug (for the delete warning). */
export async function getJourneyResponseCount(
  slug: string,
): Promise<{ count: number }> {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const { count } = await admin
    .from("journey_responses")
    .select("id", { count: "exact", head: true })
    .eq("question_id", slug);
  return { count: count ?? 0 };
}

/** Swap position with the adjacent question (direction -1 up / +1 down). */
export async function reorderJourneyQuestion(
  slug: string,
  direction: -1 | 1,
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const { data: rows } = await admin
    .from("journey_questions")
    .select("slug, position")
    .order("position", { ascending: true });
  if (!rows) return { ok: false, error: "load_failed" };

  const idx = rows.findIndex((r) => r.slug === slug);
  const swapIdx = idx + direction;
  if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return { ok: true };

  const a = rows[idx];
  const b = rows[swapIdx];
  await admin.from("journey_questions").update({ position: b.position }).eq("slug", a.slug);
  await admin.from("journey_questions").update({ position: a.position }).eq("slug", b.slug);
  revalidate();
  return { ok: true };
}

export async function exportJourneyQuestionsCsv(): Promise<string> {
  await requireAdmin();
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("journey_questions")
    .select("*")
    .order("position", { ascending: true });

  const lines = [CSV_COLUMNS.join(",")];
  for (const r of data ?? []) {
    lines.push(
      CSV_COLUMNS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","),
    );
  }
  return lines.join("\r\n");
}

/**
 * Import CSV. This is the ONLY action that may change scoring config (axes,
 * option scores) — axes/options/meta are parsed as JSON cells. Upserts on slug.
 */
export async function importJourneyQuestionsCsv(
  csv: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireAdmin();

  let records: string[][];
  try {
    records = parseCsv(csv);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "parse_failed" };
  }
  if (records.length < 2)
    return { ok: false, error: "empty CSV (need a header row + at least one row)" };

  const header = records[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  if (idx("slug") < 0 || idx("he_text") < 0)
    return { ok: false, error: "CSV must include at least slug and he_text columns" };

  const admin = createAdminSupabaseClient();

  let payload: Array<Record<string, unknown>>;
  try {
    payload = records
      .slice(1)
      .filter((row) => row.some((c) => c.trim() !== ""))
      .map((row, i) => {
        const get = (name: string) => {
          const j = idx(name);
          return j >= 0 && j < row.length ? row[j] : "";
        };
        const phase = get("phase").trim() === "short" ? "short" : "full";
        const jsonCell = (name: string, fallback: unknown) => {
          const raw = get(name).trim();
          if (raw === "") return fallback;
          return JSON.parse(raw);
        };
        return {
          slug: get("slug").trim(),
          position: Number(get("position")) || i,
          phase,
          type: get("type").trim() || "likert5",
          domain: get("domain").trim() || null,
          axes: jsonCell("axes", []),
          reverse: ["true", "1", "yes"].includes(get("reverse").trim().toLowerCase()),
          he_text: get("he_text"),
          en_text: get("en_text"),
          options: jsonCell("options", null),
          meta: jsonCell("meta", null),
          is_active:
            get("is_active").trim() === ""
              ? true
              : ["true", "1", "yes"].includes(get("is_active").trim().toLowerCase()),
          updated_at: new Date().toISOString(),
        };
      });
  } catch (e) {
    return {
      ok: false,
      error: `invalid JSON in axes/options/meta cell: ${e instanceof Error ? e.message : "parse error"}`,
    };
  }

  const valid = payload.filter((p) => p.slug);
  if (valid.length === 0) return { ok: false, error: "no rows with a slug" };

  const { error } = await admin
    .from("journey_questions")
    .upsert(valid, { onConflict: "slug" });
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true, count: valid.length };
}

// ── tiny CSV helpers (same as assessments) ───────────────────────────────────

function csvCell(v: unknown): string {
  let s: string;
  if (v === null || v === undefined) s = "";
  else if (typeof v === "boolean") s = v ? "true" : "false";
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** RFC-4180-ish parser: handles quoted fields, doubled quotes, CRLF/LF, BOM. */
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
