// ============================================================
// Owner resolution helpers for the Journey Content System.
//
// An owner is a polymorphic entity: either a single user or a couple.
// These helpers resolve the current viewer's owner identity and serialize
// it for URLs / RPC parameters.
// ============================================================

import { cache } from "react";

import type { JourneyOwner, OwnerKey } from "./types";

/**
 * Serialize an owner to a stable string key - e.g. "user:8f3c..." or
 * "couple:a2d1...". Safe for URL paths and cache keys.
 */
export function toOwnerKey(owner: JourneyOwner): OwnerKey {
  return owner.kind === "couple"
    ? (`couple:${owner.coupleId}` as OwnerKey)
    : (`user:${owner.userId}` as OwnerKey);
}

/**
 * Parse an owner key back into a JourneyOwner. Returns null if the key is
 * malformed. Accepts the strict "kind:uuid" shape written by toOwnerKey.
 */
export function parseOwnerKey(raw: string): JourneyOwner | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx === -1) return null;
  const kind = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  if (!id) return null;
  if (kind === "user") return { kind: "user", userId: id };
  if (kind === "couple") return { kind: "couple", coupleId: id };
  return null;
}

/**
 * Compare two owners for identity.
 */
export function ownersEqual(a: JourneyOwner, b: JourneyOwner): boolean {
  if (a.kind === "user" && b.kind === "user") return a.userId === b.userId;
  if (a.kind === "couple" && b.kind === "couple") return a.coupleId === b.coupleId;
  return false;
}

/**
 * Returns the viewer's "preferred owner" given a user id and (optionally)
 * an active couple id. If the user has paired, the couple is the owner -
 * otherwise the user themselves is the owner. Matches the runtime rule
 * used by the assignment-lookup queries.
 *
 * v3 NOTE: this is the LEGACY (v2) resolver - keep using it for
 * program/category/item assignments which were always couple-scoped
 * when a couple existed. For v3 surfaces (cadence, expert push v2,
 * group cohorts) call journeyOwnerForUser() instead, which is strict
 * per-partner.
 */
export function preferCoupleOwner(
  userId: string,
  coupleId: string | null | undefined,
): JourneyOwner {
  return coupleId
    ? { kind: "couple", coupleId }
    : { kind: "user", userId };
}

/**
 * v3 per-partner resolver - now COUPLE-AWARE for shared content (journey
 * shared-content spec, step 1).
 *
 *   - owner / solo / no couple  -> the user themselves (UNCHANGED).
 *   - PARTNER (couple_members.role='partner') -> the SUBSCRIPTION OWNER of the
 *     same couple (the role='owner' member), so the partner READS the owner's
 *     cadence chapter queue. Cross-checked: the owner must have an ACTIVE
 *     cadence assignment (journey_assignments source_kind='cadence',
 *     is_active=true); if not, we fall back to the partner themselves so we
 *     never point them at an empty / missing queue.
 *
 * IMPORTANT: this changes READ resolution only. Cadence CREATION stays
 * strictly per-user - the cadence engine / trigger never call this helper.
 *
 * Async because it needs couple context. Wrapped in React.cache so the
 * per-request lookup is shared across the shell + page callers. The admin
 * client is imported lazily so this module's pure helpers stay client-safe,
 * and ANY lookup failure degrades to self - it never throws into a render.
 *
 * Couple-aggregate views (admin /my-clients/[coupleId], journey
 * /clients/[ownerKey]) JOIN over couple_members and call this helper
 * twice (once per partner) to compose the rollup.
 */
export const journeyOwnerForUser = cache(
  async (userId: string): Promise<JourneyOwner> => {
    const self: JourneyOwner = { kind: "user", userId };
    try {
      const { createServiceRoleClient } = await import("@/lib/supabase-admin");
      const admin = createServiceRoleClient();
      if (!admin) return self;

      // Only PARTNERS defer to someone else; owner / solo / no couple -> self.
      const { data: membership } = await admin
        .from("couple_members")
        .select("couple_id, role")
        .eq("user_id", userId)
        .maybeSingle();
      if (
        !membership ||
        membership.role !== "partner" ||
        !membership.couple_id
      ) {
        return self;
      }

      // The subscription owner of the same couple.
      const { data: ownerMember } = await admin
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", membership.couple_id as string)
        .eq("role", "owner")
        .maybeSingle();
      const ownerId = (ownerMember?.user_id as string | undefined) ?? null;
      if (!ownerId || ownerId === userId) return self;

      // Cross-check: the owner must have an ACTIVE cadence assignment, else
      // fall back to self so we never point the partner at an empty queue.
      const { data: ownerCadence } = await admin
        .from("journey_assignments")
        .select("id")
        .eq("user_id", ownerId)
        .eq("source_kind", "cadence")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!ownerCadence) return self;

      return { kind: "user", userId: ownerId };
    } catch {
      return self;
    }
  },
);

/**
 * Authorization primitive for the shared-content read/write paths
 * (journey shared-content spec, step 2).
 *
 * Returns true iff `viewerUserId` is a PARTNER (couple_members.role=
 * 'partner') in a couple whose role='owner' member is exactly
 * `ownerUserId`. In other words: the viewer is the subscription owner's
 * partner, so they are allowed to READ the owner's per-user cadence queue
 * and WRITE shared completions / responses on the owner's scheduled items.
 *
 * ALWAYS verified via the service-role client against couple_members -
 * never trust the client. Any failure (missing admin, no couple, role
 * mismatch, different couple) returns false so the caller keeps its strict
 * default (session-client read / "forbidden" write). Same membership shape
 * as journeyOwnerForUser so the two never drift.
 *
 * Wrapped in React.cache so the per-request authorization is shared across
 * Gate A (write actions) and Gate B (read queries) within one render.
 */
export const viewerIsPartnerOfOwner = cache(
  async (viewerUserId: string, ownerUserId: string): Promise<boolean> => {
    if (!viewerUserId || !ownerUserId || viewerUserId === ownerUserId) {
      return false;
    }
    try {
      const { createServiceRoleClient } = await import("@/lib/supabase-admin");
      const admin = createServiceRoleClient();
      if (!admin) return false;

      // The viewer must be a PARTNER in some couple.
      const { data: membership } = await admin
        .from("couple_members")
        .select("couple_id, role")
        .eq("user_id", viewerUserId)
        .maybeSingle();
      if (
        !membership ||
        membership.role !== "partner" ||
        !membership.couple_id
      ) {
        return false;
      }

      // ...and ownerUserId must be the role='owner' member of THAT couple.
      const { data: ownerMember } = await admin
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", membership.couple_id as string)
        .eq("role", "owner")
        .maybeSingle();
      return (ownerMember?.user_id as string | undefined) === ownerUserId;
    } catch {
      return false;
    }
  },
);

/**
 * Convenience for building the Supabase filter pair - returns a tuple that
 * can be spread into a query's equality filter. Callers use it like:
 *
 *     const { column, value } = ownerFilter(owner);
 *     q.eq(column, value);
 */
export function ownerFilter(owner: JourneyOwner): {
  column: "user_id" | "couple_id";
  value: string;
} {
  return owner.kind === "couple"
    ? { column: "couple_id", value: owner.coupleId }
    : { column: "user_id", value: owner.userId };
}
