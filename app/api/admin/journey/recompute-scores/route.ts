/**
 * POST /api/admin/journey/recompute-scores
 *
 * Phase 5 — admin trigger that recomputes the journey_user_scores
 * table for every user with recent activity. Idempotent; safe to run
 * on a schedule (Vercel Cron @daily 02:00) or manually from a button.
 *
 * Auth: requires the caller to be an admin via requireExpert().
 *
 * Returns a small JSON summary so the cron / button has something
 * to log.
 */

import { NextResponse } from "next/server";
import { requireExpert } from "@/lib/auth/expert";
import { recomputeAllUserScores } from "@/lib/dashboard/user-scoring";

export const dynamic = "force-dynamic";
// Heavy job; run on Node, not edge.
export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const session = await requireExpert();
  if (!session.isAdmin) {
    return NextResponse.json(
      { ok: false, error: "admin_only" },
      { status: 403 },
    );
  }

  const result = await recomputeAllUserScores({ now: new Date() });
  return NextResponse.json(
    {
      ok: true,
      processed: result.totalProcessed,
      failed: result.totalFailed,
      durationMs: result.durationMs,
      generatedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}
