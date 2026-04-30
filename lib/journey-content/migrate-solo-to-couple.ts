// ============================================================
// Solo → couple journey migration helper.
//
// When two users pair up, any active journey assignments owned by one of
// them individually should "promote" to couple ownership so BOTH partners
// see the same timeline from that moment on. Without this step the new
// partner keeps a blank /journey until an admin re-assigns or the buyer
// re-purchases.
//
// Behavior:
//   • Finds all `is_active = true` journey_assignments owned solo by either
//     member of the couple (user_id = <member>, couple_id IS NULL).
//   • For each, checks whether the couple already has an active assignment
//     for the same source (program/category/item). If yes, the solo one is
//     deactivated (the couple version wins - admin or newer purchase made
//     it intentionally). If no, the solo row is rewritten in place:
//     user_id = NULL, couple_id = <coupleId>. Scheduled items, responses,
//     and completions ride along untouched because they reference the
//     assignment by id, not by its owner.
//   • Idempotent - running twice for the same couple is a no-op.
//   • Never throws. Returns a structured report so callers (server action,
//     admin backfill, etc.) can surface results.
//
// Not handled here:
//   • New-partner-side "did they also bring a solo journey?" - the helper
//     walks BOTH members, so both sides of a pairing are migrated in the
//     same call.
//   • Telling the user about the migration - that's a UX concern left to
//     the caller (e.g. the pairing dialog can inline a summary).
// ============================================================

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin";
import type { JourneyAssignment } from "./types";

export interface MigrateSoloJourneyArgs {
  /**
   * One of the pair's user ids. Typically the user who just accepted an
   * invite - the other member is discovered via couple_members.
   */
  userId: string;
  coupleId: string;
  /**
   * Optional pre-built admin client (pairing flow already has one).
   */
  supabase?: SupabaseClient;
}

export interface MigrateSoloJourneyResult {
  ok: boolean;
  /** Total solo assignments we considered across both members. */
  scanned: number;
  /** Rehomed to couple ownership. */
  promoted: number;
  /** Deactivated because the couple already had a conflicting assignment. */
  deactivated: number;
  /** Already owned by the couple - no action. */
  skipped: number;
  errors: Array<{ where: string; message: string }>;
  /** Per-assignment log for debugging / admin UI. */
  actions: Array<{
    assignmentId: string;
    sourceKind: string;
    sourceId: string;
    action: "promoted" | "deactivated" | "noop";
    conflictedWith?: string;
  }>;
}

/**
 * Promote solo journey assignments to couple ownership on pairing.
 * Safe to call multiple times - the filter on `couple_id IS NULL`
 * naturally prevents re-promoting rows that already moved.
 */
export async function migrateSoloJourneyToCouple(
  args: MigrateSoloJourneyArgs,
): Promise<MigrateSoloJourneyResult> {
  const result: MigrateSoloJourneyResult = {
    ok: true,
    scanned: 0,
    promoted: 0,
    deactivated: 0,
    skipped: 0,
    errors: [],
    actions: [],
  };

  if (!args.userId || !args.coupleId) {
    result.ok = false;
    result.errors.push({
      where: "args",
      message: "userId and coupleId are both required",
    });
    return result;
  }

  const supabase = args.supabase ?? (await createAdminClient());

  // 1. Discover both members of the couple. We use admin access so this
  //    works even if the caller isn't one of them (admin backfill case).
  const { data: membersRaw, error: mErr } = await supabase
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", args.coupleId);
  if (mErr) {
    result.ok = false;
    result.errors.push({ where: "couple_members", message: mErr.message });
    return result;
  }
  const memberIds = Array.from(
    new Set(
      ((membersRaw ?? []) as Array<{ user_id: string }>)
        .map((r) => r.user_id)
        .concat(args.userId), // defensive: include the caller even if the
      // members row hasn't been visible yet (race after insert)
    ),
  ).filter(Boolean);
  if (memberIds.length === 0) {
    result.errors.push({
      where: "members",
      message: "couple has no members",
    });
    result.ok = false;
    return result;
  }

  // 2. Active solo assignments owned by either member.
  const { data: soloRaw, error: sErr } = await supabase
    .from("journey_assignments")
    .select("*")
    .is("couple_id", null)
    .in("user_id", memberIds)
    .eq("is_active", true);
  if (sErr) {
    result.ok = false;
    result.errors.push({
      where: "solo_assignments",
      message: sErr.message,
    });
    return result;
  }
  const solo = (soloRaw ?? []) as JourneyAssignment[];
  result.scanned = solo.length;
  if (solo.length === 0) return result;

  // 3. Existing couple-owned assignments for the same (source_kind, source_id)
  //    - fetched once to keep conflict checks in-memory.
  const coupleOwnedBySource = new Map<string, JourneyAssignment>();
  const { data: coupleRowsRaw, error: cErr } = await supabase
    .from("journey_assignments")
    .select("*")
    .eq("couple_id", args.coupleId)
    .eq("is_active", true);
  if (cErr) {
    result.ok = false;
    result.errors.push({
      where: "couple_assignments",
      message: cErr.message,
    });
    return result;
  }
  for (const row of (coupleRowsRaw ?? []) as JourneyAssignment[]) {
    coupleOwnedBySource.set(`${row.source_kind}:${row.source_id}`, row);
  }

  // 4. Walk each solo assignment, promote or deactivate.
  for (const a of solo) {
    const sourceKey = `${a.source_kind}:${a.source_id}`;
    const conflict = coupleOwnedBySource.get(sourceKey);

    if (conflict) {
      // Couple already has an active assignment for the same source
      // (e.g. the partner purchased and got auto-assigned first). Soft-
      // retire the solo row; its scheduled items and responses stay
      // readable because they're keyed on assignment id.
      const { error: dErr } = await supabase
        .from("journey_assignments")
        .update({
          is_active: false,
          notes: appendNote(
            a.notes,
            `Deactivated on pairing - couple already owned ${conflict.id}.`,
          ),
        })
        .eq("id", a.id);
      if (dErr) {
        result.errors.push({
          where: `deactivate:${a.id}`,
          message: dErr.message,
        });
        continue;
      }
      result.deactivated += 1;
      result.actions.push({
        assignmentId: a.id,
        sourceKind: a.source_kind,
        sourceId: a.source_id,
        action: "deactivated",
        conflictedWith: conflict.id,
      });
      continue;
    }

    // No conflict - rehome the solo assignment to the couple. The XOR
    // constraint (`(user_id IS NOT NULL) <> (couple_id IS NOT NULL)`)
    // requires nulling user_id in the same UPDATE.
    const { error: uErr } = await supabase
      .from("journey_assignments")
      .update({
        user_id: null,
        couple_id: args.coupleId,
        notes: appendNote(
          a.notes,
          "Promoted to couple ownership on pairing.",
        ),
      })
      .eq("id", a.id)
      .is("couple_id", null); // idempotency guard
    if (uErr) {
      result.errors.push({
        where: `promote:${a.id}`,
        message: uErr.message,
      });
      continue;
    }

    // Register it so subsequent solo rows with the same source get
    // deactivated rather than promoted on top (e.g. both partners had
    // their own solo journey for the same program).
    coupleOwnedBySource.set(sourceKey, {
      ...a,
      user_id: null,
      couple_id: args.coupleId,
    });

    result.promoted += 1;
    result.actions.push({
      assignmentId: a.id,
      sourceKind: a.source_kind,
      sourceId: a.source_id,
      action: "promoted",
    });
  }

  if (result.errors.length > 0) result.ok = false;
  return result;
}

function appendNote(
  existing: string | null | undefined,
  addition: string,
): string {
  const trimmed = (existing ?? "").trim();
  if (!trimmed) return addition;
  if (trimmed.includes(addition)) return trimmed;
  return `${trimmed}\n${addition}`;
}
