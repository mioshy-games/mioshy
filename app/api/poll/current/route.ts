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
import { getOrCreatePollAnonId } from "@/lib/poll/anon";
import { getCurrentQuestion, getLastAnsweredReveal } from "@/lib/poll/queries";

export async function GET() {
  const anonId = await getOrCreatePollAnonId();
  const current = await getCurrentQuestion(anonId);
  if (current) {
    return NextResponse.json({ question: current.question, done: false, answered: false });
  }
  // §10 — nothing new to answer: a returning user sees their most recent answer's
  // reveal (choice marked + live %) instead of a bare "done".
  const last = await getLastAnsweredReveal(anonId);
  if (last) {
    return NextResponse.json({
      question: last.question,
      done: false,
      answered: true,
      yourOption: last.option,
      pctA: last.pctA,
      pctB: last.pctB,
      totalVotes: last.totalVotes,
    });
  }
  return NextResponse.json({ question: null, done: true });
}
