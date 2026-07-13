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
import { getCurrentQuestion } from "@/lib/poll/queries";

export async function GET() {
  const anonId = await getOrCreatePollAnonId();
  const current = await getCurrentQuestion(anonId);
  if (!current) {
    return NextResponse.json({ question: null, done: true });
  }
  return NextResponse.json({ question: current.question, done: false });
}
