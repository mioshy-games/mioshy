"use server";

// ============================================================
// app/dashboard/users/[id]/actions.ts
//
// Admin actions that operate on a single user's journey state.
//
// 2026-05-28 — added `forceMaterializeDay1` so support can
// unstick paying users whose day-1 cadence item failed to
// materialize at purchase time (race with the Cardcom webhook,
// transient DB error, or any other reason that left the user
// with priorities + cadence assignment but zero scheduled
// items). Without this button the only recovery was waiting
// for the Monday 09:00 UTC cadence cron.
// ============================================================

import { requireAdmin } from "@/lib/auth/admin";
import { materializeNextItemForUser, ensureCadenceAssignment } from "@/lib/journey-content/cadence-engine";
import type { MaterializeResult } from "@/lib/journey-content/cadence-engine";

/**
 * Server-side outcome for the admin "force day-1" button. Mirrors
 * the cadence engine's MaterializeResult so the UI can show the
 * exact reason on failure (`no_journey_subscription`, `no_priorities`,
 * `no_program`, `db_error`, etc.).
 */
export interface ForceMaterializeOutcome {
  ok: boolean;
  reason?: string;
  error?: string;
  scheduledItemId?: string;
  itemId?: string;
  /** True when ensureCadenceAssignment created a new row as part of
   *  this call (rather than reusing an existing one). Lets the admin
   *  see "we also fixed the missing assignment" in the response. */
  createdAssignment?: boolean;
}

/**
 * Force-materialize the user's day-1 cadence item with `unlock_at=now`.
 *
 * Step 1: ensureCadenceAssignment (idempotent — no-op when one exists).
 * Step 2: materializeNextItemForUser with `skipSweep:true, unlockAt:now`.
 *
 * Both steps live behind requireAdmin() so this can never be called
 * from a non-admin context. The session admin client is unused inside
 * the cadence engine (it builds its own service-role client) — the
 * requireAdmin() call here is purely a gate.
 */
export async function forceMaterializeDay1(
  targetUserId: string,
): Promise<ForceMaterializeOutcome> {
  // Admin gate. Throws / redirects on non-admin callers.
  await requireAdmin();

  if (!targetUserId || typeof targetUserId !== "string") {
    return { ok: false, reason: "db_error", error: "invalid target user id" };
  }

  // Self-heal the assignment first. The engine's picker requires a
  // cadence assignment to exist before it can schedule items against
  // it. ensureCadenceAssignment is idempotent, so this is safe to
  // call even when the assignment already exists.
  const anchor = new Date();
  let createdAssignment = false;
  try {
    const created = await ensureCadenceAssignment(targetUserId, anchor);
    createdAssignment = !!created;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      "[admin/forceMaterializeDay1] ensureCadenceAssignment THREW",
      `target=${targetUserId}`,
      `error=${msg}`,
    );
    return { ok: false, reason: "db_error", error: msg };
  }

  // Materialize. We don't sweep — that's a separate maintenance op,
  // and during an admin recovery we want a minimal blast radius.
  let result: MaterializeResult;
  try {
    result = await materializeNextItemForUser(targetUserId, {
      unlockAt: anchor,
      source: "cadence",
      skipSweep: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      "[admin/forceMaterializeDay1] materialize THREW",
      `target=${targetUserId}`,
      `error=${msg}`,
    );
    return { ok: false, reason: "db_error", error: msg, createdAssignment };
  }

  console.log(
    "[admin/forceMaterializeDay1] result",
    `target=${targetUserId}`,
    `ok=${result.ok}`,
    `reason=${result.reason ?? "(none)"}`,
    `scheduledItemId=${result.scheduledItemId ?? "(none)"}`,
    `createdAssignment=${createdAssignment}`,
  );

  return {
    ok: result.ok,
    reason: result.reason,
    error: result.error,
    scheduledItemId: result.scheduledItemId,
    itemId: result.itemId,
    createdAssignment,
  };
}
