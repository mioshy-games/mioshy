/**
 * POST /api/journey/grace-watcher
 *
 * v3 slice 5 cron - two-pass sweep over journey subscriptions:
 *
 *   PASS 1: Active journey subs whose `current_period_end` has passed
 *           without a successful renewal flip to status='grace' and
 *           get journey_grace_until = now + 14 days. The cadence
 *           engine then pauses materialization for them; past
 *           scheduled_items stay readable; the banner appears on
 *           every journey surface.
 *
 *   PASS 2: Subs that are already in grace AND past their
 *           journey_grace_until AND haven't been stamped yet get
 *           journey_blocked_at = now(). status STAYS 'grace' on
 *           purpose - Itzik's slice 5 brief: "transition to
 *           'blocked' would conflate with billing-failure blocked".
 *           getUserEntitlements() distinguishes blocked-vs-grace
 *           via the journey_blocked_at column, not the status enum.
 *
 * The existing 7-day `grace_until` column (payment-failure window
 * set by the renewal cron) is UNTOUCHED - different lifecycle,
 * different code path.
 *
 * On a successful renewal, the Cardcom indicator + renewal cron
 * clear journey_grace_until + journey_blocked_at (added in this slice
 * - see app/api/billing/cardcom/indicator/route.ts and
 * app/api/billing/renewals/run/route.ts) so the user re-enters
 * 'active' state on the next entitlement read.
 *
 * Auth: Bearer token. Resolution order matches the other journey
 * crons: JOURNEY_GRACE_CRON_SECRET → JOURNEY_CADENCE_CRON_SECRET →
 * JOURNEY_UNLOCK_CRON_SECRET → CARDCOM_BILLING_CRON_SECRET.
 *
 * Schedule: vercel.json runs hourly at :00 (`0 * * * *`).
 *
 * Manual test:
 *   curl -X POST $SITE_URL/api/journey/grace-watcher \
 *        -H "authorization: Bearer $JOURNEY_GRACE_CRON_SECRET"
 *
 * Optional `?dry=1` returns the rows that WOULD be updated without
 * writing - useful to inspect from a test account.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { runWithCronLog } from "@/lib/journey-content/cron-log";
import {
  notifyOnBlocked,
  notifyOnGraceStarted,
} from "@/lib/journey-content/notifications";

const GRACE_WINDOW_DAYS = 14;

interface RunSummary {
  ok: boolean;
  pass1_to_grace: number;
  pass2_to_blocked: number;
  errors: Array<{ pass: 1 | 2; subscription_id: string; error: string }>;
  dryRun: boolean;
  affected?: {
    pass1: Array<{
      subscription_id: string;
      user_id: string | null;
      current_period_end: string | null;
    }>;
    pass2: Array<{
      subscription_id: string;
      user_id: string | null;
      journey_grace_until: string | null;
    }>;
  };
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  const secret =
    process.env.JOURNEY_GRACE_CRON_SECRET ||
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

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const verbose = url.searchParams.get("verbose") === "1" || dryRun;

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "no admin client" },
      { status: 500 },
    );
  }

  const summary: RunSummary = {
    ok: true,
    pass1_to_grace: 0,
    pass2_to_blocked: 0,
    errors: [],
    dryRun,
    affected: verbose ? { pass1: [], pass2: [] } : undefined,
  };
  const nowIso = new Date().toISOString();
  const graceUntilIso = new Date(
    Date.now() + GRACE_WINDOW_DAYS * 86_400_000,
  ).toISOString();

  // ── Pass 1: active journey subs whose period ended → flip to grace ──
  const { data: pass1Rows, error: p1ReadErr } = await admin
    .from("subscriptions")
    .select("id, user_id, current_period_end")
    .eq("product", "journey")
    .eq("status", "active")
    .lt("current_period_end", nowIso);
  if (p1ReadErr) {
    summary.ok = false;
    summary.errors.push({
      pass: 1,
      subscription_id: "*",
      error: p1ReadErr.message,
    });
  } else {
    for (const row of (pass1Rows ?? []) as Array<{
      id: string;
      user_id: string | null;
      current_period_end: string | null;
    }>) {
      summary.affected?.pass1.push({
        subscription_id: row.id,
        user_id: row.user_id,
        current_period_end: row.current_period_end,
      });
      if (dryRun) {
        summary.pass1_to_grace++;
        continue;
      }
      const { error: updErr } = await admin
        .from("subscriptions")
        .update({
          status: "grace",
          journey_grace_until: graceUntilIso,
          // journey_blocked_at stays NULL - pass 2 stamps it 14 days later.
        })
        .eq("id", row.id);
      if (updErr) {
        summary.ok = false;
        summary.errors.push({
          pass: 1,
          subscription_id: row.id,
          error: updErr.message,
        });
        continue;
      }
      summary.pass1_to_grace++;
      // Slice 10 - notify the user about the grace start (in-app + email).
      // Best-effort; a notify failure doesn't roll back the state flip.
      if (row.user_id) {
        try {
          await notifyOnGraceStarted({
            recipientUserId: row.user_id,
            graceUntil: graceUntilIso,
            // No locale on subscriptions; default to Hebrew (primary).
            // A future migration could add profiles.locale and resolve here.
            locale: "he",
          });
        } catch (e) {
          console.warn("[grace-watcher] notifyOnGraceStarted failed", e);
        }
      }
    }
  }

  // ── Pass 2: grace subs past journey_grace_until, not yet blocked ──
  const { data: pass2Rows, error: p2ReadErr } = await admin
    .from("subscriptions")
    .select("id, user_id, journey_grace_until")
    .eq("product", "journey")
    .eq("status", "grace")
    .is("journey_blocked_at", null)
    .lt("journey_grace_until", nowIso);
  if (p2ReadErr) {
    summary.ok = false;
    summary.errors.push({
      pass: 2,
      subscription_id: "*",
      error: p2ReadErr.message,
    });
  } else {
    for (const row of (pass2Rows ?? []) as Array<{
      id: string;
      user_id: string | null;
      journey_grace_until: string | null;
    }>) {
      summary.affected?.pass2.push({
        subscription_id: row.id,
        user_id: row.user_id,
        journey_grace_until: row.journey_grace_until,
      });
      if (dryRun) {
        summary.pass2_to_blocked++;
        continue;
      }
      const { error: updErr } = await admin
        .from("subscriptions")
        .update({
          journey_blocked_at: nowIso,
          // status stays 'grace' on purpose. blocked-vs-grace
          // distinction is on the column, not the status enum.
        })
        .eq("id", row.id);
      if (updErr) {
        summary.ok = false;
        summary.errors.push({
          pass: 2,
          subscription_id: row.id,
          error: updErr.message,
        });
        continue;
      }
      summary.pass2_to_blocked++;
      if (row.user_id) {
        try {
          await notifyOnBlocked({
            recipientUserId: row.user_id,
            locale: "he",
          });
        } catch (e) {
          console.warn("[grace-watcher] notifyOnBlocked failed", e);
        }
      }
    }
  }

  // Slice 9 - log the run (skipped on dry-run).
  if (!dryRun) {
    await runWithCronLog("grace_watcher", async () => ({
      rowsProcessed: summary.pass1_to_grace + summary.pass2_to_blocked,
      payload: {
        pass1_to_grace: summary.pass1_to_grace,
        pass2_to_blocked: summary.pass2_to_blocked,
        errors_count: summary.errors.length,
        errors: summary.errors.slice(0, 5),
      },
      error: summary.ok
        ? undefined
        : `${summary.errors.length} pass error(s)`,
    }));
  }

  return NextResponse.json(summary, {
    status: summary.ok ? 200 : 207,
  });
}
