/**
 * POST /api/journey/notify-unlocks
 *
 * Cron endpoint - scans journey_scheduled_items for rows whose `unlock_at`
 * has passed but haven't been notified yet, then emails each owner (both
 * couple members when applicable) a summary of the freshly-unlocked
 * chapters. Items that were already completed or belong to an inactive
 * assignment are silently skipped.
 *
 * Auth: Bearer — CRON_SECRET (what Vercel Cron sends) or JOURNEY_CRON_SECRET.
 *       See lib/auth/cron-auth.ts. Audit 2026-08-05, H2.
 * schedulers until operators set up the dedicated one.
 *
 * Vercel cron: see vercel.json - runs hourly.
 *
 * Manual test:
 *   curl -X POST $SITE_URL/api/journey/notify-unlocks \
 *        -H "authorization: Bearer $JOURNEY_CRON_SECRET"
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

import { NextResponse } from "next/server";
import { runJourneyUnlockNotifier } from "@/lib/journey-content/notify-unlocks";
import { runWithCronLog } from "@/lib/journey-content/cron-log";
import { isCronAuthorized } from "@/lib/auth/cron-auth";

export async function POST(req: Request) {
  return handle(req);
}

// 2026-05-31 — Vercel cron pings with GET, not POST. The original GET
// handler returned 405 as a "health check" hint, which silently broke
// the hourly unlock-notifier cron every run. Accept both methods now,
// same as /api/journey/cadence/advance does. The bearer-token check
// inside `handle` still gates execution — uncredentialed pings get 401.
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  if (!isCronAuthorized(req, "journey")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    // Slice 9 - wrap in runWithCronLog so the health board can show
    // recent runs. The notifier returns its own ok/errors shape so
    // we surface that to the log helper.
    type NotifierResult = Awaited<ReturnType<typeof runJourneyUnlockNotifier>>;
    let captured: NotifierResult | null = null;
    await runWithCronLog("notify_unlocks", async () => {
      const result = await runJourneyUnlockNotifier({
        limit: Number.isFinite(limit) ? limit : undefined,
      });
      captured = result;
      return {
        rowsProcessed: result.dispatched ?? 0,
        payload: {
          scanned: result.scanned,
          dispatched: result.dispatched,
          skipped: result.skipped,
          errors_count: result.errors.length,
          errors: result.errors.slice(0, 5),
        },
        error: result.ok ? undefined : `${result.errors.length} send error(s)`,
      };
    });

    const result = captured!;
    return NextResponse.json(result, {
      status: result.ok ? 200 : 207,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        scanned: 0,
        dispatched: 0,
        skipped: 0,
        errors: [
          {
            where: "handler",
            message: err instanceof Error ? err.message : String(err),
          },
        ],
        recipients: [],
      },
      { status: 500 },
    );
  }
}

// (The previous unauthenticated GET no-op was removed when GET became
//  the cron entry point. Operators can curl with the bearer token now,
//  same as POST.)
