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
 * The next active question for this anon: the first active question (by
 * order_index) they have NOT yet answered (§7 — serial, no skip, no repeat).
 * Returns null when they have answered every active question ("all done").
 * Absence never advances the pointer — it is derived from what was answered,
 * so a returning visitor always gets the next one in line.
 */
export async function getCurrentQuestion(
  anonId: string | null,
): Promise<{ question: PollQuestion; priorA: number; priorB: number } | null> {
  const admin = await createAdminClient();

  let answeredIds: string[] = [];
  if (anonId) {
    const { data: answered } = await admin
      .from("poll_votes")
      .select("question_id")
      .eq("anon_id", anonId);
    answeredIds = (answered ?? []).map((r) => r.question_id as string);
  }

  let q = admin
    .from("poll_questions")
    .select("id, text, option_a, option_b, order_index, insight_line, prior_a, prior_b")
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .limit(1);
  if (answeredIds.length) q = q.not("id", "in", `(${answeredIds.join(",")})`);

  const { data } = await q.maybeSingle<PollQuestionRow>();
  if (!data) return null;
  return { question: toQuestion(data), priorA: data.prior_a, priorB: data.prior_b };
}

/** The anon's answered history (§7): each answered question + their choice. */
export async function getHistory(anonId: string): Promise<
  Array<{ questionId: string; text: string; chosen: string; option: "a" | "b"; answeredAt: string }>
> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("poll_votes")
    .select("question_id, option, created_at, poll_questions(text, option_a, option_b)")
    .eq("anon_id", anonId)
    .order("created_at", { ascending: false });
  type Joined = {
    question_id: string;
    option: "a" | "b";
    created_at: string;
    poll_questions:
      | { text: string; option_a: string; option_b: string }
      | { text: string; option_a: string; option_b: string }[]
      | null;
  };
  return ((data ?? []) as unknown as Joined[]).map((r) => {
    const q = Array.isArray(r.poll_questions) ? r.poll_questions[0] : r.poll_questions;
    return {
      questionId: r.question_id,
      text: q?.text ?? "",
      chosen: q ? (r.option === "a" ? q.option_a : q.option_b) : "",
      option: r.option,
      answeredAt: r.created_at,
    };
  });
}

/**
 * Read-only answered history WITH the live §8 percentages for each question —
 * the "look back" screen (never a queue to answer). Percentages are recomputed
 * from real votes (never cached), consistent with the reveal.
 */
export async function getHistoryWithTally(anonId: string): Promise<
  Array<{
    questionId: string;
    text: string;
    chosenLabel: string;
    otherLabel: string;
    option: "a" | "b";
    chosenPct: number;
    otherPct: number;
    totalVotes: number;
    answeredAt: string;
  }>
> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("poll_votes")
    .select("question_id, option, created_at, poll_questions(text, option_a, option_b)")
    .eq("anon_id", anonId)
    .order("created_at", { ascending: false });
  type Joined = {
    question_id: string;
    option: "a" | "b";
    created_at: string;
    poll_questions:
      | { text: string; option_a: string; option_b: string }
      | { text: string; option_a: string; option_b: string }[]
      | null;
  };
  const rows = (data ?? []) as unknown as Joined[];
  const tallies = await Promise.all(rows.map((r) => getQuestionTally(r.question_id)));
  return rows.map((r, i) => {
    const q = Array.isArray(r.poll_questions) ? r.poll_questions[0] : r.poll_questions;
    const t = tallies[i];
    return {
      questionId: r.question_id,
      text: q?.text ?? "",
      chosenLabel: q ? (r.option === "a" ? q.option_a : q.option_b) : "",
      otherLabel: q ? (r.option === "a" ? q.option_b : q.option_a) : "",
      option: r.option,
      chosenPct: r.option === "a" ? t.pctA : t.pctB,
      otherPct: r.option === "a" ? t.pctB : t.pctA,
      totalVotes: t.totalVotes,
      answeredAt: r.created_at,
    };
  });
}

/**
 * The anon's most recently answered question + their choice + the live tally
 * (§10) — so a returning user who has answered everything sees their last
 * answer's reveal (choice marked) instead of a bare "done".
 */
export async function getLastAnsweredReveal(
  anonId: string,
): Promise<({ question: PollQuestion; option: "a" | "b" } & PollPercent) | null> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("poll_votes")
    .select("question_id, option, poll_questions(id, text, option_a, option_b, order_index, insight_line)")
    .eq("anon_id", anonId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  type Joined = {
    question_id: string;
    option: "a" | "b";
    poll_questions:
      | { id: string; text: string; option_a: string; option_b: string; order_index: number; insight_line: string | null }
      | { id: string; text: string; option_a: string; option_b: string; order_index: number; insight_line: string | null }[]
      | null;
  };
  const row = (data as unknown as Joined | null) ?? null;
  if (!row) return null;
  const q = Array.isArray(row.poll_questions) ? row.poll_questions[0] : row.poll_questions;
  if (!q) return null;
  const tally = await getQuestionTally(row.question_id);
  return {
    question: {
      id: q.id, text: q.text, optionA: q.option_a, optionB: q.option_b,
      orderIndex: q.order_index, insightLine: q.insight_line,
    },
    option: row.option,
    ...tally,
  };
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
