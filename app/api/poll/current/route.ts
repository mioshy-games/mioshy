/**
 * GET /api/poll/current
 *
 * Returns the next unanswered active question for this device (§7 — serial, no
 * skip, no repeat). Identity = the poll anon cookie, recovered from the client's
 * `x-poll-anon` mirror when the cookie is gone, and re-set on the response.
 * When every active question is answered, returns { question: null, done: true }.
 * No registration required (§6), and no daily gate — the flow is continuous:
 * a returning visitor simply resumes at the first question they have not seen.
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
import { getCurrentQuestion } from "@/lib/poll/queries";

export async function GET(req: Request) {
  const { id: anonId, fresh } = await resolvePollAnonId(readPollAnonHeader(req));
  const userId = await getPollUserId(); // signed-in → key by user_id (cross-device)

  const current = await getCurrentQuestion(anonId, userId);
  const res = current
    ? NextResponse.json({ question: current.question, done: false })
    : NextResponse.json({ question: null, done: true });

  if (fresh) setPollAnonCookie(res, anonId);
  return res;
}
