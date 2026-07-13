/**
 * GET /api/poll/current
 *
 * Returns the current active poll question. Ensures the anonymous voter cookie
 * (poll_anon_id) exists. If this anon already voted on the question, the live
 * tally + their choice are included so the client can jump straight to reveal
 * (no repeat, §7). No registration required (§6).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrCreatePollAnonId } from "@/lib/poll/anon";
import { getCurrentQuestion, getExistingVote, getQuestionTally } from "@/lib/poll/queries";

export async function GET() {
  await getOrCreatePollAnonId(); // sets the cookie on first visit
  const current = await getCurrentQuestion();
  if (!current) {
    return NextResponse.json({ question: null });
  }
  const { question } = current;

  const anonId = await getOrCreatePollAnonId();
  const existing = await getExistingVote(question.id, anonId);
  const tally = existing ? await getQuestionTally(question.id) : null;

  return NextResponse.json({
    question,
    yourOption: existing,          // "a" | "b" | null
    tally,                         // present only if already voted
  });
}
