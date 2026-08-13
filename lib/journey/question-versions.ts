/**
 * lib/journey/question-versions.ts
 *
 * Date-resolved question definitions: "which version of this question was live
 * when this answer was given?".
 *
 * Split out of questions-db.ts deliberately. That module imports react's
 * `cache`, which pulls a React runtime into anything importing it; this file is
 * pure and side-effect free so the scoring math can be exercised directly by
 * tests and by offline verification scripts.
 *
 * Background: seven journey questions were rewritten in July 2026 while their
 * axes kept pointing at the old meaning (migrations 195-197). Scoring every
 * answer against today's axis mis-scores everything answered before the
 * rewrite; scoring everything against the original mis-scores everything after.
 * The answer's own timestamp is the only thing that resolves it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AxisWeight, Question, QuestionOption } from "./types";

/** One row of public.journey_question_versions (the columns scoring needs). */
export interface JourneyQuestionVersionRow {
  slug: string;
  version: number;
  valid_from: string;
  valid_to: string | null;
  he_text: string;
  en_text: string | null;
  axes: AxisWeight[] | null;
  reverse: boolean | null;
  options: QuestionOption[] | null;
  type: string;
}

const VERSION_COLUMNS =
  "slug, version, valid_from, valid_to, he_text, en_text, axes, reverse, options, type";

/**
 * Load the full version history. Small table (one row per question per rewrite,
 * ~35 rows today), read once per analyze() call.
 */
export async function loadJourneyQuestionVersions(
  client: SupabaseClient,
): Promise<JourneyQuestionVersionRow[]> {
  const { data, error } = await client
    .from("journey_question_versions")
    .select(VERSION_COLUMNS)
    .order("slug", { ascending: true })
    .order("valid_from", { ascending: true });

  if (error) {
    // Deliberately loud. A silent empty result here would fall back to the
    // CURRENT axis for every answer — which is precisely the bug the versions
    // table exists to fix, reintroduced without a trace. The caller decides
    // whether to proceed unversioned; it must be a decision, not an accident.
    console.error(
      "[journey/questions-db] journey_question_versions read FAILED — scoring would fall back to current axes",
      error.message,
    );
    return [];
  }
  return (data ?? []) as unknown as JourneyQuestionVersionRow[];
}

/**
 * Resolver that answers "which version of this question was live when this
 * answer was given?".
 *
 * Seven questions were rewritten in July 2026 while their axes stayed pointed
 * at the old meaning. Scoring every answer against today's axis would mis-score
 * everything answered before the rewrite; scoring everything against the
 * original would mis-score everything after. Both are the same error. The
 * answer's own timestamp is the only thing that resolves it.
 *
 * Falls back to `current` when: the slug has no version rows, or the answer has
 * no timestamp (a live answer being scored immediately — current IS correct).
 */
export function buildVersionedQuestionResolver(
  current: Question[],
  versions: JourneyQuestionVersionRow[],
): (slug: string, answeredAt?: string) => Question | undefined {
  const currentById = new Map(current.map((q) => [q.id, q]));

  const bySlug = new Map<string, JourneyQuestionVersionRow[]>();
  for (const v of versions) {
    const list = bySlug.get(v.slug);
    if (list) list.push(v);
    else bySlug.set(v.slug, [v]);
  }

  // Memoise per (slug, timestamp): a journey answers many questions in one
  // sitting, so the same window is resolved repeatedly.
  const memo = new Map<string, Question | undefined>();

  return (slug, answeredAt) => {
    const base = currentById.get(slug);
    if (!answeredAt) return base;

    const rows = bySlug.get(slug);
    if (!rows || rows.length === 0) return base;

    const key = `${slug}@${answeredAt}`;
    const hit = memo.get(key);
    if (hit !== undefined || memo.has(key)) return hit;

    const t = Date.parse(answeredAt);
    // Half-open [valid_from, valid_to). '-infinity' parses to -Infinity, which
    // compares correctly, so answers predating the table resolve to v1.
    const match = rows.find((r) => {
      const from = Date.parse(r.valid_from);
      const to = r.valid_to === null ? Infinity : Date.parse(r.valid_to);
      return (Number.isNaN(from) ? -Infinity : from) <= t && t < to;
    });

    if (!match) {
      memo.set(key, base);
      return base;
    }

    // Overlay the versioned SCORING fields onto the current definition. Render
    // concerns (position, phase, category) come from `base`; only what scoring
    // reads is taken from the version.
    // `Question` is a union: only the choice variants carry `options`, so the
    // overlay is applied per-variant rather than spread blindly.
    let resolved: Question | undefined;
    if (!base) {
      resolved = undefined;
    } else if ("options" in base) {
      resolved = {
        ...base,
        axes: (match.axes ?? []) as AxisWeight[],
        options: (match.options ?? base.options) as QuestionOption[],
      };
    } else {
      resolved = { ...base, axes: (match.axes ?? []) as AxisWeight[] };
    }

    memo.set(key, resolved);
    return resolved;
  };
}
