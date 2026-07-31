"use server";

// ============================================================
// Explicit reactivation of a non-renewing subscription (Itzik 2026-07-31).
//
// The whole point of auto_renew=false is that renewal is the customer's own
// act. So this deliberately takes TWO steps: the banner offers it, a confirm
// screen states the price and that the first charge happens today, and only
// then does this run. "After this week, a little friction on a money path is
// worth more than smoothness."
//
// It does not charge inline. It flips auto_renew back on and makes the
// subscription due, so the hourly renewals cron performs the charge through
// the one audited path — same asmachta, same idempotency, same guards.
// ============================================================

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface ReactivationOffer {
  subscriptionId: string;
  /** The real amount from the DB — never hardcoded in copy. */
  amount: number;
  currency: string;
  plan: string;
  /** When access currently ends. */
  periodEnd: string | null;
}

/** What the banner and the confirm screen render. Null when not applicable. */
export async function getReactivationOffer(): Promise<ReactivationOffer | null> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data } = await admin
    .from("subscriptions")
    .select("id, plan, plan_amount, currency, current_period_end, auto_renew, status")
    .eq("user_id", auth.user.id)
    .eq("product", "journey")
    .eq("auto_renew", false)
    .in("status", ["active", "expired"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const row = data as {
    id: string;
    plan: string | null;
    plan_amount: number | string | null;
    currency: string | null;
    current_period_end: string | null;
  };

  return {
    subscriptionId: row.id,
    amount: Number(row.plan_amount ?? 0),
    currency: row.currency ?? "ILS",
    plan: row.plan ?? "monthly",
    periodEnd: row.current_period_end,
  };
}

export type ReactivateResult = { ok: true } | { ok: false; error: string };

/**
 * Confirmed by the customer on the confirm screen. Turns renewal back on and
 * marks the subscription due now; the renewals cron charges within the hour.
 */
export async function reactivateSubscription(): Promise<ReactivateResult> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "unavailable" };

  // Re-read under the same guards the offer used, so a stale tab cannot
  // reactivate something that is no longer eligible.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, payment_method_id")
    .eq("user_id", auth.user.id)
    .eq("product", "journey")
    .eq("auto_renew", false)
    .in("status", ["active", "expired"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return { ok: false, error: "no_reactivatable_subscription" };

  const row = sub as { id: string; payment_method_id: string | null };
  if (!row.payment_method_id) {
    // No saved card: reactivating would silently do nothing. Say so rather
    // than flipping a flag that produces no charge and no service.
    return { ok: false, error: "no_payment_method" };
  }

  const { error } = await admin
    .from("subscriptions")
    .update({
      auto_renew: true,
      status: "active",
      next_billing_date: new Date().toISOString(),
      failed_attempts: 0,
    })
    .eq("id", row.id);
  if (error) return { ok: false, error: error.message };

  console.log("[reactivate] customer reactivated their subscription", {
    sub_id: row.id,
    user_id8: auth.user.id.slice(0, 8),
  });

  revalidatePath("/[locale]/my/journey", "page");
  revalidatePath("/[locale]/my/lessons", "page");
  return { ok: true };
}
