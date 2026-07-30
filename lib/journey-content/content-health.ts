// ============================================================
// lib/journey-content/content-health.ts
//
// "A paying subscriber received nothing" must not wait for Itzik to notice.
//
// This exists because it already happened, silently, to 100% of paying journey
// subscribers: both bought, both had a cadence assignment created 0.3s later,
// and both received ZERO items — for 15 and 31 days respectively — because no
// journey_user_priorities row was ever written and every delivery path rejects
// a user without one. Nothing logged, nothing alerted.
//
// The check is deliberately outcome-based rather than cause-based: it does not
// care WHY a subscriber has no content (missing ranking, empty library, a
// broken cron, a future bug none of us predicted). It asks the only question
// that matters — "is someone paying us and receiving nothing?"
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { notifyAdminPool } from "./notifications";

/** How long after purchase an empty account stops being normal. */
export const NO_CONTENT_ALERT_DAYS = 7;

export interface StarvedSubscriber {
  userId: string;
  email: string | null;
  subscriptionStatus: string;
  purchasedAt: string;
  daysSincePurchase: number;
  hasPriorities: boolean;
  deliveredCount: number;
}

export interface ContentHealthResult {
  checked: number;
  starved: StarvedSubscriber[];
  error?: string;
}

/**
 * Find paying journey subscribers who have received no content at all more
 * than `days` after purchase.
 *
 * Deliberately excluded, because emptiness is CORRECT for them:
 *   - grace / blocked / cancelled — not currently entitled
 *   - paused (subscription_pauses or profiles.journey_paused_at) — their
 *     content is waiting for them on purpose
 *   - test users
 */
export async function findStarvedSubscribers(
  days: number = NO_CONTENT_ALERT_DAYS,
): Promise<ContentHealthResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { checked: 0, starved: [], error: "no_admin_client" };

  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("user_id, email, status, created_at")
    .eq("product", "journey")
    .in("status", ["active", "trialing"])
    .lte("created_at", cutoff);
  if (error) return { checked: 0, starved: [], error: error.message };

  const rows = (subs ?? []) as Array<{
    user_id: string;
    email: string | null;
    status: string;
    created_at: string;
  }>;
  if (!rows.length) return { checked: 0, starved: [] };

  const userIds = rows.map((r) => r.user_id);

  // Test users never alert.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, is_test_user, journey_paused_at")
    .in("id", userIds);
  const profileById = new Map(
    ((profiles ?? []) as Array<{ id: string; is_test_user: boolean | null; journey_paused_at: string | null }>)
      .map((p) => [p.id, p]),
  );

  // A user-initiated pause means the emptiness is intentional.
  const { data: pauses } = await admin
    .from("subscription_pauses")
    .select("user_id, paused_until")
    .in("user_id", userIds)
    .is("resumed_at", null)
    .gt("paused_until", new Date().toISOString());
  const pausedIds = new Set(
    ((pauses ?? []) as Array<{ user_id: string }>).map((p) => p.user_id),
  );

  const { data: delivered } = await admin
    .from("journey_user_delivered_items")
    .select("user_id")
    .in("user_id", userIds);
  const deliveredCount = new Map<string, number>();
  for (const d of (delivered ?? []) as Array<{ user_id: string }>) {
    deliveredCount.set(d.user_id, (deliveredCount.get(d.user_id) ?? 0) + 1);
  }

  const { data: priorities } = await admin
    .from("journey_user_priorities")
    .select("user_id")
    .in("user_id", userIds);
  const hasPriorities = new Set(
    ((priorities ?? []) as Array<{ user_id: string }>).map((p) => p.user_id),
  );

  const starved: StarvedSubscriber[] = [];
  let checked = 0;
  for (const s of rows) {
    const profile = profileById.get(s.user_id);
    if (profile?.is_test_user) continue;
    if (profile?.journey_paused_at) continue;
    if (pausedIds.has(s.user_id)) continue;
    checked++;

    const count = deliveredCount.get(s.user_id) ?? 0;
    if (count > 0) continue;

    starved.push({
      userId: s.user_id,
      email: s.email,
      subscriptionStatus: s.status,
      purchasedAt: s.created_at,
      daysSincePurchase: Math.floor(
        (Date.now() - new Date(s.created_at).getTime()) / 86_400_000,
      ),
      hasPriorities: hasPriorities.has(s.user_id),
      deliveredCount: count,
    });
  }

  return { checked, starved };
}

/**
 * Run the check and raise the flag. Logs loudly either way so the condition is
 * visible in the Vercel logs even if email delivery is broken, and alerts the
 * admin pool once per user per throttle window.
 */
export async function reportStarvedSubscribers(
  days: number = NO_CONTENT_ALERT_DAYS,
): Promise<ContentHealthResult> {
  const result = await findStarvedSubscribers(days);

  if (result.error) {
    console.error("[content-health] check failed", { error: result.error });
    return result;
  }

  if (!result.starved.length) {
    console.log("[content-health] OK", { checked: result.checked, starved: 0 });
    return result;
  }

  console.error("[content-health] PAYING SUBSCRIBERS WITH NO CONTENT", {
    checked: result.checked,
    starved: result.starved.length,
    users: result.starved.map((s) => ({
      user_id8: s.userId.slice(0, 8),
      email: s.email,
      days: s.daysSincePurchase,
      has_priorities: s.hasPriorities,
    })),
  });

  for (const s of result.starved) {
    await notifyAdminPool({
      kind: "subscriber_without_content",
      subject: "Mioshy: paying subscriber has received no content",
      payload: {
        throttle_key: s.userId,
        preview: `${s.email ?? s.userId} bought ${s.daysSincePurchase} days ago and has received 0 items (priorities row: ${s.hasPriorities ? "yes" : "MISSING"}).`,
        user_id: s.userId,
        email: s.email,
        days_since_purchase: s.daysSincePurchase,
        subscription_status: s.subscriptionStatus,
        has_priorities: s.hasPriorities,
      },
      throttleKey: s.userId,
    }).catch((e) => console.error("[content-health] alert failed", e));
  }

  return result;
}
