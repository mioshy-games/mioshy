/**
 * lib/journey/phase.ts (F3.2)
 *
 * Resolves the ACTIVE journey flow for a given user/journey state, shared by
 * the assessment page (render) and the answer route (completion/gating) so both
 * derive the same active set + counts.
 *
 * Modes (see lib/journey/gating.ts):
 *   - 'single' : DB unseeded (loader JSON fallback) → the full questionnaire as
 *                one pass = today's behaviour.
 *   - 'full'   : subscriber → ALL unanswered diagnostic questions (short ∪ full),
 *                answer-driven. Serves 17 when short is done, 28 when short was
 *                skipped (direct purchase). Robust to short-skipping buyers.
 *   - 'short'  : not subscribed, DB seeded → the SHORT set only.
 *
 * Position is ANSWER-DRIVEN: `remaining` is the phase set minus already-answered
 * slugs, in position order. The client renders `remaining` sequentially; resume
 * is therefore "first unanswered" with no reliance on a stored counter.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Question } from "./types";
import type { JourneyFlowMode } from "./gating";
import { loadJourneyQuestions, loadJourneyQuestionsWithSource } from "./questions-db";

export interface ResolvedJourneyFlow {
  mode: JourneyFlowMode;
  /** Complete active-phase set (drives completion + progress total). */
  phaseSet: Question[];
  /** Unanswered phase questions in position order — what the client renders. */
  remaining: Question[];
  phaseTotal: number;
  answeredInPhaseCount: number;
  source: "db" | "json";
}

export async function resolveJourneyFlow(opts: {
  client: SupabaseClient;
  subscriptionActive: boolean;
  answeredSlugs: Set<string>;
}): Promise<ResolvedJourneyFlow> {
  const { client, subscriptionActive, answeredSlugs } = opts;

  // First load the full active set + source signal (no phase filter).
  const { questions: all, source } = await loadJourneyQuestionsWithSource(client);

  let mode: JourneyFlowMode;
  let phaseSet: Question[];

  if (source === "json") {
    // Unseeded → single combined flow (today's behaviour).
    mode = "single";
    phaseSet = all;
  } else if (subscriptionActive) {
    // Subscriber → all diagnostic (short ∪ full); answer-driven skip handles
    // both short-done (17 remain) and short-skipped (28 remain) uniformly.
    mode = "full";
    phaseSet = all;
  } else {
    // Pre-purchase → the short set only (DB is seeded here, so the phase
    // filter returns the real 11, not the JSON fallback).
    mode = "short";
    phaseSet = await loadJourneyQuestions(client, { phase: "short" });
  }

  const remaining = phaseSet.filter((q) => !answeredSlugs.has(q.id));

  return {
    mode,
    phaseSet,
    remaining,
    phaseTotal: phaseSet.length,
    answeredInPhaseCount: phaseSet.length - remaining.length,
    source,
  };
}
