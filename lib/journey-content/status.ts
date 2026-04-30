// ============================================================
// Status derivation for the Journey Content System.
//
// There is no status column on journey_scheduled_items - display status
// is derived at read time from (unlock_at, completion?). Keeping the
// rule in one place means the user-facing timeline, admin preview, and
// notification worker all agree.
// ============================================================

import type { ScheduledItemStatus } from "./types";

export interface DeriveStatusInput {
  unlockAt: string | Date;
  hasCompletion: boolean;
  /** Pass explicitly to keep this pure + testable. */
  now?: Date;
}

export function deriveStatus(input: DeriveStatusInput): ScheduledItemStatus {
  if (input.hasCompletion) return "completed";
  const now = (input.now ?? new Date()).getTime();
  const unlock =
    input.unlockAt instanceof Date
      ? input.unlockAt.getTime()
      : new Date(input.unlockAt).getTime();
  if (!Number.isFinite(unlock)) return "locked";
  return unlock <= now ? "available" : "locked";
}

/**
 * Returns true if the viewer can open the item right now.
 * Completed items remain openable - they just render with a checkmark.
 */
export function isOpenable(status: ScheduledItemStatus): boolean {
  return status !== "locked";
}

/**
 * Compact diff summary for progress bars - (completed / total / available).
 */
export interface StatusCounts {
  total: number;
  locked: number;
  available: number;
  completed: number;
}

export function countStatuses(statuses: ScheduledItemStatus[]): StatusCounts {
  const counts: StatusCounts = {
    total: statuses.length,
    locked: 0,
    available: 0,
    completed: 0,
  };
  for (const s of statuses) counts[s] += 1;
  return counts;
}
