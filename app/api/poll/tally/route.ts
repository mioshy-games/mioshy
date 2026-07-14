/**
 * GET /api/poll/tally?questionId=...
 *
 * Live Bayesian tally for one question (§8) — recomputed from real vote counts
 * on every call (never cached, never invented). Used by the reveal to refresh
 * the live counter/percentages.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getQuestionTally } from "@/lib/poll/queries";

export async function GET(req: Request) {
  const questionId = new URL(req.url).searchParams.get("questionId")?.trim();
  if (!questionId) {
    return NextResponse.json({ error: "questionId required" }, { status: 400 });
  }
  const tally = await getQuestionTally(questionId);
  return NextResponse.json(tally);
}
