/**
 * GET|POST /api/journey/cycles/advance
 *
 * The heartbeat of the five-track model (docs/journey-five-track-model-spec.md).
 *
 * Two sweeps, in this order:
 *   1. roll over cycles whose month has elapsed (§3 — a new cycle opens after a
 *      month even if the five were not all marked)
 *   2. open a cycle for every entitled subscriber who has none — new buyers,
 *      and customers coming back from a pause, whose content has been waiting
 *
 * Runs hourly rather than daily on purpose: a cycle that becomes due at 04:00
 * should not wait until the next morning, and 2026-07-30 was a full day lost to
 * exactly that kind of daily-vs-hourly gap.
 *
 * Auth: Bearer, same cascade as the other journey crons.
 * `?dry=1` reports what would happen without writing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import {
  advanceDueCycles,
  drainExpertPushes,
  expireEndedSubscriptions,
  openCyclesForEligibleUsers,
} from "@/lib/journey-content/cycle-engine";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isCronAuthorized } from "@/lib/auth/cron-auth";

async function handle(req: Request): Promise<Response> {
  if (!isCronAuthorized(req, "journey")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = new URL(req.url).searchParams.get("dry") === "1";

  if (dry) {
    const admin = createServiceRoleClient();
    const nowIso = new Date().toISOString();
    const { data: due } = admin
      ? await admin
          .from("journey_cycles")
          .select("id, user_id, cycle_number, planned_next_open_at")
          .is("closed_at", null)
          .lte("planned_next_open_at", nowIso)
      : { data: [] };
    return NextResponse.json({ ok: true, dry: true, due_now: due ?? [] });
  }

  // Retire ended non-renewing subscriptions FIRST, so the sweeps below never
  // treat someone whose period just lapsed as an entitled subscriber.
  const expired = await expireEndedSubscriptions();

  const rolled = await advanceDueCycles();
  const opened = await openCyclesForEligibleUsers();
  // §9.3 — the expert lane, moved here from the retired weekly cron.
  const pushes = await drainExpertPushes();

  console.log("[cycles:advance]", {
    rolled_over: rolled.rolled,
    reopened: rolled.opened,
    newly_opened: opened.opened,
    expert_pushes_delivered: pushes.delivered,
    expired: expired.expired,
    skipped: [...rolled.skipped, ...opened.skipped],
  });

  return NextResponse.json({
    ok: true,
    rolled_over: rolled.rolled,
    reopened_after_rollover: rolled.opened,
    newly_opened: opened.opened,
    expert_pushes_delivered: pushes.delivered,
    expired: expired.expired,
    scanned_subscribers: opened.scanned,
    skipped: [...rolled.skipped, ...opened.skipped],
  });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
