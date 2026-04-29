/**
 * POST /api/journey/notify-unlocks
 *
 * Cron endpoint — scans journey_scheduled_items for rows whose `unlock_at`
 * has passed but haven't been notified yet, then emails each owner (both
 * couple members when applicable) a summary of the freshly-unlocked
 * chapters. Items that were already completed or belong to an inactive
 * assignment are silently skipped.
 *
 * Auth: Bearer token. Prefers JOURNEY_UNLOCK_CRON_SECRET; falls back to
 * CARDCOM_BILLING_CRON_SECRET so a single cron secret can power both
 * schedulers until operators set up the dedicated one.
 *
 * Vercel cron: see vercel.json — runs hourly.
 *
 * Manual test:
 *   curl -X POST $SITE_URL/api/journey/notify-unlocks \
 *        -H "authorization: Bearer $JOURNEY_UNLOCK_CRON_SECRET"
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

import { NextResponse } from "next/server";
import { runJourneyUnlockNotifier } from "@/lib/journey-content/notify-unlocks";

export async function POST(req: Request) {
  const secret =
    process.env.JOURNEY_UNLOCK_CRON_SECRET ||
    process.env.CARDCOM_BILLING_CRON_SECRET;
  const bearer = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!secret || bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const result = await runJourneyUnlockNotifier({
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    return NextResponse.json(result, {
      status: result.ok ? 200 : 207, // 207 = partial success (some errors)
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

// GET is a no-op health check so operators can curl without a secret to
// confirm the route is deployed. Returns 405 so monitors don't accidentally
// use it as a success signal for the cron itself.
export async function GET() {
  return NextResponse.json(
    { ok: true, hint: "POST with bearer token to dispatch unlock emails" },
    { status: 405 },
  );
}
