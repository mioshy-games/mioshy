"use server";

/**
 * app/dashboard/actions/track-switch.ts
 *
 * Layer-2 mid-journey track switch. Itzik 2026-05-08:
 *
 *   "couple was placed on intimacy. After 3 sessions Yael sees the
 *    real need is communication. Switch the track without losing
 *    history, without breaking the rhythm, without confusing them."
 *
 * What this does:
 *   1. Verifies the coach has access to the couple.
 *   2. Marks the old program assignment track_role='paused'
 *      (we never delete — keeps history queryable; "previous track"
 *      surfaces in V3 read directly from this state).
 *   3. Cancels the OPEN future-locked scheduled_items on the old
 *      assignment by stamping skipped_at — the user no longer sees
 *      them in the timeline.
 *   4. Creates a new program assignment with track_role='primary'
 *      anchored to NOW + materialises it (rule = manual_assignment).
 *   5. Forces the first new item to unlock at NOW (day-1 override
 *      semantics so the user sees something instantly).
 *   6. Writes a journey_track_switches audit row.
 *   7. Optionally posts a coach-signed message to the general
 *      channel of EACH partner explaining the shift — the coach
 *      writes the message text in the modal.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireExpert } from "@/lib/auth/expert";
import { createAdminClient } from "@/lib/supabase-admin";
import { materializeAssignment } from "@/lib/journey-content/materialize";
import { resolveAnchorDate } from "@/lib/journey-content/schedule";
import { resolveRuleId } from "@/lib/journey-content/match-rules";
import type { JourneyAssignment } from "@/lib/journey-content/types";

const schema = z.object({
  coupleId:           z.string().uuid(),
  fromAssignmentId:   z.string().uuid(),
  toProgramId:        z.string().uuid(),
  reason:             z.string().trim().max(500).optional().nullable(),
  /** Optional message to post in BOTH partners' general channels. */
  noticeMessage:      z.string().trim().max(2000).optional().nullable(),
  /** Whether to skip future-locked items on the old assignment.
   *  Defaults to true — that's the whole point of switching. */
  cancelFutureLocked: z.boolean().default(true),
});

type Result =
  | { ok: true; newAssignmentId: string; itemsCancelled: number; itemsPreserved: number }
  | { ok: false; error: string };

export async function switchCoupleTrack(raw: unknown): Promise<Result> {
  const session = await requireExpert();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "invalid_input" };
  }
  const { coupleId, fromAssignmentId, toProgramId, reason, noticeMessage, cancelFutureLocked } = parsed.data;

  const admin = await createAdminClient();

  // ── 1. Access check ────────────────────────────────────────────────
  if (!session.isAdmin) {
    const { data: link } = await admin
      .from("expert_couples")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("expert_id", session.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!link) return { ok: false, error: "not_assigned_to_couple" };
  }

  // ── 2. Load both programs (for slug snapshot in the audit row) ─────
  const { data: fromAssignment } = await admin
    .from("journey_assignments")
    .select("id, source_kind, source_id, couple_id, user_id, anchor_date")
    .eq("id", fromAssignmentId)
    .maybeSingle();
  if (!fromAssignment) return { ok: false, error: "from_assignment_not_found" };

  const fa = fromAssignment as {
    id:          string;
    source_kind: string;
    source_id:   string;
    couple_id:   string | null;
    user_id:     string | null;
    anchor_date: string;
  };

  if (fa.couple_id !== coupleId) {
    return { ok: false, error: "couple_mismatch" };
  }

  const { data: fromProgram } = await admin
    .from("journey_programs")
    .select("slug, name_he")
    .eq("id", fa.source_id)
    .maybeSingle();
  const { data: toProgram } = await admin
    .from("journey_programs")
    .select("slug, name_he")
    .eq("id", toProgramId)
    .maybeSingle();

  if (!toProgram) return { ok: false, error: "to_program_not_found" };

  // ── 3. Pause the old assignment + skip future-locked items ─────────
  const { error: pauseErr } = await admin
    .from("journey_assignments")
    .update({ track_role: "paused" })
    .eq("id", fromAssignmentId);
  if (pauseErr) return { ok: false, error: pauseErr.message };

  let itemsCancelled = 0;
  let itemsPreserved = 0;
  if (cancelFutureLocked) {
    const nowIso = new Date().toISOString();
    // Future-locked = unlock_at > now AND completed_at IS NULL.
    // We don't touch already-unlocked items — the user may still
    // engage with them as part of "your previous track" history.
    const { data: futureRows } = await admin
      .from("journey_scheduled_items")
      .select("id, unlock_at, skipped_at")
      .eq("assignment_id", fromAssignmentId)
      .gt("unlock_at", nowIso)
      .is("skipped_at", null);

    const ids = ((futureRows ?? []) as Array<{ id: string }>).map((r) => r.id);
    itemsCancelled = ids.length;
    if (ids.length > 0) {
      await admin
        .from("journey_scheduled_items")
        .update({ skipped_at: nowIso })
        .in("id", ids);
    }

    // Count preserved (= unlocked-and-still-active) for the audit row.
    const { data: preservedRows } = await admin
      .from("journey_scheduled_items")
      .select("id")
      .eq("assignment_id", fromAssignmentId)
      .lte("unlock_at", nowIso)
      .is("skipped_at", null);
    itemsPreserved = ((preservedRows ?? []) as Array<{ id: string }>).length;
  }

  // ── 4. Create the new primary assignment ───────────────────────────
  const anchorIso = resolveAnchorDate({
    anchorKind: "fixed",
    fixedAt:    new Date(),
  });

  const { data: newAssignment, error: createErr } = await admin
    .from("journey_assignments")
    .insert({
      user_id:     null,
      couple_id:   coupleId,
      source_kind: "program",
      source_id:   toProgramId,
      anchor_kind: "fixed",
      anchor_date: anchorIso,
      origin:      "admin_manual",
      origin_ref:  `track_switch:${fromAssignmentId}`,
      notes:       reason
        ? `Track switch from ${fromProgram?.name_he ?? fa.source_id}: ${reason}`
        : `Track switch from ${fromProgram?.name_he ?? fa.source_id}`,
      is_active:   true,
      track_role:  "primary",
    })
    .select("*")
    .single();

  if (createErr || !newAssignment) {
    return { ok: false, error: createErr?.message ?? "create_failed" };
  }
  const na = newAssignment as JourneyAssignment;

  // ── 5. Materialise + day-1 unlock the first item ───────────────────
  const { inserted } = await materializeAssignment({
    assignment: na,
    supabase:   admin,
    defaultRuleSlug: "manual_assignment",
  });

  if (inserted > 0) {
    const { data: firstItem } = await admin
      .from("journey_scheduled_items")
      .select("id")
      .eq("assignment_id", na.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstItem?.id) {
      const dayOneRuleId = await resolveRuleId("day_one_kickoff");
      await admin
        .from("journey_scheduled_items")
        .update({
          unlock_at: new Date().toISOString(),
          has_unlock_override: true,
          ...(dayOneRuleId ? { matched_by_rule_id: dayOneRuleId } : {}),
        })
        .eq("id", firstItem.id as string);
    }
  }

  // ── 6. Audit row ──────────────────────────────────────────────────
  await admin.from("journey_track_switches").insert({
    user_id:            null,
    couple_id:          coupleId,
    from_assignment_id: fromAssignmentId,
    to_assignment_id:   na.id,
    from_program_slug:  fromProgram?.slug ?? null,
    to_program_slug:    toProgram?.slug  ?? null,
    switched_by:        session.user.id,
    reason:             reason?.trim() || null,
    items_cancelled:    itemsCancelled,
    items_preserved:    itemsPreserved,
  });

  // ── 7. Optional notice to both partners ───────────────────────────
  if (noticeMessage && noticeMessage.trim().length > 0) {
    // Post to each partner's general channel so both see a personal
    // note from the coach explaining the shift.
    const { data: members } = await admin
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", coupleId);
    const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
      (m) => m.user_id,
    );
    for (const uid of userIds) {
      // Ensure the channel row exists (no-op if already there).
      await admin
        .from("journey_user_channels")
        .upsert(
          { user_id: uid },
          { onConflict: "user_id", ignoreDuplicates: true },
        );
      await admin.from("journey_messages").insert({
        channel_user_id:   uid,
        author_user_id:    session.user.id,
        author_kind:       "expert",
        expert_signed_by:  session.user.id,
        body:              noticeMessage.trim(),
        is_private:        true,
      });
    }
  }

  // ── 8. Bust caches ─────────────────────────────────────────────────
  revalidatePath(`/dashboard/my-clients/${coupleId}`, "layout");
  revalidatePath("/dashboard/my-clients", "layout");
  revalidatePath("/[locale]/my/journey", "layout");

  return {
    ok: true,
    newAssignmentId: na.id,
    itemsCancelled,
    itemsPreserved,
  };
}
