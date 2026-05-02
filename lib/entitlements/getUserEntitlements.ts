// ============================================================
// Unified entitlements - the single source of truth that drives
// the three-pillar navigation surface (games / journey / adults).
//
// Callers: /my hub, gallery pages, header links, middleware-style
// guards. Keep this purely read-only and fast (≤ 3 queries).
//
// v3 slice 5 — added detailed `journeyState` so UI can distinguish
// active / grace / blocked. The legacy `journey: boolean` is kept
// as an adapter (true when state ∈ {active, grace}, false otherwise)
// so older call sites that just need a yes/no continue to work.
// ============================================================

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PillarKey = "games" | "journey" | "adults";

/**
 * v3 slice 5 — three-state journey entitlement (plus null = "never
 * subscribed / past-due / frozen / fully cancelled").
 *
 *   'active'  — full access. Cadence engine materializes new items.
 *   'grace'   — 14-day natural-expiry window. Past content stays
 *               accessible (read-only completion + threads still
 *               work); cadence engine PAUSES new materialization;
 *               banner asks the user to renew.
 *   'blocked' — grace expired without renewal. Locked screen takes
 *               over /journey, /my/journey, /journey/timeline.
 *               Renewal restores everything from where the user was.
 *
 * `null` means there's no journey-product subscription row at all
 * (or the row is in a non-grace inactive state like past_due) — the
 * legacy "המסע נעול - בינתיים" locked screen renders for those users
 * via the existing `if (!entitlements.journey)` gate.
 */
export type JourneyEntitlementState = "active" | "grace" | "blocked";

export interface UserEntitlements {
  userId: string;
  email: string | null;
  coupleId: string | null;
  // Per-pillar flags (legacy adapters; see journeyState for the
  // detailed state machine).
  games: boolean;
  journey: boolean;
  adults: boolean;
  /** v3 slice 5 — detailed journey state. Null = no journey sub at all. */
  journeyState: JourneyEntitlementState | null;
  /** v3 slice 5 — ISO timestamp when grace ends (i.e. when the
   *  grace-watcher cron will stamp journey_blocked_at). The banner
   *  uses this to show "X days remaining". Null when not in grace
   *  AND not blocked. */
  journeyGraceUntil: string | null;
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

  // ── Subscriptions per pillar ───────────────────────────────────────────
  // We pull both 'active' and 'grace' rows: 'grace' is the v3 journey
  // soft-expiry window (status stays 'grace' even after journey_blocked_at
  // is stamped — the blocked-vs-grace distinction lives on the columns,
  // not on the status enum, per Itzik's slice 5 brief).
  const { data: subs } = await supabase
    .from("subscriptions")
    .select(
      "product, status, current_period_end, journey_grace_until, journey_blocked_at",
    )
    .eq("user_id", uid)
    .in("status", ["active", "grace"]);

  const now = Date.now();
  const activeBy = (product: PillarKey) =>
    (subs ?? []).some((s) => {
      if (s.product !== product) return false;
      if (s.status !== "active") return false;
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

  // ── Journey state machine (v3 slice 5) ─────────────────────────────────
  // Resolution order: active first, then grace (with blocked-vs-grace
  // determined by journey_blocked_at presence). Falls through to null
  // when there's no qualifying row.
  let journeyState: JourneyEntitlementState | null = null;
  let journeyGraceUntil: string | null = null;
  const journeySubs = (subs ?? []).filter((s) => s.product === "journey");
  for (const s of journeySubs) {
    if (s.status !== "active") continue;
    if (s.current_period_end) {
      const end = new Date(s.current_period_end as string).getTime();
      if (end <= now) continue; // past period_end without grace flip yet — treat as inactive
    }
    journeyState = "active";
    break;
  }
  if (journeyState === null) {
    for (const s of journeySubs) {
      if (s.status !== "grace") continue;
      if (s.journey_blocked_at) {
        journeyState = "blocked";
        journeyGraceUntil = (s.journey_grace_until as string | null) ?? null;
      } else {
        journeyState = "grace";
        journeyGraceUntil = (s.journey_grace_until as string | null) ?? null;
      }
      break;
    }
  }

  // Coaching subscription ("journey") implicitly grants games access — per
  // the product spec, paying for the higher-tier coaching includes the
  // lower-tier games library at no extra cost. During the 14-day grace
  // window we keep that bonus active too (read-only experience matches
  // the journey grace model). Blocked or null cuts it off.
  const journey = journeyState === "active" || journeyState === "grace";
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
    journeyState,
    journeyGraceUntil,
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
