// ============================================================
// Owner resolution helpers for the Journey Content System.
//
// An owner is a polymorphic entity: either a single user or a couple.
// These helpers resolve the current viewer's owner identity and serialize
// it for URLs / RPC parameters.
// ============================================================

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
