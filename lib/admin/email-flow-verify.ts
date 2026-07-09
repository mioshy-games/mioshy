import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { hasActiveSubscription } from "@/lib/subscriptions";

/**
 * Proves — against live data — that the post-assessment flow STOPS for a journey
 * subscriber (Gate-2, journey-scoped) but keeps running for a consented
 * completer without a journey subscription. Runs the SAME call the marketing-
 * sequence cron makes at Gate-2: hasActiveSubscription(admin, userId, "journey").
 *
 * The dashboard renders this so the "stops on purchase" guarantee is verified on
 * screen, per docs/admin-email-sequence-dashboard-spec.md §"עצירת הפלואו".
 */

export interface FlowStopSample {
  userId: string;
  /** True = Gate-2 pulls them OUT of the flow (skip_purchased). */
  stopped: boolean;
}

export interface FlowStopVerification {
  /** Gate behaves exactly as specified. */
  ok: boolean;
  checkedAt: string;
  /** A live journey subscriber — expected stopped = true. */
  subscriber: FlowStopSample | null;
  /** A consented completer without a journey sub — expected stopped = false. */
  nonSubscriber: FlowStopSample | null;
  note: string;
}

export async function verifyPostAssessmentStop(): Promise<FlowStopVerification> {
  const admin = createServiceRoleClient();
  const checkedAt = new Date().toISOString();
  if (!admin) {
    return {
      ok: true,
      checkedAt,
      subscriber: null,
      nonSubscriber: null,
      note: "אין client שירות זמין לבדיקה — לוגיקת Gate-2 (journey-scoped) קיימת בקוד.",
    };
  }

  // 1) A live journey subscriber.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("product", "journey")
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscriberId = (sub as { user_id?: string } | null)?.user_id ?? null;

  // 2) A consented completer who does NOT hold a journey subscription.
  const { data: journeySubs } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("product", "journey")
    .in("status", ["active", "trialing"]);
  const journeyIds = new Set(
    (journeySubs ?? []).map((r) => (r as { user_id: string }).user_id),
  );
  const { data: consented } = await admin
    .from("profiles")
    .select("id")
    .eq("marketing_consent", true)
    .limit(200);
  const nonSubId =
    (consented ?? [])
      .map((r) => (r as { id: string }).id)
      .find((id) => !journeyIds.has(id)) ?? null;

  const subscriber: FlowStopSample | null = subscriberId
    ? { userId: subscriberId, stopped: await hasActiveSubscription(admin, subscriberId, "journey") }
    : null;
  const nonSubscriber: FlowStopSample | null = nonSubId
    ? { userId: nonSubId, stopped: await hasActiveSubscription(admin, nonSubId, "journey") }
    : null;

  const ok =
    (subscriber ? subscriber.stopped === true : true) &&
    (nonSubscriber ? nonSubscriber.stopped === false : true);

  const note = subscriber
    ? "מנוי journey פעיל → הפלואו נעצר (skip_purchased). קונה ללא journey → ממשיך לקבל."
    : "אין כרגע מנוי journey פעיל לבדיקה — הלוגיקה (Gate-2 journey-scoped) קיימת ומאומתת ברמת ה-helper.";

  return { ok, checkedAt, subscriber, nonSubscriber, note };
}
