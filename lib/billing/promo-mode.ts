/**
 * lib/billing/promo-mode.ts  (Task 20 — dual urgency mechanism)
 *
 * Resolves the admin-selected urgency mode and the per-user 48h personal offer
 * window, and decides whether the intro/promo discount is eligible right now.
 *
 * MONEY: `promoDiscountEligible` is the single gate applied in BOTH checkout
 * routes (server-enforced) AND the display surfaces (so display == charge).
 *
 *   off             → never discounted.
 *   campaign_timer  → today's behaviour: eligibility deferred to findActivePromo's
 *                     global window (this gate returns true).
 *   personal_window → eligible only while now < the user's journeys.offer_expires_at.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type PromoMode = "off" | "personal_window" | "campaign_timer";

const VALID: readonly PromoMode[] = ["off", "personal_window", "campaign_timer"];

/** Read site_settings.promo_mode. Defaults to 'personal_window' on any miss. */
export async function getPromoMode(client: SupabaseClient): Promise<PromoMode> {
  try {
    const { data } = await client
      .from("site_settings")
      .select("promo_mode")
      .eq("id", 1)
      .maybeSingle();
    const raw = (data as { promo_mode?: string } | null)?.promo_mode;
    if (raw && VALID.includes(raw as PromoMode)) return raw as PromoMode;
  } catch {
    /* fall through to default */
  }
  return "personal_window";
}

export type PersonalWindowDisplay = "text" | "clock";

/** Admin-configured personal-window length (hours) + display (site_settings,
 *  migration 184). Defensive: defaults to 48h / 'text' on any miss, so callers
 *  keep working even before the migration is applied. */
export async function getPersonalWindowConfig(
  client: SupabaseClient,
): Promise<{ hours: number; display: PersonalWindowDisplay }> {
  try {
    const { data } = await client
      .from("site_settings")
      .select("personal_window_hours, personal_window_display")
      .eq("id", 1)
      .maybeSingle();
    const row = data as
      | { personal_window_hours?: number | null; personal_window_display?: string | null }
      | null;
    const rawHours = Number(row?.personal_window_hours);
    const hours = Number.isFinite(rawHours) && rawHours >= 1 && rawHours <= 720 ? Math.round(rawHours) : 48;
    const display: PersonalWindowDisplay =
      row?.personal_window_display === "clock" ? "clock" : "text";
    return { hours, display };
  } catch {
    return { hours: 48, display: "text" };
  }
}

/**
 * The user's current personal-offer deadline (latest journey by user_id).
 * Null when the user has no journey / no stamped window.
 */
export async function getUserOfferExpiresAt(
  client: SupabaseClient,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await client
      .from("journeys")
      .select("offer_expires_at")
      .eq("user_id", userId)
      .not("offer_expires_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as { offer_expires_at?: string } | null)?.offer_expires_at ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the intro/promo discount may apply right now, given the mode and the
 * user's personal window. In campaign_timer this returns true and the actual
 * promo window is enforced downstream by findActivePromo; in personal_window it
 * requires an unexpired offer; off is always false.
 */
export function promoDiscountEligible(
  mode: PromoMode,
  offerExpiresAt: string | null,
  now: Date = new Date(),
): boolean {
  if (mode === "off") return false;
  if (mode === "campaign_timer") return true;
  // personal_window
  if (!offerExpiresAt) return false;
  return now.getTime() < new Date(offerExpiresAt).getTime();
}
