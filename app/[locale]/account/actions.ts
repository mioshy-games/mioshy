"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Ensure the caller actually owns the subscription they're trying to modify.
 * Returns { userId, subRow } on success, or throws.
 */
async function requireOwnership(subscriptionId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error("Unauthorized");

  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select("id, user_id, status, payment_method_id")
    .eq("id", subscriptionId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !sub) throw new Error("Subscription not found");
  return { supabase, userId: auth.user.id, sub };
}

/**
 * Cancel subscription: sets status=cancelled AND revokes the stored Cardcom token
 * so no further automatic charges can happen. User can resubscribe later.
 */
export async function cancelSubscription(subscriptionId: string) {
  const { supabase, sub } = await requireOwnership(subscriptionId);

  await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      next_billing_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  // Revoke the saved payment token so we don't keep charging by accident
  if (sub.payment_method_id) {
    await supabase
      .from("customer_payment_methods")
      .update({ status: "revoked" })
      .eq("id", sub.payment_method_id);
  }

  revalidatePath("/account", "page");
  revalidatePath("/he/account", "page");
  revalidatePath("/en/account", "page");
}

/**
 * Freeze subscription: pauses automatic billing but keeps the stored token.
 * User can resume anytime. Access is revoked at the end of the current period.
 */
export async function freezeSubscription(subscriptionId: string) {
  const { supabase, sub } = await requireOwnership(subscriptionId);

  if (sub.status !== "active") {
    throw new Error("Only active subscriptions can be frozen");
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "frozen",
      next_billing_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  revalidatePath("/account", "page");
  revalidatePath("/he/account", "page");
  revalidatePath("/en/account", "page");
}

/**
 * Resume a frozen subscription: restores status to active.
 * Renewal cron will pick it up on the next cycle using the stored token.
 */
export async function resumeSubscription(subscriptionId: string) {
  const { supabase, sub } = await requireOwnership(subscriptionId);

  if (sub.status !== "frozen") {
    throw new Error("Only frozen subscriptions can be resumed");
  }

  await supabase
    .from("subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  revalidatePath("/account", "page");
  revalidatePath("/he/account", "page");
  revalidatePath("/en/account", "page");
}
