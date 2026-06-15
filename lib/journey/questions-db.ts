/**
 * lib/journey/questions-db.ts
 *
 * F1 — loads the journey questionnaire's question DEFINITIONS from the DB
 * (public.journey_questions, migrations 117/118), with a FALLBACK to the
 * bundled journey/questionnaire.json when the table is empty OR the query
 * errors — mirroring lib/assessments/questions-db.ts so the flow keeps working
 * before/around the migration.
 *
 * Scope (F1): this feeds the SCORING resolver only (see lib/journey/analysis.ts
 * `analyze(..., resolve)`). The live questionnaire RENDER still reads the JSON
 * directly via lib/journey/questions.ts; switching render to the DB is F3.
 *
 * The mapper produces the SAME `Question` shape that getQuestion() returns
 * today, so analysis.ts scores identically regardless of source. One field is
 * not carried by the table: `category` (free/registered/paid) — it's a
 * render/gating concern, NOT read by the scoring math — so the mapper defaults
 * it to "free". (Render stays on JSON in F1, so nothing relies on this default.)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { QUESTIONS as STATIC_QUESTIONS } from "./questions";
import type {
  AxisWeight,
  Domain,
  Question,
  QuestionOption,
  QuestionRankingCategory,
} from "./types";

/** A row as stored in public.journey_questions (the columns we read). */
export interface JourneyQuestionRow {
  slug: string;
  position: number;
  phase: "short" | "full";
  type: string;
  domain: string | null;
  axes: AxisWeight[] | null;
  reverse: boolean;
  he_text: string | null;
  en_text: string | null;
  options: QuestionOption[] | null;
  meta: JourneyQuestionMeta | null;
  is_active: boolean;
}

/** Shape of the `meta` JSONB column (all keys optional; seeded from 118). */
interface JourneyQuestionMeta {
  purpose?: string;
  insight?: string;
  max_length?: number;
  he_subline?: string;
  en_subline?: string;
  categories?: QuestionRankingCategory[];
  placeholder_he?: string;
  placeholder_en?: string;
}

const COLUMNS =
  "slug, position, phase, type, domain, axes, reverse, he_text, en_text, options, meta, is_active";

/**
 * Map one DB row back into the canonical `Question` shape. Pure + exported so
 * the identical-result test can exercise the exact mapping the loader uses.
 *
 * he_text/en_text → `he`/`en` for likert5, or `he_prompt`/`en_prompt` for
 * choice/reflection/ranking (matching questionnaire.json). options + meta are
 * carried verbatim. `category` defaults to "free" (not stored; not scored).
 */
export function rowToJourneyQuestion(r: JourneyQuestionRow): Question {
  const axes = (r.axes ?? []) as AxisWeight[];
  const domain = (r.domain ?? null) as Domain | null;
  const meta = r.meta ?? {};
  const purpose = meta.purpose ?? "";
  const he = r.he_text ?? "";
  const en = r.en_text ?? "";

  if (r.type === "likert5") {
    return {
      id: r.slug,
      category: "free",
      type: "likert5",
      domain,
      axes,
      purpose,
      ...(meta.insight !== undefined ? { insight: meta.insight } : {}),
      he,
      en,
    };
  }

  if (
    r.type === "forced_choice" ||
    r.type === "single_choice" ||
    r.type === "multi_choice"
  ) {
    return {
      id: r.slug,
      category: "free",
      type: r.type,
      domain,
      axes,
      purpose,
      ...(meta.insight !== undefined ? { insight: meta.insight } : {}),
      he_prompt: he,
      en_prompt: en,
      options: (r.options ?? []) as QuestionOption[],
    };
  }

  if (r.type === "ranking") {
    return {
      id: r.slug,
      category: "free",
      type: "ranking",
      domain,
      axes,
      purpose,
      ...(meta.insight !== undefined ? { insight: meta.insight } : {}),
      he_prompt: he,
      en_prompt: en,
      ...(meta.he_subline !== undefined ? { he_subline: meta.he_subline } : {}),
      ...(meta.en_subline !== undefined ? { en_subline: meta.en_subline } : {}),
      categories: (meta.categories ?? []) as QuestionRankingCategory[],
    };
  }

  // Default: reflection (the remaining type in the questionnaire).
  return {
    id: r.slug,
    category: "free",
    type: "reflection",
    domain,
    axes,
    purpose,
    ...(meta.insight !== undefined ? { insight: meta.insight } : {}),
    he_prompt: he,
    en_prompt: en,
    ...(meta.max_length !== undefined ? { max_length: meta.max_length } : {}),
    ...(meta.placeholder_he !== undefined ? { placeholder_he: meta.placeholder_he } : {}),
    ...(meta.placeholder_en !== undefined ? { placeholder_en: meta.placeholder_en } : {}),
  };
}

/** Map a set of rows, preserving DB order (callers should order by position). */
export function mapRowsToJourneyQuestions(
  rows: JourneyQuestionRow[],
): Question[] {
  return rows.map(rowToJourneyQuestion);
}

export interface LoadJourneyQuestionsOptions {
  /** Restrict to a single phase ('short' | 'full'). Omit for all questions. */
  phase?: "short" | "full";
}

/** Where a load resolved from: the editable DB table, or the bundled JSON. */
export type JourneyQuestionsSource = "db" | "json";

/**
 * Load journey question definitions from the DB, falling back to the bundled
 * questionnaire.json when the table is empty or the query errors, AND report
 * which source was used. The `source` signal lets F3.2 decide split-flow (db)
 * vs single-flow (json fallback) — when unseeded we must behave exactly like
 * today's single questionnaire.
 *
 * The returned array is in `position` order (DB) or questionnaire.json order
 * (fallback).
 */
export async function loadJourneyQuestionsWithSource(
  client: SupabaseClient,
  opts: LoadJourneyQuestionsOptions = {},
): Promise<{ questions: Question[]; source: JourneyQuestionsSource }> {
  try {
    let query = client
      .from("journey_questions")
      .select(COLUMNS)
      .eq("is_active", true)
      .order("position", { ascending: true });
    if (opts.phase) query = query.eq("phase", opts.phase);

    const { data, error } = await query;
    if (error) {
      console.warn(
        "[journey/questions-db] load error, falling back to questionnaire.json",
        error.message,
      );
    } else if (data && data.length > 0) {
      console.log("[journey/questions-db] source=db", {
        count: data.length,
        phase: opts.phase ?? "all",
      });
      return {
        questions: mapRowsToJourneyQuestions(data as unknown as JourneyQuestionRow[]),
        source: "db",
      };
    } else {
      console.log(
        "[journey/questions-db] table empty, falling back to questionnaire.json",
      );
    }
  } catch (e) {
    console.warn(
      "[journey/questions-db] threw, falling back to questionnaire.json",
      e,
    );
  }

  // Fallback: bundled JSON. A phase filter can't be honored (the JSON carries
  // no phase), so we return the full set — callers MUST treat source==='json'
  // as single-flow (no short/full split).
  console.log("[journey/questions-db] source=json_fallback", {
    count: STATIC_QUESTIONS.length,
    phase: opts.phase ?? "all",
  });
  return { questions: STATIC_QUESTIONS, source: "json" };
}

/**
 * Backwards-compatible loader (questions only). Unchanged behaviour for the
 * scoring/validation callers from F1; new F3.2 flow code uses
 * loadJourneyQuestionsWithSource for the source signal.
 */
export async function loadJourneyQuestions(
  client: SupabaseClient,
  opts: LoadJourneyQuestionsOptions = {},
): Promise<Question[]> {
  const { questions } = await loadJourneyQuestionsWithSource(client, opts);
  return questions;
}

/**
 * Convenience: build a slug→Question resolver from a loaded set, suitable for
 * passing as the `resolve` arg to analyze()/scoreResponses().
 */
export function buildQuestionResolver(
  questions: Question[],
): (slug: string) => Question | undefined {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return (slug) => byId.get(slug);
}
