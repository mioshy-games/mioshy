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
  userId?: string | null,
): Promise<{ question: PollQuestion } | null> {
  const admin = await createAdminClient();

  // ── Identity (fixed 2026-08-04) ────────────────────────────────────────────
  // This used to key on user_id ALONE once signed in. That silently dropped
  // every vote the same person cast on this device BEFORE they signed in —
  // those rows carry user_id = null — so those questions were served again, and
  // re-answering them wrote nothing (the uniqueness key is (anon_id,
  // question_id), so the insert was ignored). The survey looped.
  //
  // Match on EITHER key. A signed-in user is still identified across devices by
  // user_id; the anon id only ever ADDS answers, it can never hide one.
  let answeredIds: string[] = [];
  if (userId || anonId) {
    let sel = admin.from("poll_votes").select("question_id");
    if (userId && anonId) sel = sel.or(`user_id.eq.${userId},anon_id.eq.${anonId}`);
    else if (userId) sel = sel.eq("user_id", userId);
    else sel = sel.eq("anon_id", anonId as string);

    const { data: answered, error } = await sel;
    // A FAILED READ IS NOT "ANSWERED NOTHING". Swallowing this error dropped the
    // filter below, which served question 1 again — and because that question is
    // already answered, recordVote returned its first choice without writing, so
    // "next question" served it again forever while the table stayed still.
    // That is precisely the shape of the 2026-08-03 incident: a reveal on
    // screen, "next" clicked, and zero rows written. Fail loudly instead — the
    // route 500s and SurveyFlow shows its retry screen, which is honest.
    if (error) {
      throw new Error(`poll_answered_read_failed: ${error.message}`);
    }
    answeredIds = [...new Set((answered ?? []).map((r) => r.question_id as string))];
  }

  let q = admin
    .from("poll_questions")
    .select("id, text, option_a, option_b, order_index, insight_line")
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .limit(1);
  if (answeredIds.length) q = q.not("id", "in", `(${answeredIds.join(",")})`);

  const { data } = await q.maybeSingle<PollQuestionRow>();
  if (!data) return null;
  return { question: toQuestion(data) };
}

/** The anon's answered history (§7): each answered question + their choice. */
export async function getHistory(anonId: string | null, userId?: string | null): Promise<
  Array<{ questionId: string; text: string; chosen: string; option: "a" | "b"; answeredAt: string }>
> {
  const admin = await createAdminClient();
  const idCol = userId ? "user_id" : "anon_id";
  const idVal = userId ?? anonId;
  if (!idVal) return [];
  const { data } = await admin
    .from("poll_votes")
    .select("question_id, option, created_at, poll_questions(text, option_a, option_b)")
    .eq(idCol, idVal)
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
export async function getHistoryWithTally(anonId: string | null, userId?: string | null): Promise<
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
  const idCol = userId ? "user_id" : "anon_id";
  const idVal = userId ?? anonId;
  if (!idVal) return [];
  const { data } = await admin
    .from("poll_votes")
    .select("question_id, option, created_at, poll_questions(text, option_a, option_b)")
    .eq(idCol, idVal)
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
 * Recompute the live tally for a question from its REAL votes. No priors — the
 * percentage and the respondent count are computed from the same numbers, so
 * they can never disagree. A question with no votes returns hasVotes: false.
 */
export async function getQuestionTally(questionId: string): Promise<PollPercent> {
  const admin = await createAdminClient();
  const [{ count: countA }, { count: countB }] = await Promise.all([
    admin.from("poll_votes").select("id", { count: "exact", head: true }).eq("question_id", questionId).eq("option", "a"),
    admin.from("poll_votes").select("id", { count: "exact", head: true }).eq("question_id", questionId).eq("option", "b"),
  ]);
  return computePollPercent({ countA: countA ?? 0, countB: countB ?? 0 });
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
 * Which option this ACCOUNT already chose on this question, or null. The DB
 * uniqueness key is (anon_id, question_id) only, so the same account arriving
 * with a different anon id (second device, cleared cookie) would otherwise
 * insert a second row and inflate the counter — this guard prevents that.
 * Tolerates the pre-existing duplicates in the table (takes the first vote).
 */
async function getExistingVoteByUser(questionId: string, userId: string): Promise<"a" | "b" | null> {
  const admin = await createAdminClient();
  const { data } = await admin
    .from("poll_votes")
    .select("option")
    .eq("question_id", questionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  return ((data ?? [])[0]?.option as "a" | "b" | undefined) ?? null;
}

/**
 * Record an anonymous vote. Idempotent per (anon_id, question) AND per
 * (user_id, question) — a repeat vote keeps the FIRST choice (no repeat, §7).
 * Returns the option that now stands.
 */
export async function recordVote(args: {
  questionId: string;
  option: "a" | "b";
  anonId: string;
  userId?: string | null;
}): Promise<"a" | "b"> {
  const admin = await createAdminClient();

  // Same account, different device/cookie → keep the first vote, insert nothing.
  if (args.userId) {
    const byUser = await getExistingVoteByUser(args.questionId, args.userId);
    if (byUser) return byUser;
  }

  // onConflict (anon_id, question_id) → ignoreDuplicates keeps the first vote.
  await admin
    .from("poll_votes")
    .upsert(
      { question_id: args.questionId, option: args.option, anon_id: args.anonId, user_id: args.userId ?? null },
      { onConflict: "anon_id,question_id", ignoreDuplicates: true },
    );

  // The upsert above is IGNORED when this device already answered this question,
  // so a vote cast before signing in keeps user_id = null forever — invisible to
  // any user_id lookup. linkAnonVotes only runs at auth time and cannot catch a
  // row created after it. Attribute it here, every time, so the data converges
  // rather than depending on when the person happened to sign in.
  if (args.userId) {
    await admin
      .from("poll_votes")
      .update({ user_id: args.userId })
      .eq("anon_id", args.anonId)
      .eq("question_id", args.questionId)
      .is("user_id", null);
  }

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
