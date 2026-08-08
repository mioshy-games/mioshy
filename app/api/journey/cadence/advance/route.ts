/**
 * POST /api/journey/cadence/advance
 *
 * v3 slice 3 cron - scans every user with an active cadence assignment,
 * checks whether their effective delivery slot has fired (per their
 * profile overrides + journey_settings defaults), respects the weekly
 * cap, and materializes one item per eligible user.
 *
 * Idempotency:
 *   - The picker filters out items in journey_user_delivered_items.
 *   - The dedup table's PK on (user_id, item_id) acts as a lock so
 *     concurrent runs (cron tick + day-1 trigger) can't double-deliver.
 *   - Weekly cap reads recent rows and short-circuits before the
 *     materializer fires.
 *
 * Auth: Bearer — CRON_SECRET (what Vercel Cron sends) or JOURNEY_CRON_SECRET.
 *       See lib/auth/cron-auth.ts. Audit 2026-08-05, H2.
 * keeps deploy-time setup minimal - operators can run all three crons
 * with one shared secret until they're ready to split them out.
 *
 * Schedule: vercel.json runs this every 15 minutes (`*​/15 * * * *`).
 *
 * Manual test:
 *   curl -X POST $SITE_URL/api/journey/cadence/advance \
 *        -H "authorization: Bearer $JOURNEY_CRON_SECRET"
 *
 * Optional `?dry=1` returns the eligibility decision per user without
 * inserting any rows - useful for inspecting the engine on a test
 * account without touching state.
 *
 * Optional `?user=<uuid>` restricts the run to a single user, again
 * useful for the dry-run path.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  checkWeeklyDeliveryState,
  isCadenceEligible,
  isDeliverySlotNow,
  materializeNextItemForUser,
} from "@/lib/journey-content/cadence-engine";
import { getJourneySettings } from "@/lib/journey-content/journey-settings";
import { runWithCronLog } from "@/lib/journey-content/cron-log";
import { isCronAuthorized } from "@/lib/auth/cron-auth";

interface RunSummary {
  ok: boolean;
  scanned: number;
  delivered: number;
  skipped: number;
  errors: Array<{ user_id: string; error: string }>;
  dryRun: boolean;
  perUser?: Array<{
    user_id: string;
    decision:
      | "delivered"
      | "skipped_not_eligible"
      | "skipped_wrong_day"
      | "skipped_before_hour"
      | "skipped_cap_reached"
      | "skipped_already_today"
      | "skipped_no_candidates"
      | "skipped_duplicate"
      | "error";
    detail?: string;
  }>;
}

export async function POST(req: Request) {
  return handle(req);
}

// Vercel cron uses GET by default for some configurations; accept both.
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  if (!isCronAuthorized(req, "journey")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const singleUserId = url.searchParams.get("user");
  const verbose = url.searchParams.get("verbose") === "1" || dryRun;

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "no admin client" },
      { status: 500 },
    );
  }

  // Find every user with an active cadence assignment. The partial
  // unique index from migration 058 makes this query cheap.
  let q = admin
    .from("journey_assignments")
    .select("user_id")
    .eq("source_kind", "cadence")
    .eq("is_active", true)
    .not("user_id", "is", null);
  if (singleUserId) q = q.eq("user_id", singleUserId);
  const { data: assignmentRows, error: scanErr } = await q;
  if (scanErr) {
    return NextResponse.json(
      { ok: false, error: scanErr.message },
      { status: 500 },
    );
  }
  const userIds = Array.from(
    new Set((assignmentRows ?? []).map((r) => r.user_id as string)),
  );

  // For each user we need their profile cadence overrides. Batch
  // fetch in one round trip rather than N queries.
  const { data: profiles } = await admin
    .from("profiles")
    .select(
      "id, journey_delivery_days, journey_delivery_local_hour, journey_paused_at",
    )
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);
  const profileById = new Map<
    string,
    {
      journey_delivery_days: number[] | null;
      journey_delivery_local_hour: number | null;
      journey_paused_at: string | null;
    }
  >();
  for (const p of (profiles ?? []) as Array<{
    id: string;
    journey_delivery_days: number[] | null;
    journey_delivery_local_hour: number | null;
    journey_paused_at: string | null;
  }>) {
    profileById.set(p.id, {
      journey_delivery_days: p.journey_delivery_days ?? null,
      journey_delivery_local_hour: p.journey_delivery_local_hour ?? null,
      journey_paused_at: p.journey_paused_at ?? null,
    });
  }

  const settings = await getJourneySettings();
  const summary: RunSummary = {
    ok: true,
    scanned: userIds.length,
    delivered: 0,
    skipped: 0,
    errors: [],
    dryRun,
    perUser: verbose ? [] : undefined,
  };
  const now = new Date();

  for (const userId of userIds) {
    const profile = profileById.get(userId);
    const slot = isDeliverySlotNow(
      settings,
      profile?.journey_delivery_days ?? null,
      profile?.journey_delivery_local_hour ?? null,
      now,
    );
    if (!slot.isSlot) {
      summary.skipped++;
      summary.perUser?.push({
        user_id: userId,
        decision:
          slot.reason === "wrong_day"
            ? "skipped_wrong_day"
            : "skipped_before_hour",
      });
      continue;
    }

    const elig = await isCadenceEligible(userId);
    if (!elig.eligible) {
      summary.skipped++;
      summary.perUser?.push({
        user_id: userId,
        decision: "skipped_not_eligible",
        detail: elig.reason,
      });
      continue;
    }

    const weekly = await checkWeeklyDeliveryState(
      userId,
      settings.defaultCuratedPerWeek,
    );
    if (weekly.deliveredToday) {
      summary.skipped++;
      summary.perUser?.push({
        user_id: userId,
        decision: "skipped_already_today",
      });
      continue;
    }
    if (weekly.capReached) {
      summary.skipped++;
      summary.perUser?.push({
        user_id: userId,
        decision: "skipped_cap_reached",
      });
      continue;
    }

    if (dryRun) {
      summary.perUser?.push({
        user_id: userId,
        decision: "delivered",
        detail: "dry-run: would materialize next item",
      });
      continue;
    }

    const res = await materializeNextItemForUser(userId, {
      unlockAt: now,
      source: "cadence",
    });
    if (res.ok) {
      summary.delivered++;
      summary.perUser?.push({
        user_id: userId,
        decision: "delivered",
        detail: res.itemId,
      });
    } else if (res.reason === "no_candidates") {
      summary.skipped++;
      summary.perUser?.push({
        user_id: userId,
        decision: "skipped_no_candidates",
      });
    } else if (res.reason === "duplicate") {
      summary.skipped++;
      summary.perUser?.push({
        user_id: userId,
        decision: "skipped_duplicate",
      });
    } else {
      summary.ok = false;
      summary.errors.push({
        user_id: userId,
        error: res.error ?? res.reason ?? "unknown",
      });
      summary.perUser?.push({
        user_id: userId,
        decision: "error",
        detail: res.error ?? res.reason,
      });
    }
  }

  // Slice 9 - log the run to journey_cron_runs (skipped on dry-run
  // so the health board reflects real execution). Wrapped in a
  // synchronous wrapper since the heavy lifting already happened.
  if (!dryRun) {
    await runWithCronLog("cadence_advance", async () => ({
      rowsProcessed: summary.delivered,
      payload: {
        scanned: summary.scanned,
        delivered: summary.delivered,
        skipped: summary.skipped,
        errors_count: summary.errors.length,
        errors: summary.errors.slice(0, 5),
        single_user: singleUserId ?? null,
      },
      error: summary.ok
        ? undefined
        : `${summary.errors.length} per-user error(s)`,
    }));
  }

  return NextResponse.json(summary, {
    status: summary.ok ? 200 : 207,
  });
}
