// ============================================================
// Unified entitlements - the single source of truth that drives
// the three-pillar navigation surface (games / journey / adults).
//
// Callers: /my hub, gallery pages, header links, middleware-style
// guards. Keep this purely read-only and fast (≤ 3 queries).
//
// v3 slice 5 - added detailed `journeyState` so UI can distinguish
// active / grace / blocked. The legacy `journey: boolean` is kept
// as an adapter (true when state ∈ {active, grace}, false otherwise)
// so older call sites that just need a yes/no continue to work.
// ============================================================

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type PillarKey = "games" | "journey" | "adults";

/**
 * v3 slice 5 - three-state journey entitlement (plus null = "never
 * subscribed / past-due / frozen / fully cancelled").
 *
 *   'active'  - full access. Cadence engine materializes new items.
 *   'grace'   - 14-day natural-expiry window. Past content stays
 *               accessible (read-only completion + threads still
 *               work); cadence engine PAUSES new materialization;
 *               banner asks the user to renew.
 *   'blocked' - grace expired without renewal. Locked screen takes
 *               over /journey, /my/journey, /journey/timeline.
 *               Renewal restores everything from where the user was.
 *
 * `null` means there's no journey-product subscription row at all
 * (or the row is in a non-grace inactive state like past_due) - the
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
  /** v3 slice 5 - detailed journey state. Null = no journey sub at all. */
  journeyState: JourneyEntitlementState | null;
  /** v3 slice 5 - ISO timestamp when grace ends (i.e. when the
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

  // ── Couple membership - needed to look up `adults` entitlements AND
  //    to defer subscription-reads to the couple's owner when the caller
  //    is a partner (Itzik 2026-05-25, partner-sharing MVP).
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id, role")
    .eq("user_id", uid)
    .maybeSingle();

  const coupleId = (membership?.couple_id as string) ?? null;
  const memberRole =
    (membership?.role as "owner" | "partner" | null) ?? null;

  // ── Partner-aware entitlement source ───────────────────────────────────
  // Decision (Itzik 2026-05-25): pairing a partner via couple_invitations
  // /pair_code grants them the owner's subscription benefits — Games,
  // Journey, and Adults — for as long as that subscription is active.
  // The Adults pillar already worked through couple_entitlements (RLS in
  // migration 029:723-728 lets both couple members read), but Games and
  // Journey were gated on `subscriptions.user_id = caller.uid` and the
  // partner has no sub of their own.
  //
  // The fix: when the caller is a 'partner' in a couple, swap the
  // subscription-query subject to the OWNER's user_id. Adults logic
  // below is untouched (it reads couple_entitlements via coupleId, which
  // is identical for both members — no double-grant risk).
  //
  // Fail-closed: if the owner lookup yields nothing (orphan couple after
  // admin deletion), entitlementSourceUid stays at uid, the partner has
  // no sub of their own, and all flags evaluate to false.
  //
  // No recursion risk: migration 029:63-65 UNIQUE INDEX on
  // couple_members.user_id ensures every user is in at most one couple,
  // so an owner cannot also be someone else's partner. One hop, done.
  let entitlementSourceUid = uid;
  if (memberRole === "partner" && coupleId) {
    const { data: ownerMember } = await supabase
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", coupleId)
      .eq("role", "owner")
      .maybeSingle();
    if (ownerMember?.user_id) {
      entitlementSourceUid = ownerMember.user_id as string;
    }
  }

  // ── Subscriptions per pillar ───────────────────────────────────────────
  // We pull both 'active' and 'grace' rows: 'grace' is the v3 journey
  // soft-expiry window (status stays 'grace' even after journey_blocked_at
  // is stamped - the blocked-vs-grace distinction lives on the columns,
  // not on the status enum, per Itzik's slice 5 brief).
  //
  // RLS note: migration 012:90-93's `subscriptions_select_own` policy
  // restricts SELECT to `auth.uid() = user_id`. That means a partner
  // session client cannot read the owner's row. When we defer to an
  // owner (entitlementSourceUid !== uid), we MUST use the admin client
  // to bypass RLS — the security check is already enforced upstream:
  // we verified (a) the caller is a member of couple X with role
  // 'partner', and (b) the owner we resolved is the role='owner' of
  // the SAME couple X. No cross-couple leakage possible.
  const subsClient =
    entitlementSourceUid !== uid ? createAdminSupabaseClient() : supabase;
  const { data: subs } = await subsClient
    .from("subscriptions")
    .select(
      "product, status, current_period_end, journey_grace_until, journey_blocked_at",
    )
    .eq("user_id", entitlementSourceUid)
    .in("status", ["active", "grace"]);

  const now = Date.now();
  const activeBy = (product: PillarKey) =>
    (subs ?? []).some((s) => {
      if (s.product !== product) return false;
      if (s.status !== "active") return false;
      if (!s.current_period_end) return true;
      return new Date(s.current_period_end as string).getTime() > now;
    });

  // ── Adults entitlement (Itzik 2026-05-22) ──────────────────────────────
  //   Sources of access, OR'd together:
  //     1. An active "adults" pillar subscription (vestigial — adults is
  //        currently one-time only, but we keep the check for future).
  //     2. An active Journey subscription — Journey bundles full access
  //        to every adults game (no per-game purchase needed). This is
  //        a hard rule from the 2026-05-22 pricing overhaul; previously
  //        Journey gave only "one adults game per calendar month" via
  //        adults_monthly_used_at, which is now deprecated.
  //     3. At least one per-game couple_entitlement (one-time purchases
  //        the couple made directly). These survive sub cancellations.
  //
  //   Games subscription deliberately does NOT grant adults — that pillar
  //   is a separate purchase track.
  let adults = activeBy("adults");
  // Journey subscribers get full adults access (replaces the monthly slot).
  // We resolve journey *after* this block, so re-derive a quick boolean
  // here from the same subs list to avoid order-of-eval dependencies.
  const journeyActive = (subs ?? []).some((s) => {
    if (s.product !== "journey") return false;
    if (s.status !== "active") return false;
    if (!s.current_period_end) return true;
    return new Date(s.current_period_end as string).getTime() > now;
  });
  if (!adults && journeyActive) {
    adults = true;
  }
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
      if (end <= now) continue; // past period_end without grace flip yet - treat as inactive
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

  // Coaching subscription ("journey") implicitly grants games access - per
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
