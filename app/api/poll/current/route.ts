/**
 * GET /api/poll/current
 *
 * Returns the next unanswered active question for this anon (§7 — serial, no
 * skip, no repeat). Ensures the anon cookie (poll_anon_id). When every active
 * question is answered, returns { question: null, done: true }. No registration
 * required (§6).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getOrCreatePollAnonId, getPollUserId } from "@/lib/poll/anon";
import { getCurrentQuestion, getTodaysAnswerReveal } from "@/lib/poll/queries";

export async function GET() {
  const anonId = await getOrCreatePollAnonId();
  const userId = await getPollUserId(); // signed-in → key by user_id (cross-device)

  // §10 "one question per day": answered today → show that reveal (choice marked);
  // a new question only opens the next calendar day. Applies to anon + logged-in.
  const today = await getTodaysAnswerReveal(anonId, userId);
  if (today) {
    return NextResponse.json({
      question: today.question,
      done: false,
      answered: true,
      yourOption: today.option,
      pctA: today.pctA,
      pctB: today.pctB,
      totalVotes: today.totalVotes,
    });
  }

  // Not answered today → serve the next question in line.
  const current = await getCurrentQuestion(anonId, userId);
  if (current) {
    return NextResponse.json({ question: current.question, done: false, answered: false });
  }
  return NextResponse.json({ question: null, done: true });
}
