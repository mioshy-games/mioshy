// ============================================================
// Schedule helpers for the Journey Content System.
//
// Two responsibilities:
//   1. Resolve an anchor date from the (anchor_kind, anchor_date?) pair
//      an admin chose when creating an assignment.
//   2. Compute absolute unlock_at timestamps for scheduled rows by adding
//      an item's default_offset_days to the assignment's anchor_date.
//
// Dates are stored as ISO strings (timestamptz). These helpers keep the
// arithmetic in one place so the admin UI, the materializer, and the
// propagation flow all stay consistent.
// ============================================================

import type { AnchorKind } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ResolveAnchorInput {
  /** How the admin wants the anchor computed. */
  anchorKind: AnchorKind;
  /**
   * Explicit date the admin picked, used when anchor_kind === 'fixed'. May
   * also be passed when kind === 'assignment' to override "now" (useful
   * when assigning on behalf of an owner who started earlier).
   */
  fixedAt?: string | Date | null;
  /**
   * For kind === 'purchase'. When the admin is assigning as a side-effect
   * of a purchase the caller passes the purchase timestamp here.
   */
  purchaseAt?: string | Date | null;
  /** The current time. Pass explicitly so this helper stays deterministic. */
  now?: Date;
}

/**
 * Resolve a concrete anchor timestamp (ISO) from the admin's anchor kind.
 *
 *   assignment → fixedAt || now
 *   purchase   → purchaseAt || fixedAt || now
 *   fixed      → fixedAt (required)
 *
 * Throws if kind === 'fixed' is chosen without a fixedAt - that is a
 * programmer error the UI should have prevented.
 */
export function resolveAnchorDate(input: ResolveAnchorInput): string {
  const now = input.now ?? new Date();
  const fixed = toDate(input.fixedAt);
  const purchase = toDate(input.purchaseAt);

  let resolved: Date;
  switch (input.anchorKind) {
    case "fixed":
      if (!fixed) {
        throw new Error(
          "resolveAnchorDate: anchor_kind='fixed' requires a fixedAt value",
        );
      }
      resolved = fixed;
      break;
    case "purchase":
      resolved = purchase ?? fixed ?? now;
      break;
    case "assignment":
    default:
      resolved = fixed ?? now;
      break;
  }

  // Normalize to start-of-day in UTC so per-day offsets behave predictably
  // across DST. Content unlocks on a day boundary, not an hour boundary.
  return startOfUtcDay(resolved).toISOString();
}

/**
 * Compute the absolute unlock timestamp for one item within an assignment.
 *
 * unlock_at = anchor_date + default_offset_days (in UTC days)
 *
 * Callers that want to model a per-item override (admin has dragged the
 * unlock earlier/later) should persist that override directly and skip
 * this helper - the unlock_at column is the source of truth.
 */
export function computeUnlockAt(
  anchorDate: string | Date,
  offsetDays: number,
): string {
  const anchor = toDate(anchorDate);
  if (!anchor) {
    throw new Error("computeUnlockAt: anchorDate is required");
  }
  const safeOffset = Number.isFinite(offsetDays) ? Math.trunc(offsetDays) : 0;
  const shifted = new Date(anchor.getTime() + safeOffset * MS_PER_DAY);
  return shifted.toISOString();
}

/**
 * Shape used by the propagation planner - given an existing scheduled row,
 * decide the new unlock_at after a structural change.
 *
 * Rules:
 *   - If the row has has_unlock_override=true, keep its current unlock_at
 *     (admin intentionally moved it).
 *   - Otherwise recompute from the assignment anchor + the item's current
 *     default_offset_days.
 */
export function propagatedUnlockAt(args: {
  currentUnlockAt: string;
  hasUnlockOverride: boolean;
  anchorDate: string;
  itemOffsetDays: number;
}): string {
  if (args.hasUnlockOverride) return args.currentUnlockAt;
  return computeUnlockAt(args.anchorDate, args.itemOffsetDays);
}

// ------------------------------------------------------------
// Internals
// ------------------------------------------------------------

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}
