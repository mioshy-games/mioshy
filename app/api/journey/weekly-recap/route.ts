/**
 * GET/POST /api/journey/weekly-recap
 *
 * Layer-4 Sunday-morning cron. Generates one weekly recap per
 * couple with at least one active assignment.
 *
 * Idempotency: composite-unique (couple_id, week_starting) on
 * journey_weekly_recaps. UPSERT so a re-run within the same week
 * just refreshes the summary if data changed.
 *
 * Schedule: vercel.json `0 6 * * 0` (Sunday 06:00 UTC).
 */

export const runtime  = "nodejs";
export const dynamic  = "force-dynamic";
export const maxDuration = 180;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  computeWeeklyRecap,
  startOfWeekSundayUTC,
} from "@/lib/journey/weekly-recap";

interface Summary {
  ok:         boolean;
  considered: number;
  written:    number;
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
      { ok: false, considered: 0, written: 0, errors: ["unauthorized"] },
      { status: 401 },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, considered: 0, written: 0, errors: ["service_role_unavailable"] },
      { status: 503 },
    );
  }

  // Recap covers the week that JUST ended (the Sunday before the
  // current one). Run-day is Sunday morning so the user opens the
  // app and sees a full picture of what they did the previous week.
  const today = startOfWeekSundayUTC(new Date());
  const weekStarting = new Date(today);
  weekStarting.setUTCDate(weekStarting.getUTCDate() - 7);

  // Eligible couples: at least one active assignment.
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
  let written = 0;

  for (const coupleId of coupleIds) {
    try {
      const recap = await computeWeeklyRecap(coupleId, weekStarting);
      if (!recap) continue;

      const { error } = await admin.from("journey_weekly_recaps").upsert(
        {
          couple_id:       coupleId,
          week_starting:   weekStarting.toISOString().slice(0, 10),
          summary_he:      recap.summary_he,
          summary_en:      recap.summary_en,
          notable_signals: recap.notable_signals,
        },
        { onConflict: "couple_id,week_starting" },
      );
      if (error) {
        errors.push(`${coupleId}:${error.message}`);
        continue;
      }
      written++;
    } catch (err) {
      errors.push(`${coupleId}:${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    considered: coupleIds.length,
    written,
    errors,
  });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
