/**
 * lib/poll/queries.ts
 *
 * Server-side data access for the poll (service-role; RLS is service-role-only).
 * Percentages are RECOMPUTED from real vote counts on every read (§8) — never
 * cached, never invented. The poll_vote_aggregates table is kept in sync as a
 * best-effort convenience for the admin distributions dashboard (Stage 9).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";
import { computePollPercent, type PollPercent } from "@/lib/poll/percent";

export interface PollQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  orderIndex: number;
  insightLine: string | null;
}

interface PollQuestionRow {
  id: string;
  text: string;
  option_a: string;
  option_b: string;
  order_index: number;
  insight_line: string | null;
  prior_a: number;
  prior_b: number;
}

function toQuestion(r: PollQuestionRow): PollQuestion {
  return {
    id: r.id,
    text: r.text,
    optionA: r.option_a,
    optionB: r.option_b,
    orderIndex: r.order_index,
    insightLine: r.insight_line,
  };
}

/**
 * The current active question. Stage 1 = first active by order_index; the
 * per-user serial pointer (no skip / no repeat) arrives in Stage 5.
 */
export async function getCurrentQuestion(): Promise<{ question: PollQuestion; priorA: number; priorB: number } | null> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("poll_questions")
    .select("id, text, option_a, option_b, order_index, insight_line, prior_a, prior_b")
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle<PollQuestionRow>();
  if (!data) return null;
  return { question: toQuestion(data), priorA: data.prior_a, priorB: data.prior_b };
}

/** Recompute the live tally for a question from real votes + its priors (§8). */
export async function getQuestionTally(questionId: string): Promise<PollPercent> {
  const admin = await createAdminClient();
  const [{ data: q }, { count: countA }, { count: countB }] = await Promise.all([
    admin.from("poll_questions").select("prior_a, prior_b").eq("id", questionId).maybeSingle<{ prior_a: number; prior_b: number }>(),
    admin.from("poll_votes").select("id", { count: "exact", head: true }).eq("question_id", questionId).eq("option", "a"),
    admin.from("poll_votes").select("id", { count: "exact", head: true }).eq("question_id", questionId).eq("option", "b"),
  ]);
  return computePollPercent({
    priorA: q?.prior_a ?? 0,
    priorB: q?.prior_b ?? 0,
    countA: countA ?? 0,
    countB: countB ?? 0,
  });
}

/** Which option this anon already chose on this question, or null. */
export async function getExistingVote(questionId: string, anonId: string): Promise<"a" | "b" | null> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("poll_votes")
    .select("option")
    .eq("question_id", questionId)
    .eq("anon_id", anonId)
    .maybeSingle<{ option: "a" | "b" }>();
  return data?.option ?? null;
}

/**
 * Record an anonymous vote. Idempotent per (anon_id, question) — a repeat vote
 * keeps the FIRST choice (no repeat, §7). Returns the option that now stands.
 */
export async function recordVote(args: {
  questionId: string;
  option: "a" | "b";
  anonId: string;
  userId?: string | null;
}): Promise<"a" | "b"> {
  const admin = await createAdminClient();
  // onConflict (anon_id, question_id) → ignoreDuplicates keeps the first vote.
  await admin
    .from("poll_votes")
    .upsert(
      { question_id: args.questionId, option: args.option, anon_id: args.anonId, user_id: args.userId ?? null },
      { onConflict: "anon_id,question_id", ignoreDuplicates: true },
    );

  const existing = await getExistingVote(args.questionId, args.anonId);
  const finalOption = existing ?? args.option;

  // Best-effort aggregate refresh (recomputed, so races can't corrupt it).
  const [{ count: countA }, { count: countB }] = await Promise.all([
    admin.from("poll_votes").select("id", { count: "exact", head: true }).eq("question_id", args.questionId).eq("option", "a"),
    admin.from("poll_votes").select("id", { count: "exact", head: true }).eq("question_id", args.questionId).eq("option", "b"),
  ]);
  await admin
    .from("poll_vote_aggregates")
    .upsert(
      { question_id: args.questionId, count_a: countA ?? 0, count_b: countB ?? 0, updated_at: new Date().toISOString() },
      { onConflict: "question_id" },
    );

  return finalOption;
}
