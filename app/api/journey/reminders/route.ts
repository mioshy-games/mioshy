/**
 * POST /api/journey/reminders
 *
 * Slice 10 - daily reminder cron at 08:00 UTC. Three sweeps:
 *
 *   1. INACTIVITY: cadence-eligible users whose last delivered item
 *      is ≥5 days old AND has no response - and who haven't already
 *      received a reminder_inactivity in the last 5 days. Sends both
 *      in-app + email.
 *
 *   2. UNFOLLOWED REPLY: per-item threads where the latest expert
 *      reply is >24h old AND the user hasn't followed up. In-app
 *      only (no email - too noisy).
 *
 *   3. STUCK USERS DIGEST: one email per day to the admin pool
 *      summarising getStuckUsers() output. Throttled by the
 *      notifyAdminPool helper's same-kind window.
 *
 * Skips users in grace or blocked (eligibility gate handles).
 *
 * Auth: Bearer. Resolution: JOURNEY_REMINDERS_CRON_SECRET → cadence
 * → unlock → cardcom.
 *
 * Schedule: vercel.json runs daily at 08:00 UTC (`0 8 * * *`).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isCadenceEligible } from "@/lib/journey-content/cadence-engine";
import {
  notifyAdminPool,
  notifyOnReminderInactivity,
  notifyOnReminderUnfollowedReply,
} from "@/lib/journey-content/notifications";
import { getStuckUsers } from "@/lib/journey-content/observability";
import { runWithCronLog } from "@/lib/journey-content/cron-log";

const INACTIVITY_DAYS = 5;
const UNFOLLOWED_HOURS = 24;

interface ReminderSummary {
  ok: boolean;
  inactivity_sent: number;
  unfollowed_sent: number;
  stuck_users: number;
  errors: string[];
  dryRun: boolean;
}

export async function POST(req: Request) {
  return handle(req);
}
export async function GET(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  const secret =
    process.env.JOURNEY_REMINDERS_CRON_SECRET ||
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

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "no admin client" },
      { status: 500 },
    );
  }

  const summary: ReminderSummary = {
    ok: true,
    inactivity_sent: 0,
    unfollowed_sent: 0,
    stuck_users: 0,
    errors: [],
    dryRun,
  };

  // ── Sweep 1 - INACTIVITY ──────────────────────────────────────────
  // Find every user with an active cadence assignment whose latest
  // cadence delivery is ≥5 days old and has no response. Also gate
  // on "no reminder in the last 5 days" so we don't spam.
  const fiveDaysAgo = new Date(
    Date.now() - INACTIVITY_DAYS * 86_400_000,
  ).toISOString();

  const { data: candidateRows, error: candErr } = await admin
    .from("journey_assignments")
    .select(
      "user_id, journey_scheduled_items(id, item_id, unlock_at, responded_at, journey_items(title_he))",
    )
    .eq("source_kind", "cadence")
    .eq("is_active", true)
    .not("user_id", "is", null);
  if (candErr) {
    summary.ok = false;
    summary.errors.push(`inactivity_scan: ${candErr.message}`);
  } else {
    for (const row of (candidateRows ?? []) as Array<{
      user_id: string;
      journey_scheduled_items:
        | Array<{
            id: string;
            item_id: string;
            unlock_at: string;
            responded_at: string | null;
            journey_items:
              | { title_he: string }
              | Array<{ title_he: string }>
              | null;
          }>
        | null;
    }>) {
      const sched = row.journey_scheduled_items ?? [];
      if (sched.length === 0) continue;
      // Latest cadence delivery
      const latest = sched
        .filter((s) => new Date(s.unlock_at).getTime() <= Date.now())
        .sort((a, b) =>
          (b.unlock_at ?? "").localeCompare(a.unlock_at ?? ""),
        )[0];
      if (!latest) continue;
      const ageDays =
        (Date.now() - new Date(latest.unlock_at).getTime()) / 86_400_000;
      if (ageDays < INACTIVITY_DAYS) continue;
      if (latest.responded_at) continue;

      // Eligibility gate (skip grace + blocked).
      const elig = await isCadenceEligible(row.user_id);
      if (!elig.eligible) continue;

      // Throttle: skip if a reminder_inactivity already exists for
      // this user in the last 5 days.
      const { count } = await admin
        .from("journey_notifications")
        .select("id", { head: true, count: "exact" })
        .eq("recipient_kind", "user")
        .eq("recipient_user_id", row.user_id)
        .eq("kind", "reminder_inactivity")
        .gte("created_at", fiveDaysAgo);
      if ((count ?? 0) > 0) continue;

      if (dryRun) {
        summary.inactivity_sent++;
        continue;
      }

      const titleRow = Array.isArray(latest.journey_items)
        ? latest.journey_items[0]
        : latest.journey_items;
      const title = titleRow?.title_he ?? null;

      try {
        await notifyOnReminderInactivity({
          recipientUserId: row.user_id,
          locale: "he",
          lastItemTitle: title,
          lastItemHref: `/he/journey/timeline/${latest.id}`,
        });
        summary.inactivity_sent++;
      } catch (e) {
        summary.errors.push(
          `inactivity:${row.user_id}: ${e instanceof Error ? e.message : "?"}`,
        );
        summary.ok = false;
      }
    }
  }

  // ── Sweep 2 - UNFOLLOWED EXPERT REPLY ─────────────────────────────
  // Find per-item threads where:
  //   * the latest message in the thread is from the expert
  //   * its created_at is older than 24h
  //   * the user owning the underlying scheduled_item hasn't posted
  //     a follow-up since
  //   * no reminder_unfollowed_reply for this scheduled_item in
  //     the last 24h
  const unfollowedCutoff = new Date(
    Date.now() - UNFOLLOWED_HOURS * 3600_000,
  ).toISOString();
  const { data: expertReplies } = await admin
    .from("journey_messages")
    .select("id, scheduled_item_id, created_at")
    .eq("author_kind", "expert")
    .not("scheduled_item_id", "is", null)
    .lt("created_at", unfollowedCutoff)
    .order("created_at", { ascending: false })
    .limit(500);

  // Group by scheduled_item, keep only the latest expert reply per item.
  const latestByItem = new Map<string, string>();
  for (const r of (expertReplies ?? []) as Array<{
    scheduled_item_id: string;
    created_at: string;
  }>) {
    if (!latestByItem.has(r.scheduled_item_id)) {
      latestByItem.set(r.scheduled_item_id, r.created_at);
    }
  }

  if (latestByItem.size > 0) {
    const itemIds = Array.from(latestByItem.keys());
    // Find any USER posts on these items more recent than the expert
    // reply - if any, the user already followed up; skip.
    const { data: userMsgRows } = await admin
      .from("journey_messages")
      .select("scheduled_item_id, created_at")
      .eq("author_kind", "user")
      .in("scheduled_item_id", itemIds)
      .gte("created_at", unfollowedCutoff);
    const followedItems = new Set<string>();
    for (const r of (userMsgRows ?? []) as Array<{
      scheduled_item_id: string;
      created_at: string;
    }>) {
      const replyAt = latestByItem.get(r.scheduled_item_id);
      if (replyAt && r.created_at > replyAt) {
        followedItems.add(r.scheduled_item_id);
      }
    }

    // Resolve owners + send.
    const pendingItems = itemIds.filter((id) => !followedItems.has(id));
    if (pendingItems.length > 0) {
      const { data: ownerRows } = await admin
        .from("journey_scheduled_items")
        .select(
          "id, journey_assignments!inner(user_id, source_kind, is_active)",
        )
        .in("id", pendingItems)
        .eq("journey_assignments.is_active", true);
      for (const r of (ownerRows ?? []) as Array<{
        id: string;
        journey_assignments:
          | { user_id: string | null }
          | Array<{ user_id: string | null }>
          | null;
      }>) {
        const a = r.journey_assignments;
        const list = Array.isArray(a) ? a : a ? [a] : [];
        const userId = list[0]?.user_id ?? null;
        if (!userId) continue;

        const elig = await isCadenceEligible(userId);
        if (!elig.eligible) continue;

        // 24h dedup at the (user, item) level.
        const { count } = await admin
          .from("journey_notifications")
          .select("id", { head: true, count: "exact" })
          .eq("recipient_kind", "user")
          .eq("recipient_user_id", userId)
          .eq("kind", "reminder_unfollowed_reply")
          .gte("created_at", unfollowedCutoff)
          .contains("payload", { scheduled_item_id: r.id });
        if ((count ?? 0) > 0) continue;

        if (dryRun) {
          summary.unfollowed_sent++;
          continue;
        }
        try {
          await notifyOnReminderUnfollowedReply({
            recipientUserId: userId,
            scheduledItemId: r.id,
            locale: "he",
          });
          summary.unfollowed_sent++;
        } catch (e) {
          summary.errors.push(
            `unfollowed:${userId}: ${e instanceof Error ? e.message : "?"}`,
          );
          summary.ok = false;
        }
      }
    }
  }

  // ── Sweep 3 - STUCK USERS DIGEST ─────────────────────────────────
  const stuck = await getStuckUsers(7, 100);
  summary.stuck_users = stuck.length;
  if (stuck.length > 0 && !dryRun) {
    try {
      const lines = stuck
        .slice(0, 50)
        .map(
          (u) =>
            `• ${u.full_name || u.email || u.user_id.slice(0, 8)} - ${u.days_since_delivery >= 999 ? "never" : `${u.days_since_delivery} days idle`}`,
        )
        .join("<br>");
      await notifyAdminPool({
        kind: "stuck_users_digest",
        subject: `Mioshy admin: ${stuck.length} stuck user(s) this week`,
        // Once-per-day collapse - admin only ever gets one digest in
        // any 24h window.
        throttleHours: 24,
        throttleKey: "stuck_users_digest",
        payload: {
          throttle_key: "stuck_users_digest",
          context_label: `${stuck.length} users have been idle ≥7 days with no pending push`,
          preview: lines,
          href: "/dashboard/journey/health",
          stuck_count: stuck.length,
        },
      });
    } catch (e) {
      summary.errors.push(
        `stuck_digest: ${e instanceof Error ? e.message : "?"}`,
      );
      summary.ok = false;
    }
  }

  if (!dryRun) {
    await runWithCronLog("reminders", async () => ({
      rowsProcessed:
        summary.inactivity_sent + summary.unfollowed_sent + summary.stuck_users,
      payload: {
        inactivity_sent: summary.inactivity_sent,
        unfollowed_sent: summary.unfollowed_sent,
        stuck_users: summary.stuck_users,
        errors_count: summary.errors.length,
        errors: summary.errors.slice(0, 5),
      },
      error: summary.ok ? undefined : `${summary.errors.length} sweep error(s)`,
    }));
  }

  return NextResponse.json(summary, {
    status: summary.ok ? 200 : 207,
  });
}
