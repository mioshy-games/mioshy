/**
 * POST /api/poll/vote   body: { questionId: string, option: "a" | "b" }
 *
 * Records an anonymous vote (§6: no registration to answer) and returns the live
 * Bayesian tally for the immediate reveal (§8). Every vote is saved (§4/§13);
 * a repeat on the same question keeps the first choice (no repeat, §7) — both
 * for the same device (anon_id) and the same account (user_id), so a signed-in
 * user on a second device/browser is never counted twice.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  getPollUserId,
  readPollAnonHeader,
  resolvePollAnonId,
  setPollAnonCookie,
} from "@/lib/poll/anon";
import { recordVote, getQuestionTally } from "@/lib/poll/queries";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const questionId = typeof body?.questionId === "string" ? body.questionId : "";
  const option = body?.option === "a" || body?.option === "b" ? body.option : null;

  if (!questionId || !option) {
    return NextResponse.json({ error: "questionId and option (a|b) are required" }, { status: 400 });
  }

  const { id: anonId, fresh } = await resolvePollAnonId(readPollAnonHeader(req));
  const userId = await getPollUserId(); // signed-in → attribute the vote to the user too

  let yourOption: "a" | "b";
  try {
    yourOption = await recordVote({ questionId, option, anonId, userId });
  } catch (err) {
    console.error("[poll/vote] failed", err);
    return NextResponse.json({ error: "vote_failed" }, { status: 500 });
  }

  const tally = await getQuestionTally(questionId);
  const res = NextResponse.json({ yourOption, ...tally });
  if (fresh) setPollAnonCookie(res, anonId);
  return res;
}
