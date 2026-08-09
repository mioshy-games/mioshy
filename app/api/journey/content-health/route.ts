/**
 * GET|POST /api/journey/content-health
 *
 * Daily guard: does any paying journey subscriber have no content at all?
 *
 * This is the alarm for the failure that already happened silently — both
 * paying subscribers sat empty for weeks because their priority ranking was
 * never written and every delivery path rejects a user without one. Nothing in
 * the system noticed. See lib/journey-content/content-health.ts.
 *
 * Auth: Bearer token, same cascade as the other journey crons.
 * Schedule: vercel.json, daily at 08:30 UTC (after the 06:00 renewals run and
 * the hourly grace-watcher have settled, so a user mid-renewal is not flagged
 * on a transient state).
 *
 * `?days=N` overrides the window; `?dry=1` reports without alerting.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cron-auth";
import {
  findStarvedSubscribers,
  reportStarvedSubscribers,
  NO_CONTENT_ALERT_DAYS,
} from "@/lib/journey-content/content-health";

async function handle(req: Request): Promise<Response> {
  if (!isCronAuthorized(req, "journey")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const days = Number(url.searchParams.get("days") ?? NO_CONTENT_ALERT_DAYS);
  const window = Number.isFinite(days) && days > 0 ? days : NO_CONTENT_ALERT_DAYS;

  const result = dry
    ? await findStarvedSubscribers(window)
    : await reportStarvedSubscribers(window);

  return NextResponse.json({
    ok: !result.error,
    dry,
    days: window,
    checked: result.checked,
    starved_count: result.starved.length,
    starved: result.starved,
    error: result.error,
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
