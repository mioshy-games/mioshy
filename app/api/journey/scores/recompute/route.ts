/**
 * POST /api/journey/scores/recompute
 *
 * Slice 9 - Bearer-secured cron entry that recomputes
 * journey_user_scores for every user with recent activity.
 *
 * The existing /api/admin/journey/recompute-scores route stays for
 * manual admin triggering (button in the dashboard); this endpoint
 * exists so vercel.json can run it on a schedule without holding an
 * admin session. Both wrap the same recomputeAllUserScores() worker.
 *
 * Auth: Bearer token. Resolution order matches the other journey
 * crons: JOURNEY_SCORES_CRON_SECRET → JOURNEY_CADENCE_CRON_SECRET →
 * JOURNEY_UNLOCK_CRON_SECRET → CARDCOM_BILLING_CRON_SECRET.
 *
 * Schedule: vercel.json runs daily at 04:00 UTC (`0 4 * * *`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { recomputeAllUserScores } from "@/lib/dashboard/user-scoring";
import { runWithCronLog } from "@/lib/journey-content/cron-log";

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  const secret =
    process.env.JOURNEY_SCORES_CRON_SECRET ||
    process.env.JOURNEY_CADENCE_CRON_SECRET ||
    process.env.JOURNEY_UNLOCK_CRON_SECRET ||
    process.env.CARDCOM_BILLING_CRON_SECRET;
  const bearer = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runWithCronLog("scores_recompute", async () => {
    const result = await recomputeAllUserScores({ now: new Date() });
    return {
      rowsProcessed: result.totalProcessed,
      payload: {
        processed: result.totalProcessed,
        failed: result.totalFailed,
        durationMs: result.durationMs,
      },
      // The worker doesn't surface a top-level error string; partial
      // failures are inside the per-user loop and counted in
      // `totalFailed`. We mark the run failed when failed > 0.
      error:
        result.totalFailed > 0
          ? `${result.totalFailed} user(s) failed to recompute`
          : undefined,
    };
  });

  return NextResponse.json(
    {
      ok: !summary.error,
      ...summary.payload,
    },
    { status: summary.error ? 207 : 200 },
  );
}
