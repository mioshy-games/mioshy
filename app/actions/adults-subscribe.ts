"use server";

/**
 * Adults pillar - subscription stub actions.
 *
 * These are Phase-1 stubs: they create (or reactivate) the row in
 * `public.subscriptions` with product='adults' and the selected `plan_tier`,
 * and pair the caller into a couple so every feature gated on couple
 * membership works end-to-end. Cardcom wiring lives in Phase 2 - the real
 * checkout call will replace the stub insert but keep the same contract.
 *
 * The two tiers:
 *   - `monthly` - content drip + catalogue access.
 *   - `annual`  - same as monthly + a 30-day rotating Games-pillar slot (the
 *                 `couple_active_slots` table will land in Phase 3; until then
 *                 we just record the plan so the UI can show the right state).
 */

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getBetweenUsSettings } from "@/lib/between-us/queries";
import type { AdultsPlanTier } from "@/lib/between-us/types";

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

/**
 * Subscribe the current user to the Adults pillar on the given tier.
 *
 * Phase 1: stub only - no payment integration. Safeguarded with:
 *   - complete-profile gate (same rule as couple pairing / purchase)
 *   - admin setting flag must be ON for the requested tier
 *   - idempotent: if the user already has an active adults sub, we update
 *     the `plan_tier` in place instead of stacking rows.
 */
export async function subscribeAdultsTier(
  tier: AdultsPlanTier,
): Promise<Ok<{ subscription_id: string; plan_tier: "monthly" | "annual" }> | Err> {
  if (tier !== "monthly" && tier !== "annual") {
    return { ok: false, error: "invalid_tier" };
  }

  // Per Itzik 2026-05-07: subscribing to Mioshy's Sex (the recurring
  // tier) does NOT require a full profile — only auth. Pairing a
  // partner is optional and is gated separately on the redeem-code
  // path. Auth alone is enough to start the Cardcom flow.
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "login_required" };

  // Guard against subscribing to a tier the admin has disabled.
  const settings = await getBetweenUsSettings().catch(() => null);
  if (!settings) return { ok: false, error: "settings_unavailable" };
  if (tier === "monthly" && !settings.monthly_enabled) {
    return { ok: false, error: "monthly_tier_disabled" };
  }
  if (tier === "annual" && !settings.annual_enabled) {
    return { ok: false, error: "annual_tier_disabled" };
  }

  // Ensure couple exists - every adults membership is couple-scoped.
  const { error: coupleErr } = await supabase.rpc(
    "create_couple_for_current_user",
    { p_display_name: null },
  );
  if (coupleErr) {
    return { ok: false, error: coupleErr.message };
  }

  const admin = createAdminSupabaseClient();

  // Look up any existing active adults sub for this user.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, plan_tier")
    .eq("user_id", user.id)
    .eq("product", "adults")
    .eq("status", "active")
    .maybeSingle();

  if (existing?.id) {
    if (existing.plan_tier === tier) {
      return {
        ok: true,
        subscription_id: existing.id as string,
        plan_tier: tier,
      };
    }
    // Tier change (upgrade/downgrade): update plan_tier in place.
    const { error: upErr } = await admin
      .from("subscriptions")
      .update({ plan_tier: tier })
      .eq("id", existing.id);
    if (upErr) return { ok: false, error: upErr.message };
    revalidatePath("/[locale]/adults", "page");
    revalidatePath("/[locale]/my", "page");
    return {
      ok: true,
      subscription_id: existing.id as string,
      plan_tier: tier,
    };
  }

  // Create a new active subscription row.
  const { data: inserted, error: insErr } = await admin
    .from("subscriptions")
    .insert({
      user_id: user.id,
      email: user.email ?? null,
      status: "active",
      plan: tier === "annual" ? "adults_annual" : "adults_monthly",
      product: "adults",
      plan_tier: tier,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return {
      ok: false,
      error: insErr?.message ?? "Could not create subscription",
    };
  }

  revalidatePath("/[locale]/adults", "page");
  revalidatePath("/[locale]/my", "page");

  return {
    ok: true,
    subscription_id: inserted.id as string,
    plan_tier: tier,
  };
}
