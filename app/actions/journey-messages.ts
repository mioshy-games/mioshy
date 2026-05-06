"use server";

// ============================================================
// Server actions for the v3 threaded messaging surface (slice 6).
//
// Two surfaces, one storage table (journey_messages):
//   - per-item threads (scheduled_item_id NOT NULL)
//   - general expert channel (channel_user_id NOT NULL)
//
// Dual-write contract for the slice 6 transitional period:
//   * User per-item posts → journey_messages + journey_item_responses
//   * Expert replies to items → journey_messages + update legacy
//     journey_item_responses.clinician_reply_text on the latest user
//     response so the existing clinician inbox stays in sync.
//   * User channel posts → journey_messages + journey_user_messages
//   * Expert channel replies → journey_messages only (no legacy
//     equivalent - the channel's expert-reply path is brand new).
//
// Side effects:
//   * The first user message in a per-item thread stamps
//     scheduled_items.responded_at = now() so the cadence engine's
//     auto-skip rule keys correctly.
//   * Each post triggers a notification (in-app log + email) via
//     lib/journey-content/notifications.ts.
//
// Auth model:
//   * User actions go through resolveViewer() (session client →
//     identity, admin client for writes).
//   * Expert actions go through requireExpert() - same pattern as
//     the existing clinicianReply server action.
// ============================================================

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireCompleteProfile } from "@/lib/auth/profile-gate";
import { requireExpert } from "@/lib/auth/expert";
import { ensureUserChannel } from "@/lib/journey-content/messages";
import {
  notifyExpertPool,
  notifyUser,
} from "@/lib/journey-content/notifications";
import { logActivity } from "@/lib/journey/activity";
import type {
  JourneyAssignment,
  JourneyScheduledItem,
} from "@/lib/journey-content/types";

const MESSAGE_MAX_LEN = 4000;

type Ok<T extends Record<string, unknown> = Record<string, never>> = {
  ok: true;
} & T;
type Err = { ok: false; error: string };

// ------------------------------------------------------------
// Shared helpers (mirrored from journey-content-user.ts so this
// file stays standalone and the dual-write paths can be deleted in
// one shot when the legacy tables retire).
// ------------------------------------------------------------

async function resolveViewer(): Promise<
  { ok: true; userId: string; coupleIds: string[] } | Err
> {
  const gate = await requireCompleteProfile();
  if (!gate.ok) return { ok: false, error: gate.error };
  const userId = gate.gate.user_id;
  const session = await createServerSupabaseClient();
  const { data: memberships, error } = await session
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  const coupleIds = (memberships ?? [])
    .map((m) => m.couple_id as string)
    .filter(Boolean);
  return { ok: true, userId, coupleIds };
}

async function loadScheduledForViewer(args: {
  scheduledItemId: string;
  userId: string;
  coupleIds: string[];
}): Promise<
  | { ok: true; scheduled: JourneyScheduledItem; assignment: JourneyAssignment }
  | Err
> {
  const admin = await createAdminClient();
  const { data: scheduledRow, error: sErr } = await admin
    .from("journey_scheduled_items")
    .select("*")
    .eq("id", args.scheduledItemId)
    .maybeSingle();
  if (sErr) return { ok: false, error: sErr.message };
  if (!scheduledRow) return { ok: false, error: "not_found" };
  const scheduled = scheduledRow as JourneyScheduledItem;

  const { data: assignmentRow, error: aErr } = await admin
    .from("journey_assignments")
    .select("*")
    .eq("id", scheduled.assignment_id)
    .maybeSingle();
  if (aErr) return { ok: false, error: aErr.message };
  if (!assignmentRow) return { ok: false, error: "not_found" };
  const assignment = assignmentRow as JourneyAssignment;
  if (!assignment.is_active) return { ok: false, error: "assignment_inactive" };

  const ownedByMe =
    (assignment.user_id && assignment.user_id === args.userId) ||
    (assignment.couple_id && args.coupleIds.includes(assignment.couple_id));
  if (!ownedByMe) return { ok: false, error: "forbidden" };

  return { ok: true, scheduled, assignment };
}

function isUnlocked(scheduled: JourneyScheduledItem, now = new Date()): boolean {
  const unlock = new Date(scheduled.unlock_at).getTime();
  if (!Number.isFinite(unlock)) return false;
  return unlock <= now.getTime();
}

function revalidateMessageSurfaces() {
  revalidatePath("/[locale]/journey/timeline", "layout");
  revalidatePath("/[locale]/my/journey", "page");
  revalidatePath("/[locale]/dashboard", "layout");
}

function previewBody(body: string): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
}

// ============================================================
// User → per-item thread
// ============================================================

export async function postPerItemMessage(args: {
  scheduledItemId: string;
  body: string;
  /** v3 default: per-item threads are partner-visible (false). */
  isPrivate?: boolean;
}): Promise<Ok<{ messageId: string }> | Err> {
  if (!args.scheduledItemId) return { ok: false, error: "missing_id" };
  const trimmed = (args.body ?? "").trim();
  if (trimmed.length === 0) return { ok: false, error: "empty_body" };
  if (trimmed.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: "body_too_long" };
  }

  const viewer = await resolveViewer();
  if (!viewer.ok) return viewer;

  const scope = await loadScheduledForViewer({
    scheduledItemId: args.scheduledItemId,
    userId: viewer.userId,
    coupleIds: viewer.coupleIds,
  });
  if (!scope.ok) return scope;
  if (!isUnlocked(scope.scheduled)) return { ok: false, error: "locked" };

  const admin = await createAdminClient();
  const isPrivate = !!args.isPrivate;

  // Step 1 - write the legacy row first. The clinician inbox queries
  // pivot on journey_item_responses; if this insert fails we don't
  // want to leak a journey_messages row that's invisible to the inbox.
  const { data: legacyRow, error: legacyErr } = await admin
    .from("journey_item_responses")
    .insert({
      scheduled_item_id: args.scheduledItemId,
      user_id: viewer.userId,
      response_text: trimmed,
      is_private: isPrivate,
    })
    .select("id")
    .single();
  if (legacyErr || !legacyRow) {
    return {
      ok: false,
      error: legacyErr?.message ?? "legacy_insert_failed",
    };
  }
  const legacyResponseId = legacyRow.id as string;

  // Step 2 - write the canonical journey_messages row, linked back.
  const { data: msgRow, error: msgErr } = await admin
    .from("journey_messages")
    .insert({
      scheduled_item_id: args.scheduledItemId,
      author_user_id: viewer.userId,
      author_kind: "user",
      body: trimmed,
      is_private: isPrivate,
      legacy_response_id: legacyResponseId,
    })
    .select("id")
    .single();
  if (msgErr || !msgRow) {
    // The legacy row is already in - log and continue. The inbox sees
    // the post; the new thread UI just won't show this one until the
    // back-fill runs again.
    console.error("[postPerItemMessage] journey_messages insert failed", msgErr);
    return { ok: false, error: msgErr?.message ?? "messages_insert_failed" };
  }

  // Step 3 - stamp scheduled_items.responded_at on the FIRST user
  // post in this thread. Cadence engine's auto-skip rule keys on this.
  if (!scope.scheduled.responded_at) {
    await admin
      .from("journey_scheduled_items")
      .update({ responded_at: new Date().toISOString() })
      .eq("id", args.scheduledItemId)
      .is("responded_at", null);
  }

  // Step 4 - activity log + notification (best effort).
  await logActivity({
    userId: viewer.userId,
    coupleId: scope.assignment.couple_id ?? null,
    scheduledItemId: args.scheduledItemId,
    verb: "response_posted",
    payload: { is_private: isPrivate, message_id: msgRow.id },
  });

  await notifyExpertPool({
    kind: "item_message_user_posted",
    subject: "Mioshy: a user posted on a journey item",
    payload: {
      preview: previewBody(trimmed),
      context_label: `scheduled_item_id=${args.scheduledItemId}`,
      href: `/dashboard/my-clients/${scope.assignment.couple_id ?? viewer.userId}`,
    },
  });

  revalidateMessageSurfaces();
  return { ok: true, messageId: msgRow.id as string };
}

// ============================================================
// Expert → per-item thread
// ============================================================

export async function postExpertReplyToItem(args: {
  scheduledItemId: string;
  body: string;
}): Promise<Ok<{ messageId: string }> | Err> {
  if (!args.scheduledItemId) return { ok: false, error: "missing_id" };
  const trimmed = (args.body ?? "").trim();
  if (trimmed.length === 0) return { ok: false, error: "empty_body" };
  if (trimmed.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: "body_too_long" };
  }

  const expert = await requireExpertOrFail();
  if (!expert.ok) return { ok: false, error: "unauthorized" };

  const admin = await createAdminClient();

  // Find the latest user response on this scheduled_item - that's the
  // "ticket" the legacy clinician inbox tracks. We mirror the reply
  // there so dashboards keep working.
  const { data: latestUserResponse } = await admin
    .from("journey_item_responses")
    .select("id, user_id, scheduled_item_id")
    .eq("scheduled_item_id", args.scheduledItemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Also need the assignment so we know who the recipient is.
  const { data: schedRow } = await admin
    .from("journey_scheduled_items")
    .select("id, assignment_id")
    .eq("id", args.scheduledItemId)
    .maybeSingle();
  if (!schedRow) return { ok: false, error: "not_found" };
  const { data: assignRow } = await admin
    .from("journey_assignments")
    .select("user_id, couple_id")
    .eq("id", schedRow.assignment_id as string)
    .maybeSingle();
  if (!assignRow) return { ok: false, error: "not_found" };

  // Step 1 - insert the canonical expert message.
  const { data: msgRow, error: msgErr } = await admin
    .from("journey_messages")
    .insert({
      scheduled_item_id: args.scheduledItemId,
      author_user_id: expert.userId,
      author_kind: "expert",
      body: trimmed,
      // Expert replies on per-item are partner-visible by default
      // (matches the historical clinician_reply_text behaviour).
      is_private: false,
      legacy_response_id: latestUserResponse?.id ?? null,
    })
    .select("id")
    .single();
  if (msgErr || !msgRow) {
    return {
      ok: false,
      error: msgErr?.message ?? "messages_insert_failed",
    };
  }

  // Step 2 - mirror to the legacy clinician_reply_text on the latest
  // user response so the existing clinician inbox shows the reply.
  // Skipped when there's no user response yet (shouldn't happen via
  // the UI but the engine could push a "broadcast" reply later).
  if (latestUserResponse?.id) {
    await admin
      .from("journey_item_responses")
      .update({
        clinician_id: expert.userId,
        clinician_reply_text: trimmed,
        clinician_replied_at: new Date().toISOString(),
        clinician_status: "resolved",
      })
      .eq("id", latestUserResponse.id);
  }

  // Step 3 - notify the user. For couple-owned legacy assignments we
  // notify both partners; for cadence (user-owned) we notify just
  // the partner who owns the cadence row.
  const recipients: string[] = [];
  if (assignRow.user_id) recipients.push(assignRow.user_id as string);
  if (assignRow.couple_id) {
    const { data: members } = await admin
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", assignRow.couple_id as string);
    for (const m of (members ?? []) as Array<{ user_id: string }>) {
      if (!recipients.includes(m.user_id)) recipients.push(m.user_id);
    }
  }
  for (const uid of recipients) {
    await notifyUser({
      recipientUserId: uid,
      kind: "item_message_expert_replied",
      subject: "Mioshy: an expert replied on your item",
      payload: {
        preview: previewBody(trimmed),
        href: `/he/journey/timeline/${args.scheduledItemId}`,
      },
    });
  }

  revalidateMessageSurfaces();
  return { ok: true, messageId: msgRow.id as string };
}

// ============================================================
// User → general expert channel
// ============================================================

export async function postGeneralChannelMessage(args: {
  body: string;
}): Promise<Ok<{ messageId: string }> | Err> {
  const trimmed = (args.body ?? "").trim();
  if (trimmed.length === 0) return { ok: false, error: "empty_body" };
  if (trimmed.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: "body_too_long" };
  }

  const viewer = await resolveViewer();
  if (!viewer.ok) return viewer;

  await ensureUserChannel(viewer.userId);

  const admin = await createAdminClient();

  // Resolve couple context so the legacy table mirrors the existing
  // shape (it has couple_id for inbox grouping).
  const coupleId = viewer.coupleIds[0] ?? null;

  // Step 1 - legacy row first.
  const { data: legacyRow, error: legacyErr } = await admin
    .from("journey_user_messages")
    .insert({
      user_id: viewer.userId,
      couple_id: coupleId,
      message_text: trimmed,
    })
    .select("id")
    .single();
  if (legacyErr || !legacyRow) {
    return {
      ok: false,
      error: legacyErr?.message ?? "legacy_insert_failed",
    };
  }

  // Step 2 - canonical journey_messages row.
  const { data: msgRow, error: msgErr } = await admin
    .from("journey_messages")
    .insert({
      channel_user_id: viewer.userId,
      author_user_id: viewer.userId,
      author_kind: "user",
      body: trimmed,
      // Itzik #7: general-channel posts default to private (partner
      // can't see). The trigger touches journey_user_channels.last_message_at.
      is_private: true,
      legacy_user_message_id: legacyRow.id as string,
    })
    .select("id")
    .single();
  if (msgErr || !msgRow) {
    console.error("[postGeneralChannelMessage] insert failed", msgErr);
    return { ok: false, error: msgErr?.message ?? "messages_insert_failed" };
  }

  await notifyExpertPool({
    kind: "channel_message_user_posted",
    subject: "Mioshy: a user posted to the general channel",
    payload: {
      preview: previewBody(trimmed),
      context_label: `user_id=${viewer.userId}`,
      href: `/dashboard/my-clients/${coupleId ?? viewer.userId}`,
    },
  });

  revalidateMessageSurfaces();
  return { ok: true, messageId: msgRow.id as string };
}

// ============================================================
// Expert → general expert channel
// ============================================================

export async function postExpertReplyToChannel(args: {
  channelUserId: string;
  body: string;
}): Promise<Ok<{ messageId: string }> | Err> {
  if (!args.channelUserId) return { ok: false, error: "missing_id" };
  const trimmed = (args.body ?? "").trim();
  if (trimmed.length === 0) return { ok: false, error: "empty_body" };
  if (trimmed.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: "body_too_long" };
  }

  const expert = await requireExpertOrFail();
  if (!expert.ok) return { ok: false, error: "unauthorized" };

  await ensureUserChannel(args.channelUserId);

  const admin = await createAdminClient();
  const { data: msgRow, error: msgErr } = await admin
    .from("journey_messages")
    .insert({
      channel_user_id: args.channelUserId,
      author_user_id: expert.userId,
      author_kind: "expert",
      body: trimmed,
      // Channel is solo by definition - expert reply visible only to
      // the channel owner (and the expert pool / admin).
      is_private: true,
    })
    .select("id")
    .single();
  if (msgErr || !msgRow) {
    return { ok: false, error: msgErr?.message ?? "messages_insert_failed" };
  }

  await notifyUser({
    recipientUserId: args.channelUserId,
    kind: "channel_message_expert_replied",
    subject: "Mioshy: an expert replied in your channel",
    payload: {
      preview: previewBody(trimmed),
      href: `/he/my/journey`,
    },
  });

  revalidateMessageSurfaces();
  return { ok: true, messageId: msgRow.id as string };
}

// ============================================================
// Reactions
// ============================================================

const ALLOWED_EMOJIS = new Set([
  ":heart:",
  ":thumbsup:",
  ":thinking:",
  ":sparkles:",
  ":pray:",
]);

export async function toggleReaction(args: {
  messageId: string;
  emoji: string;
}): Promise<
  Ok<{ reactions: Record<string, string[]> }> | Err
> {
  if (!args.messageId) return { ok: false, error: "missing_id" };
  if (!ALLOWED_EMOJIS.has(args.emoji)) {
    return { ok: false, error: "invalid_emoji" };
  }
  const viewer = await resolveViewer();
  if (!viewer.ok) return viewer;

  const admin = await createAdminClient();
  const { data: msg, error: rErr } = await admin
    .from("journey_messages")
    .select("id, reactions")
    .eq("id", args.messageId)
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!msg) return { ok: false, error: "not_found" };

  const current = (msg.reactions as Record<string, string[]> | null) ?? {};
  const list = Array.isArray(current[args.emoji]) ? [...current[args.emoji]] : [];
  const idx = list.indexOf(viewer.userId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(viewer.userId);
  }
  const next: Record<string, string[]> = { ...current };
  if (list.length === 0) {
    delete next[args.emoji];
  } else {
    next[args.emoji] = list;
  }

  const { error: updErr } = await admin
    .from("journey_messages")
    .update({ reactions: next })
    .eq("id", args.messageId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidateMessageSurfaces();
  return { ok: true, reactions: next };
}

// ------------------------------------------------------------

async function requireExpertOrFail(): Promise<
  { ok: true; userId: string } | { ok: false }
> {
  try {
    const session = await requireExpert();
    return { ok: true, userId: session.user.id };
  } catch {
    return { ok: false };
  }
}
