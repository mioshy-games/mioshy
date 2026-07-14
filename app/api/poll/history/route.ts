/**
 * GET /api/poll/history
 *
 * The anon's answered questions + their choices (§7 — answered questions are
 * never shown again; only the history surfaces them). No registration required.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readPollAnonId } from "@/lib/poll/anon";
import { getHistory, getHistoryWithTally } from "@/lib/poll/queries";

export async function GET(req: Request) {
  const anonId = await readPollAnonId();
  if (!anonId) return NextResponse.json({ history: [] });
  // ?tally=1 → the read-only "look back" screen with live §8 percentages
  // (dashboard history, §6). Default stays the lightweight list.
  if (new URL(req.url).searchParams.get("tally") === "1") {
    return NextResponse.json({ history: await getHistoryWithTally(anonId) });
  }
  return NextResponse.json({ history: await getHistory(anonId) });
}
