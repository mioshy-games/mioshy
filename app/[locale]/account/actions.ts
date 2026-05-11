"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Subscription mutation actions (cancel / freeze / resume).
 * ──────────────────────────────────────────────────────────
 * Per the project memory `project_supabase_ssr_rls_pattern.md`:
 *   • Resolve auth via the SSR session client (so we know who's calling)
 *   • Mutate via the admin client (so RLS doesn't silently drop the
 *     UPDATE — the JWT-to-PostgREST handshake is flaky under
 *     @supabase/ssr and was producing silent no-ops)
 *
 * Each action returns a structured result so the client knows whether
 * the cancel actually happened. Previously these actions returned void,
 * so a flaky UPDATE produced no error AND no UI feedback (the user
 * clicked "Cancel" and nothing visible happened — Itzik 2026-05-07).
 */

type MutationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Verify the caller owns the subscription. Auth resolution uses the SSR
 * session client. Returns the row + the admin client for downstream
 * mutations.
 */
async function requireOwnership(subscriptionId: string) {
  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) {
    return { ok: false as const, error: "unauthorized" };
  }

  // Read the subscription via the SSR client first to enforce that the
  // calling user actually owns it. This is RLS-safe (read paths are
  // less flaky than writes under @supabase/ssr).
  const { data: sub, error } = await sessionClient
    .from("subscriptions")
    .select("id, user_id, status, payment_method_id")
    .eq("id", subscriptionId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error || !sub) {
    return { ok: false as const, error: "subscription_not_found" };
  }

  // For the WRITE we use the admin client — bypasses RLS so the UPDATE
  // can't silently no-op. The ownership check above already confirmed
  // the caller is allowed to mutate this row.
  const adminClient = await createAdminClient();

  return { ok: true as const, userId: auth.user.id, sub, adminClient };
}

/**
 * Cancel subscription: sets status=cancelled AND revokes the stored
 * Cardcom token so no further automatic charges can happen. User can
 * resubscribe later (creates a new subscription row).
 */
export async function cancelSubscription(
  subscriptionId: string,
): Promise<MutationResult> {
  const own = await requireOwnership(subscriptionId);
  if (!own.ok) return { ok: false, error: own.error };

  const { adminClient, sub } = own;

  // 1) Flip the subscription to 'cancelled'. Surface UPDATE errors so
  // the UI knows the cancel actually committed.
  const { error: updErr } = await adminClient
    .from("subscriptions")
    .update({
      status: "cancelled",
      next_billing_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (updErr) {
    console.error("[cancelSubscription] UPDATE failed", updErr);
    return { ok: false, error: "update_failed" };
  }

  // 2) Revoke the saved Cardcom token so the renewal cron can't pick
  // it back up. Logged-but-non-fatal: if the token was already revoked
  // or never created, the subscription is still cancelled.
  if (sub.payment_method_id) {
    const { error: pmErr } = await adminClient
      .from("customer_payment_methods")
      .update({ status: "revoked" })
      .eq("id", sub.payment_method_id);
    if (pmErr) {
      console.warn(
        "[cancelSubscription] payment-method revoke failed (non-fatal)",
        pmErr,
      );
    }
  }

  // Refresh the account page so the user immediately sees the
  // cancelled state. Localized variants of the path each need their
  // own revalidate call — Next 14 doesn't yet expand `[locale]`.
  revalidatePath("/account", "page");
  revalidatePath("/he/account", "page");
  revalidatePath("/en/account", "page");

  return { ok: true };
}

/**
 * Freeze subscription: pauses automatic billing but keeps the stored
 * token so the user can resume anytime.
 */
export async function freezeSubscription(
  subscriptionId: string,
): Promise<MutationResult> {
  const own = await requireOwnership(subscriptionId);
  if (!own.ok) return { ok: false, error: own.error };

  const { adminClient, sub } = own;

  if (sub.status !== "active") {
    return { ok: false, error: "only_active_can_be_frozen" };
  }

  const { error } = await adminClient
    .from("subscriptions")
    .update({
      status: "frozen",
      next_billing_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (error) {
    console.error("[freezeSubscription] UPDATE failed", error);
    return { ok: false, error: "update_failed" };
  }

  revalidatePath("/account", "page");
  revalidatePath("/he/account", "page");
  revalidatePath("/en/account", "page");
  return { ok: true };
}

/**
 * Resume a frozen subscription. Renewal cron will pick it up on the
 * next cycle using the stored token.
 */
export async function resumeSubscription(
  subscriptionId: string,
): Promise<MutationResult> {
  const own = await requireOwnership(subscriptionId);
  if (!own.ok) return { ok: false, error: own.error };

  const { adminClient, sub } = own;

  if (sub.status !== "frozen") {
    return { ok: false, error: "only_frozen_can_resume" };
  }

  const { error } = await adminClient
    .from("subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (error) {
    console.error("[resumeSubscription] UPDATE failed", error);
    return { ok: false, error: "update_failed" };
  }

  revalidatePath("/account", "page");
  revalidatePath("/he/account", "page");
  revalidatePath("/en/account", "page");
  return { ok: true };
}
