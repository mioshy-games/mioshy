/**
 * GET/POST /api/journey/drift-sweep
 *
 * Layer-3 daily drift sweep. For every couple with an active
 * journey assignment, recompute drift state via the classifier
 * and upsert the journey_drift_alerts row.
 *
 * The cron does NOT message users. It only lights up the coach's
 * "needs check-in" widget on /dashboard/my-clients. Coaches make
 * the actual outreach via sendDriftCheckIn().
 *
 * Schedule: vercel.json `0 7 * * *` (daily 07:00 UTC).
 */

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getDriftForCouples } from "@/lib/journey/drift";
import { checkCoupleAnniversaries } from "@/lib/journey/anniversary";

interface Summary {
  ok:         boolean;
  considered: number;
  drifting:   number;
  silent:     number;
  errors:     string[];
}

function authOk(req: Request): boolean {
  const expected =
    process.env.JOURNEY_REMINDERS_CRON_SECRET ||
    process.env.JOURNEY_CADENCE_CRON_SECRET ||
    process.env.JOURNEY_UNLOCK_CRON_SECRET ||
    process.env.CARDCOM_CRON_SECRET;
  if (!expected) return process.env.VERCEL_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

async function handle(req: Request): Promise<NextResponse<Summary>> {
  if (!authOk(req)) {
    return NextResponse.json(
      { ok: false, considered: 0, drifting: 0, silent: 0, errors: ["unauthorized"] },
      { status: 401 },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, considered: 0, drifting: 0, silent: 0, errors: ["service_role_unavailable"] },
      { status: 503 },
    );
  }

  // Couples with at least one active assignment — narrow the set.
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("couple_id")
    .eq("is_active", true)
    .not("couple_id", "is", null);
  const coupleIds = Array.from(
    new Set(
      ((assignments ?? []) as Array<{ couple_id: string | null }>)
        .map((a) => a.couple_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const errors: string[] = [];
  let drifting = 0;
  let silent = 0;

  if (coupleIds.length === 0) {
    return NextResponse.json({ ok: true, considered: 0, drifting: 0, silent: 0, errors: [] });
  }

  const driftMap = await getDriftForCouples(coupleIds);

  // Upsert one row per couple. We don't touch coach_checked_in_*
  // here — those columns are owned by sendDriftCheckIn().
  for (const [coupleId, snap] of driftMap.entries()) {
    if (snap.state === "drifting") drifting++;
    if (snap.state === "silent")   silent++;

    const { error } = await admin
      .from("journey_drift_alerts")
      .upsert(
        {
          couple_id:        coupleId,
          last_response_at: snap.lastResponseAt,
          last_message_at:  snap.lastMessageAt,
          state:            snap.state,
        },
        { onConflict: "couple_id" },
      );
    if (error) errors.push(`${coupleId}:${error.message}`);

    // Layer-5 piggyback: check for couple anniversaries (30/90/365
    // days). Best-effort — failure here doesn't fail drift-sweep.
    try {
      await checkCoupleAnniversaries({ coupleId });
    } catch (err) {
      console.warn(
        "[drift-sweep] anniversary check failed (non-fatal)",
        coupleId,
        err,
      );
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    considered: coupleIds.length,
    drifting,
    silent,
    errors,
  });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
