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
import { getHistory } from "@/lib/poll/queries";

export async function GET() {
  const anonId = await readPollAnonId();
  if (!anonId) return NextResponse.json({ history: [] });
  const history = await getHistory(anonId);
  return NextResponse.json({ history });
}
