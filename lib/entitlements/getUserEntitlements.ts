// ============================================================
// Unified entitlements - the single source of truth that drives
// the three-pillar navigation surface (games / journey / adults).
//
// Callers: /my hub, gallery pages, header links, middleware-style
// guards. Keep this purely read-only and fast (≤ 3 queries).
// ============================================================

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PillarKey = "games" | "journey" | "adults";

export interface UserEntitlements {
  userId: string;
  email: string | null;
  coupleId: string | null;
  // Per-pillar flags
  games: boolean;
  journey: boolean;
  adults: boolean;
  // Handy when components need to show "you have X pillars" messaging
  anyPillar: boolean;
  pillarCount: 0 | 1 | 2 | 3;
}

/**
 * Build the full entitlement snapshot for the given user id.
 * `null` means "not signed in" - the caller decides what to do.
 */
export async function getUserEntitlements(
  userId?: string,
): Promise<UserEntitlements | null> {
  const supabase = await createServerSupabaseClient();

  // Resolve userId from the session when none is passed
  let uid = userId;
  let email: string | null = null;
  if (!uid) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    uid = user.id;
    email = user.email ?? null;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  // ── Couple membership - needed to look up `adults` entitlements ────────
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", uid)
    .maybeSingle();

  const coupleId = (membership?.couple_id as string) ?? null;

  // ── Active subscriptions per pillar ────────────────────────────────────
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("product, status, current_period_end")
    .eq("user_id", uid)
    .eq("status", "active");

  const now = Date.now();
  const activeBy = (product: PillarKey) =>
    (subs ?? []).some((s) => {
      if (s.product !== product) return false;
      if (!s.current_period_end) return true;
      return new Date(s.current_period_end as string).getTime() > now;
    });

  // ── Adults entitlement: EITHER an active "adults" sub OR at least one
  //    per-game couple_entitlement. ──────────────────────────────────────
  let adults = activeBy("adults");
  if (!adults && coupleId) {
    const { data: ents } = await supabase
      .from("couple_entitlements")
      .select("id", { head: false, count: "exact" })
      .eq("couple_id", coupleId)
      .limit(1);
    adults = (ents ?? []).length > 0;
  }

  // Coaching subscription ("journey") implicitly grants games access — per
  // the product spec, paying for the higher-tier coaching includes the
  // lower-tier games library at no extra cost. Dropping coaching also drops
  // games unless the user separately bought a games sub (the cancel-modal
  // on /account billing surfaces this explicitly).
  const journey = activeBy("journey");
  const games = activeBy("games") || journey;

  const pillarCount = (Number(games) + Number(journey) + Number(adults)) as
    | 0
    | 1
    | 2
    | 3;

  return {
    userId: uid,
    email,
    coupleId,
    games,
    journey,
    adults,
    anyPillar: pillarCount > 0,
    pillarCount,
  };
}

/** Shortcut: returns `true` if the user is entitled to the given pillar. */
export async function hasPillar(pillar: PillarKey): Promise<boolean> {
  const e = await getUserEntitlements();
  if (!e) return false;
  return e[pillar];
}
