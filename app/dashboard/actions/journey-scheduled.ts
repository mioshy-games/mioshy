"use server";

// ============================================================
// Admin server actions for individual journey_scheduled_items rows.
//
// The Manage-Client screen (Phase 4) needs to adjust the schedule one
// item at a time - moving an unlock date, clearing an override back to
// the item's default offset, or removing a scheduled row entirely.
//
// All writes go through the admin client because migration 035 installs
// SELECT-only RLS on journey_scheduled_items. Callers must be gated by
// requireAdmin (enforced here via adminDb()).
// ============================================================

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase-admin";
import { computeUnlockAt } from "@/lib/journey-content/schedule";
import type {
  JourneyAssignment,
  JourneyItem,
  JourneyScheduledItem,
} from "@/lib/journey-content/types";

type Result =
  | { ok: true; scheduled: JourneyScheduledItem }
  | { ok: false; error: string };

async function adminDb() {
  await requireAdmin();
  return createAdminClient();
}

function revalidate(ownerKey?: string) {
  revalidatePath("/dashboard/journey", "layout");
  if (ownerKey) {
    revalidatePath(`/dashboard/journey/clients/${ownerKey}`, "layout");
  }
}

/**
 * Load a scheduled row and figure out the owner_key for the assignment
 * it belongs to - so revalidate() can invalidate the right Manage-Client
 * page without the caller having to pass it.
 */
async function loadScheduledWithOwner(
  scheduledItemId: string,
): Promise<
  | {
      scheduled: JourneyScheduledItem;
      assignment: JourneyAssignment;
      ownerKey: string;
    }
  | null
> {
  const supabase = await adminDb();
  const { data: scheduled, error: sErr } = await supabase
    .from("journey_scheduled_items")
    .select("*")
    .eq("id", scheduledItemId)
    .maybeSingle();
  if (sErr || !scheduled) return null;

  const { data: assignment, error: aErr } = await supabase
    .from("journey_assignments")
    .select("*")
    .eq("id", (scheduled as JourneyScheduledItem).assignment_id)
    .maybeSingle();
  if (aErr || !assignment) return null;

  const a = assignment as JourneyAssignment;
  const ownerKey = a.couple_id ? `couple:${a.couple_id}` : `user:${a.user_id}`;
  return {
    scheduled: scheduled as JourneyScheduledItem,
    assignment: a,
    ownerKey,
  };
}

/**
 * Set a custom unlock_at on a scheduled row. Always flips
 * has_unlock_override=true so the propagation planner knows to leave
 * this row alone when the item's default_offset_days changes later.
 *
 * The admin UI sends a date-only ISO ("2026-05-12") - we widen to start-
 * of-day UTC for consistency with materializer output.
 */
export async function updateScheduledItemUnlock(args: {
  scheduledItemId: string;
  unlockDate: string;
  adminNotes?: string | null;
}): Promise<Result> {
  if (!args.scheduledItemId) {
    return { ok: false, error: "missing_id" };
  }
  const parsed = new Date(args.unlockDate);
  if (!Number.isFinite(parsed.getTime())) {
    return { ok: false, error: "invalid_date" };
  }
  const unlockIso = new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  ).toISOString();

  const ctx = await loadScheduledWithOwner(args.scheduledItemId);
  if (!ctx) return { ok: false, error: "not_found" };

  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("journey_scheduled_items")
    .update({
      unlock_at: unlockIso,
      has_unlock_override: true,
      admin_notes:
        args.adminNotes === undefined
          ? ctx.scheduled.admin_notes
          : args.adminNotes && args.adminNotes.trim().length > 0
            ? args.adminNotes.trim()
            : null,
    })
    .eq("id", args.scheduledItemId)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "update_failed" };
  }
  revalidate(ctx.ownerKey);
  return { ok: true, scheduled: data as JourneyScheduledItem };
}

/**
 * Recompute unlock_at from (assignment.anchor_date + item.default_offset_days)
 * and clear the override flag. Useful when the admin nudged a date, then
 * wants to fall back to "follow whatever the catalog says".
 */
export async function clearScheduledItemOverride(
  scheduledItemId: string,
): Promise<Result> {
  if (!scheduledItemId) return { ok: false, error: "missing_id" };
  const ctx = await loadScheduledWithOwner(scheduledItemId);
  if (!ctx) return { ok: false, error: "not_found" };

  const supabase = await adminDb();
  const { data: itemRow, error: iErr } = await supabase
    .from("journey_items")
    .select("id, default_offset_days")
    .eq("id", ctx.scheduled.item_id)
    .maybeSingle();
  if (iErr || !itemRow) {
    return { ok: false, error: iErr?.message ?? "item_not_found" };
  }
  const item = itemRow as Pick<JourneyItem, "id" | "default_offset_days">;

  const unlockIso = computeUnlockAt(
    ctx.assignment.anchor_date,
    item.default_offset_days,
  );

  const { data, error } = await supabase
    .from("journey_scheduled_items")
    .update({
      unlock_at: unlockIso,
      has_unlock_override: false,
    })
    .eq("id", scheduledItemId)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "update_failed" };
  }
  revalidate(ctx.ownerKey);
  return { ok: true, scheduled: data as JourneyScheduledItem };
}

/**
 * Delete a scheduled row. This cascades to completions + responses via
 * FK ON DELETE CASCADE (migration 035). Callers should confirm - the
 * partner may have already reflected on this item, and those replies
 * disappear. The content itself stays in journey_items; only this
 * scheduling row is removed.
 *
 * Idempotent: deleting a nonexistent row is a no-op.
 */
export async function deleteScheduledItem(
  scheduledItemId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!scheduledItemId) return { ok: false, error: "missing_id" };
  const ctx = await loadScheduledWithOwner(scheduledItemId);

  const supabase = await adminDb();
  const { error } = await supabase
    .from("journey_scheduled_items")
    .delete()
    .eq("id", scheduledItemId);
  if (error) return { ok: false, error: error.message };

  revalidate(ctx?.ownerKey);
  return { ok: true };
}
